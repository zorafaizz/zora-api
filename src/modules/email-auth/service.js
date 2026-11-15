import {
  opaque,
  digest,
  mac,
  equal,
  code,
  uuid,
  normalizeEmail,
} from "./crypto.js";
export class AuthFault extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const minutes = 60000,
  days = 86400000;
export class EmailAuthService {
  constructor({
    pool,
    mail,
    codeKey,
    csrfKey,
    limitKey,
    now = () => Date.now(),
    allowSignup = false,
    serviceAccountIds = [],
  }) {
    Object.assign(this, {
      pool,
      mail,
      codeKey,
      csrfKey,
      limitKey,
      now,
      allowSignup,
    });
    this.serviceIds = new Set(serviceAccountIds);
  }
  async tx(work) {
    const c = await this.pool.connect();
    try {
      await c.query("BEGIN");
      await c.query("SET LOCAL statement_timeout='5s'");
      const result = await work(c);
      await c.query("COMMIT");
      return result;
    } catch (e) {
      await c.query("ROLLBACK");
      throw e;
    } finally {
      c.release();
    }
  }
  csrf(token, purpose) {
    return mac(this.csrfKey, purpose, token);
  }
  async limits(specs) {
    const now = this.now();
    const buckets = specs
      .map(([name, value, window, limit]) => ({
        hash: mac(this.limitKey, name, value, window),
        window,
        limit,
      }))
      .sort((a, b) => a.hash.localeCompare(b.hash));
    const denied = await this.tx(async (c) => {
      let denied = false;
      for (const bucket of buckets) {
        await c.query(
          "INSERT INTO auth_rate_buckets(bucket_hash,used,expires_at) VALUES($1,1,$2) ON CONFLICT DO NOTHING",
          [bucket.hash, new Date(now + bucket.window)],
        );
        const row = (
          await c.query(
            "SELECT hits FROM auth_rate_buckets WHERE bucket_hash=$1 FOR UPDATE",
            [bucket.hash],
          )
        ).rows[0];
        const hits = row.hits
          .map(Number)
          .filter((at) => at > now - bucket.window);
        const blocked = hits.length >= bucket.limit;
        if (blocked) denied = true;
        else hits.push(now);
        await c.query(
          "UPDATE auth_rate_buckets SET hits=$2,used=$3,expires_at=$4 WHERE bucket_hash=$1",
          [
            bucket.hash,
            hits,
            blocked ? hits.length + 1 : hits.length,
            new Date(now + bucket.window),
          ],
        );
      }
      return denied;
    });
    if (denied) throw new AuthFault(429, "Too many attempts. Try again later.");
  }
  async session(token, { touch = true, client } = {}) {
    if (!token || !/^[-_A-Za-z0-9]{43}$/.test(token)) return null;
    const now = this.now(),
      db = client || this.pool;
    const result = await db.query(
      `SELECT s.*,a.email,a.role FROM auth_sessions s JOIN accounts a ON a.id=s.account_id
 JOIN auth_email_identities i ON i.account_id=a.id AND i.canonical_email=a.email
 WHERE s.token_hash=$1 AND s.revoked_at IS NULL AND s.expires_at>$2 AND s.last_seen_at>$3 AND a.role='user' AND i.verified_at IS NOT NULL`,
      [digest(token), new Date(now), new Date(now - days)],
    );
    const s = result.rows[0];
    if (!s || this.serviceIds.has(s.account_id)) return null;
    if (touch && now - new Date(s.last_seen_at).getTime() > minutes)
      await db.query(
        "UPDATE auth_sessions SET last_seen_at=$2 WHERE id=$1 AND revoked_at IS NULL",
        [s.id, new Date(now)],
      );
    return s;
  }
  async preauth(token) {
    if (!token || !/^[-_A-Za-z0-9]{43}$/.test(token)) return null;
    const r = await this.pool.query(
      "SELECT * FROM auth_flows WHERE token_hash=$1 AND kind='preauth' AND revoked_at IS NULL AND expires_at>$2",
      [digest(token), new Date(this.now())],
    );
    return r.rows[0] || null;
  }
  async bootstrap(token) {
    let flow = await this.preauth(token);
    if (flow) return { flow, token };
    token = opaque();
    const id = uuid(),
      expires = new Date(this.now() + 10 * minutes);
    const r = await this.pool.query(
      "INSERT INTO auth_flows(id,kind,token_hash,expires_at) VALUES($1,'preauth',$2,$3) RETURNING *",
      [id, digest(token), expires],
    );
    return { flow: r.rows[0], token };
  }
  async start({ flowId, session, email, ip }) {
    const reauth = !!session;
    email = reauth ? session.email : normalizeEmail(email);
    if (!email) throw new AuthFault(400, "Enter a valid email address.");
    await this.limits([
      ["start-ip", ip, 15 * minutes, 20],
      ["send-email", email, 15 * minutes, 3],
      ["send-day", email, days, 10],
      ["send-global", "all", 60 * minutes, 1000],
    ]);
    const now = this.now(),
      otp = code(),
      purpose = reauth ? "reauth" : "signin";
    const prepared = await this.tx(async (c) => {
      let flow;
      if (reauth) {
        const locked = await c.query(
          "SELECT * FROM auth_sessions WHERE id=$1 FOR UPDATE",
          [session.id],
        );
        const fresh = await this.session(session.rawToken, {
          touch: false,
          client: c,
        });
        if (!fresh || locked.rows[0].token_version !== session.token_version)
          return { fault: 401 };
        flow = (
          await c.query(
            "SELECT * FROM auth_flows WHERE session_id=$1 AND session_version=$2 AND kind='reauth' AND revoked_at IS NULL AND expires_at>$3 ORDER BY expires_at DESC LIMIT 1 FOR UPDATE",
            [session.id, session.token_version, new Date(now)],
          )
        ).rows[0];
        if (!flow) {
          flow = (
            await c.query(
              "INSERT INTO auth_flows(id,kind,session_id,session_version,expires_at) VALUES($1,'reauth',$2,$3,$4) RETURNING *",
              [
                uuid(),
                session.id,
                session.token_version,
                new Date(
                  Math.min(
                    now + 10 * minutes,
                    new Date(session.expires_at).getTime(),
                  ),
                ),
              ],
            )
          ).rows[0];
        }
      } else
        flow = (
          await c.query(
            "SELECT * FROM auth_flows WHERE id=$1 AND kind='preauth' FOR UPDATE",
            [flowId],
          )
        ).rows[0];
      if (
        !flow ||
        flow.revoked_at ||
        new Date(flow.expires_at).getTime() <= now
      )
        return { fault: 400 };
      const prior = (
        await c.query(
          "SELECT * FROM auth_email_challenges WHERE flow_id=$1 AND canonical_email=$2 AND purpose=$3 FOR UPDATE",
          [flow.id, email, purpose],
        )
      ).rows[0];
      if (
        prior &&
        (prior.failures >= 5 ||
          prior.consumed_at ||
          new Date(prior.expires_at).getTime() <= now)
      )
        return { fault: 400 };
      if (prior && now - new Date(prior.sent_at).getTime() < minutes)
        return { fault: 429 };
      // Changing recipient supersedes all other codes in this browser flow.
      await c.query(
        "UPDATE auth_email_challenges SET consumed_at=$3 WHERE flow_id=$1 AND canonical_email<>$2 AND consumed_at IS NULL",
        [flow.id, email, new Date(now)],
      );
      const id = prior?.id || uuid(),
        generation = (prior?.generation || 0) + 1,
        expires =
          prior?.expires_at ||
          new Date(
            Math.min(now + 10 * minutes, new Date(flow.expires_at).getTime()),
          );
      const hash = mac(this.codeKey, id, generation, flow.id, purpose, otp);
      const approval =
        (
          await c.query(
            "SELECT approval_id FROM auth_email_identities WHERE canonical_email=$1",
            [email],
          )
        ).rows[0]?.approval_id || null;
      if (prior)
        await c.query(
          "UPDATE auth_email_challenges SET code_hmac=$2,generation=$3,sent_at=$4,issued_approval_id=$5,send_outcome='pending' WHERE id=$1",
          [id, hash, generation, new Date(now), approval],
        );
      else
        await c.query(
          "INSERT INTO auth_email_challenges(id,flow_id,canonical_email,purpose,code_hmac,generation,created_at,sent_at,expires_at,issued_approval_id) VALUES($1,$2,$3,$4,$5,$6,$7,$7,$8,$9)",
          [
            id,
            flow.id,
            email,
            purpose,
            hash,
            generation,
            new Date(now),
            expires,
            approval,
          ],
        );
      return {
        id,
        generation,
        flowId: flow.id,
        expires: new Date(expires).getTime(),
      };
    });
    if (prepared.fault)
      throw new AuthFault(
        prepared.fault,
        prepared.fault === 429
          ? "Wait before requesting another code."
          : "Restart sign-in to request a code.",
      );
    let sendOutcome = "accepted",
      deliveryTimer,
      timedOut = false;
    const deliveryController = new AbortController();
    try {
      await Promise.race([
        this.mail.sendCode(
          { to: email, code: otp, expiresAt: prepared.expires },
          { signal: deliveryController.signal },
        ),
        new Promise((_, reject) => {
          deliveryTimer = setTimeout(() => {
            timedOut = true;
            reject(new Error("timeout"));
            deliveryController.abort();
          }, 5000);
          deliveryTimer.unref();
        }),
      ]);
    } catch {
      sendOutcome = timedOut ? "uncertain" : "rejected";
    } finally {
      clearTimeout(deliveryTimer);
    }
    await this.tx(async (c) => {
      await c.query("SELECT id FROM auth_flows WHERE id=$1 FOR UPDATE", [
        prepared.flowId,
      ]);
      const changed = await c.query(
        "UPDATE auth_email_challenges SET send_outcome=$3,consumed_at=CASE WHEN $3='rejected' THEN $4 ELSE consumed_at END WHERE id=$1 AND generation=$2 AND consumed_at IS NULL RETURNING flow_id",
        [prepared.id, prepared.generation, sendOutcome, new Date(this.now())],
      );
      if (sendOutcome === "rejected" && changed.rowCount)
        await c.query("UPDATE auth_flows SET revoked_at=$2 WHERE id=$1", [
          prepared.flowId,
          new Date(this.now()),
        ]);
    });
    if (sendOutcome === "rejected")
      throw new AuthFault(
        503,
        "Email delivery is temporarily unavailable. Try again later.",
      );
    return {
      challenge_id: prepared.id,
      expires_in: Math.max(
        0,
        Math.floor((prepared.expires - this.now()) / 1000),
      ),
      resend_after: 60,
    };
  }
  async verify({ flowId, session, challengeId, otp, ip }) {
    await this.limits([["verify-ip", ip, 15 * minutes, 30]]);
    const now = this.now(),
      reauth = !!session;
    const result = await this.tx(async (c) => {
      if (reauth) {
        await c.query("SELECT id FROM auth_sessions WHERE id=$1 FOR UPDATE", [
          session.id,
        ]);
        const fresh = await this.session(session.rawToken, {
          touch: false,
          client: c,
        });
        if (!fresh || fresh.token_version !== session.token_version)
          return { fault: 401 };
      }
      const challengeFlow = reauth
        ? (
            await c.query(
              "SELECT flow_id FROM auth_email_challenges WHERE id=$1",
              [challengeId],
            )
          ).rows[0]?.flow_id
        : flowId;
      if (!challengeFlow) return { fault: 400 };
      const flow = (
        await c.query("SELECT * FROM auth_flows WHERE id=$1 FOR UPDATE", [
          challengeFlow,
        ])
      ).rows[0];
      if (
        !flow ||
        flow.revoked_at ||
        new Date(flow.expires_at).getTime() <= now ||
        flow.kind !== (reauth ? "reauth" : "preauth") ||
        (reauth &&
          (flow.session_id !== session.id ||
            flow.session_version !== session.token_version))
      )
        return { fault: 400 };
      const row = (
        await c.query(
          "SELECT * FROM auth_email_challenges WHERE id=$1 AND flow_id=$2 FOR UPDATE",
          [challengeId, flow.id],
        )
      ).rows[0];
      if (
        !row ||
        row.purpose !== (reauth ? "reauth" : "signin") ||
        row.consumed_at ||
        row.failures >= 5 ||
        new Date(row.expires_at).getTime() <= now
      )
        return { fault: 400 };
      if (
        !equal(
          row.code_hmac,
          mac(this.codeKey, row.id, row.generation, flow.id, row.purpose, otp),
        )
      ) {
        await c.query(
          "UPDATE auth_email_challenges SET failures=failures+1 WHERE id=$1",
          [row.id],
        );
        if (row.failures === 4)
          await c.query("UPDATE auth_flows SET revoked_at=$2 WHERE id=$1", [
            flow.id,
            new Date(now),
          ]);
        return { fault: 400 };
      }
      await c.query(
        "UPDATE auth_email_challenges SET consumed_at=$2 WHERE id=$1",
        [row.id, new Date(now)],
      );
      await c.query("UPDATE auth_flows SET revoked_at=$2 WHERE id=$1", [
        flow.id,
        new Date(now),
      ]);
      if (reauth) {
        if (row.canonical_email !== session.email) return { fault: 400 };
        const token = opaque();
        await c.query(
          "UPDATE auth_sessions SET token_hash=$2,token_version=token_version+1,last_verified_at=$3,last_seen_at=$3 WHERE id=$1",
          [session.id, digest(token), new Date(now)],
        );
        await c.query(
          "UPDATE auth_flows SET revoked_at=$2 WHERE session_id=$1",
          [session.id, new Date(now)],
        );
        await this.event(c, session.account_id, "reauthenticated");
        return {
          state: "signed_in",
          token,
          account: { id: session.account_id, email: session.email },
          expiresAt: new Date(session.expires_at).getTime(),
        };
      }
      await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
        row.canonical_email,
      ]);
      const matches = await c.query(
        "SELECT * FROM accounts WHERE lower(btrim(email))=$1 ORDER BY id FOR UPDATE",
        [row.canonical_email],
      );
      if (matches.rowCount > 1) return { state: "enrollment_required" };
      let account = matches.rows[0];
      if (!account && this.allowSignup) {
        const inserted = await c.query(
          "INSERT INTO accounts(email) VALUES($1) ON CONFLICT(email) DO NOTHING RETURNING *",
          [row.canonical_email],
        );
        account = inserted.rows[0];
        if (account) {
          await c.query("INSERT INTO wallets(account_id) VALUES($1)", [
            account.id,
          ]);
          await c.query(
            "INSERT INTO auth_email_identities(account_id,canonical_email,verified_at,enrollment_method) VALUES($1,$2,$3,'signup')",
            [account.id, account.email, new Date(now)],
          );
          await this.event(c, account.id, "registered");
        } else
          account = (
            await c.query("SELECT * FROM accounts WHERE email=$1 FOR UPDATE", [
              row.canonical_email,
            ])
          ).rows[0];
      }
      if (!account) return { state: "registration_closed" };
      const identity = (
        await c.query(
          "SELECT * FROM auth_email_identities WHERE account_id=$1 AND canonical_email=$2 FOR UPDATE",
          [account.id, row.canonical_email],
        )
      ).rows[0];
      if (
        account.role !== "user" ||
        this.serviceIds.has(account.id) ||
        !identity ||
        (identity.enrollment_method === "operator" &&
          (!identity.operator_approved_at ||
            row.issued_approval_id !== identity.approval_id))
      )
        return { state: "enrollment_required" };
      await c.query(
        "UPDATE auth_email_identities SET verified_at=$2 WHERE account_id=$1",
        [account.id, new Date(now)],
      );
      await c.query("UPDATE auth_flows SET revoked_at=$2 WHERE id=$1", [
        flow.id,
        new Date(now),
      ]);
      const token = opaque(),
        expiresAt = now + 7 * days;
      await c.query(
        "INSERT INTO auth_sessions(id,token_hash,account_id,created_at,last_seen_at,expires_at,last_verified_at) VALUES($1,$2,$3,$4,$4,$5,$4)",
        [uuid(), digest(token), account.id, new Date(now), new Date(expiresAt)],
      );
      await this.event(c, account.id, "signed_in");
      return {
        state: "signed_in",
        token,
        expiresAt,
        account: { id: account.id, email: account.email },
      };
    });
    if (result.fault)
      throw new AuthFault(
        result.fault,
        "That code is invalid or expired. Request a new code if needed.",
      );
    return result;
  }
  async event(c, accountId, event, actor = null, evidence = null) {
    await c.query(
      "INSERT INTO auth_security_events(account_id,event,actor_account_id,evidence_reference) VALUES($1,$2,$3,$4)",
      [accountId, event, actor, evidence],
    );
  }
  async logout(session, all = false) {
    if (!session) return;
    await this.tx(async (c) => {
      const rows = await c.query(
        "SELECT id FROM auth_sessions WHERE account_id=$1 AND ($2::boolean OR id=$3) ORDER BY id FOR UPDATE",
        [session.account_id, all, session.id],
      );
      const fresh = await this.session(session.rawToken, {
        touch: false,
        client: c,
      });
      if (!fresh) throw new AuthFault(401, "Sign in again.");
      if (
        all &&
        this.now() - new Date(fresh.last_verified_at).getTime() > 300000
      )
        throw new AuthFault(403, "Verify your email again before this action.");
      const now = new Date(this.now());
      for (const { id } of rows.rows) {
        await c.query("UPDATE auth_sessions SET revoked_at=$2 WHERE id=$1", [
          id,
          now,
        ]);
        await c.query(
          "UPDATE auth_flows SET revoked_at=$2 WHERE session_id=$1",
          [id, now],
        );
      }
      await this.event(
        c,
        session.account_id,
        all ? "signed_out_all" : "signed_out",
      );
    });
  }
  async cancel({ flowId, session }) {
    return this.tx(async (c) => {
      if (session)
        await c.query("SELECT id FROM auth_sessions WHERE id=$1 FOR UPDATE", [
          session.id,
        ]);
      const flows = await c.query(
        "SELECT id FROM auth_flows WHERE ($1::uuid IS NOT NULL AND id=$1) OR ($2::uuid IS NOT NULL AND session_id=$2 AND session_version=$3) ORDER BY id FOR UPDATE",
        [flowId || null, session?.id || null, session?.token_version || null],
      );
      for (const { id } of flows.rows) {
        await c.query("UPDATE auth_flows SET revoked_at=$2 WHERE id=$1", [
          id,
          new Date(this.now()),
        ]);
        await c.query(
          "UPDATE auth_email_challenges SET consumed_at=$2 WHERE flow_id=$1 AND consumed_at IS NULL",
          [id, new Date(this.now())],
        );
      }
    });
  }
  async purgeExpired() {
    return this.tx(async (c) => {
      const now = this.now(),
        proofCutoff = new Date(now - days),
        sessionCutoff = new Date(now - 30 * days);
      await c.query("DELETE FROM auth_rate_buckets WHERE expires_at<$1", [
        new Date(now),
      ]);
      await c.query(
        "DELETE FROM auth_email_challenges WHERE expires_at<$1 OR consumed_at<$1",
        [proofCutoff],
      );
      await c.query(
        "DELETE FROM auth_flows f WHERE (f.expires_at<$1 OR f.revoked_at<$1) AND NOT EXISTS(SELECT 1 FROM auth_email_challenges c WHERE c.flow_id=f.id)",
        [proofCutoff],
      );
      await c.query(
        "DELETE FROM auth_sessions s WHERE (s.expires_at<$1 OR s.revoked_at<$1) AND NOT EXISTS(SELECT 1 FROM auth_flows f WHERE f.session_id=s.id)",
        [sessionCutoff],
      );
      await c.query(
        "DELETE FROM auth_security_events WHERE created_at<$1 AND event<>'enrollment_approved'",
        [sessionCutoff],
      );
    });
  }
  async approveEnrollment({
    operatorId,
    accountId,
    expectedEmail,
    evidenceReference,
    ownershipVerified,
    classification,
  }) {
    if (
      !ownershipVerified ||
      classification !== "ordinary-user" ||
      typeof evidenceReference !== "string" ||
      !/^[-A-Za-z0-9_:/\.]{3,200}$/.test(evidenceReference)
    )
      throw new AuthFault(
        400,
        "Explicit ownership verification and evidence reference required.",
      );
    return this.tx(async (c) => {
      const actor = (
        await c.query("SELECT id FROM accounts WHERE id=$1 AND role='admin'", [
          operatorId,
        ])
      ).rows[0];
      if (!actor) throw new AuthFault(403, "Operator authorization required.");
      const target = (
        await c.query("SELECT * FROM accounts WHERE id=$1 FOR UPDATE", [
          accountId,
        ])
      ).rows[0];
      if (
        !target ||
        target.role !== "user" ||
        this.serviceIds.has(accountId) ||
        target.email !== normalizeEmail(expectedEmail)
      )
        throw new AuthFault(403, "Account is not eligible for enrollment.");
      const exists = (
        await c.query(
          "SELECT 1 FROM auth_email_identities WHERE account_id=$1",
          [accountId],
        )
      ).rowCount;
      if (exists)
        throw new AuthFault(409, "Account enrollment already recorded.");
      await c.query(
        "INSERT INTO auth_email_identities(account_id,canonical_email,enrollment_method,operator_approved_by,operator_approved_at) VALUES($1,$2,'operator',$3,$4)",
        [accountId, target.email, operatorId, new Date(this.now())],
      );
      await this.event(
        c,
        accountId,
        "enrollment_approved",
        operatorId,
        evidenceReference,
      );
      return { approved: true };
    });
  }
}
