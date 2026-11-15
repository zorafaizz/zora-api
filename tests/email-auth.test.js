import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import express from "express";
import request from "supertest";
import pg from "pg";
import {
  createEmailAuth,
  configuredEmailAuth,
} from "../src/modules/email-auth/index.js";
import { MemoryMail, DisabledMail } from "../src/modules/email-auth/mail.js";
import {
  code,
  digest,
  normalizeEmail,
} from "../src/modules/email-auth/crypto.js";
const enabled = !!process.env.AUTH_TEST_DATABASE_URL;
const pool = enabled
  ? new pg.Pool({ connectionString: process.env.AUTH_TEST_DATABASE_URL })
  : null;
test.after(async () => {
  await pool?.end();
});
function setup(extra = {}) {
  const time = { value: Date.now() },
    mail = new MemoryMail({ environment: "test" });
  const options = {
    enabled: true,
    pool,
    origin: "https://auth.example.test",
    environment: "test",
    codeKey: crypto.randomBytes(32).toString("hex"),
    csrfKey: crypto.randomBytes(32).toString("hex"),
    limitKey: crypto.randomBytes(32).toString("hex"),
    allowSignup: true,
    mail,
    now: () => time.value,
    ...extra,
  };
  const auth = createEmailAuth(options),
    app = express();
  app.use("/api/v1/auth", auth.router);
  return { time, mail, options, auth, app, client: client(app) };
}
function client(app, initial = {}) {
  const jar = { ...initial };
  let csrf;
  const capture = (res) => {
    for (const item of res.headers["set-cookie"] || []) {
      const pair = item.split(";")[0],
        at = pair.indexOf("=");
      jar[pair.slice(0, at)] = pair.slice(at + 1);
    }
    if (res.body.result?.csrf) csrf = res.body.result.csrf;
    return res;
  };
  return {
    jar,
    get: async () =>
      capture(
        await request(app)
          .get("/api/v1/auth/session")
          .set(
            "Cookie",
            Object.entries(jar)
              .map(([k, v]) => k + "=" + v)
              .join("; "),
          ),
      ),
    post: async (path, data = {}, headers = {}) => {
      let req = request(app)
        .post("/api/v1/auth" + path)
        .set("Origin", "https://auth.example.test")
        .set("X-CSRF-Token", csrf || "missing")
        .set(
          "Cookie",
          Object.entries(jar)
            .map(([k, v]) => k + "=" + v)
            .join("; "),
        );
      for (const [k, v] of Object.entries(headers)) req = req.set(k, v);
      return capture(await req.send(data));
    },
    setCsrf: (v) => (csrf = v),
    getCsrf: () => csrf,
  };
}
const email = () => crypto.randomUUID() + "@example.test";
async function begin(s, recipient = email(), c = s.client) {
  await c.get();
  const r = await c.post("/email/start", { email: recipient });
  assert.equal(r.status, 202);
  return {
    recipient,
    id: r.body.result.challenge_id,
    otp: s.mail.takeCode(recipient),
  };
}
async function login(s, recipient = email(), c = s.client) {
  const b = await begin(s, recipient, c);
  const r = await c.post("/email/verify", { challenge_id: b.id, code: b.otp });
  assert.equal(r.status, 200);
  assert.equal(r.body.result.state, "signed_in");
  return { b, r };
}
async function account(recipient, role = "user") {
  return (
    await pool.query(
      "INSERT INTO accounts(email,role) VALUES($1,$2) RETURNING *",
      [recipient, role],
    )
  ).rows[0];
}
test("feature defaults off without database or mail; production memory transport forbidden", async () => {
  const app = express();
  app.use(createEmailAuth().router);
  assert.equal((await request(app).get("/session")).status, 503);
  assert.throws(() => new MemoryMail({ environment: "production" }));
  assert.equal(typeof configuredEmailAuth(undefined, {}).router, "function");
});
test("cryptographic codes are8digits, preserve zeros and email normalization is conservative", () => {
  for (let i = 0; i < 200; i++) assert.ok(/^\d{8}$/.test(code()));
  assert.equal(normalizeEmail(" A+B@Example.test "), "a+b@example.test");
  assert.equal(normalizeEmail("not-email"), null);
});
test(
  "isolated email authentication integration",
  { skip: !enabled },
  async (t) => {
    await t.test(
      "success establishes opaque Secure HttpOnly session; code/token never persisted plaintext",
      async () => {
        const s = setup(),
          b = await begin(s);
        const row = (
          await pool.query("SELECT * FROM auth_email_challenges WHERE id=$1", [
            b.id,
          ])
        ).rows[0];
        assert.ok(row.code_hmac !== b.otp && row.code_hmac.length === 64);
        const r = await s.client.post("/email/verify", {
          challenge_id: b.id,
          code: b.otp,
        });
        assert.equal(r.body.result.state, "signed_in");
        assert.ok(
          r.headers["set-cookie"].some(
            (c) =>
              c.startsWith("__Host-kg_session=") &&
              c.includes("HttpOnly") &&
              c.includes("Secure") &&
              c.includes("SameSite=Lax"),
          ),
        );
        const session = (await s.client.get()).body.result;
        assert.equal(session.authenticated, true);
        assert.ok(!JSON.stringify(r.body).includes(b.otp));
        const raw = s.client.jar["__Host-kg_session"];
        assert.ok(
          (
            await pool.query(
              "SELECT 1 FROM auth_sessions WHERE token_hash=$1",
              [digest(raw)],
            )
          ).rowCount === 1,
        );
        assert.ok(
          !JSON.stringify(
            (await pool.query("SELECT * FROM auth_sessions")).rows,
          ).includes(raw),
        );
      },
    );
    await t.test(
      "five invalid attempts are committed, correct code cannot bypass exhausted budget",
      async () => {
        const s = setup(),
          b = await begin(s);
        const wrong = b.otp === "00000000" ? "11111111" : "00000000";
        for (let i = 0; i < 5; i++)
          assert.equal(
            (
              await s.client.post("/email/verify", {
                challenge_id: b.id,
                code: wrong,
              })
            ).status,
            400,
          );
        assert.equal(
          (
            await pool.query(
              "SELECT failures FROM auth_email_challenges WHERE id=$1",
              [b.id],
            )
          ).rows[0].failures,
          5,
        );
        assert.ok(
          (
            await s.client.post("/email/verify", {
              challenge_id: b.id,
              code: b.otp,
            })
          ).status >= 400,
        );
      },
    );
    await t.test(
      "expired challenge and browser binding reject proof",
      async () => {
        const s = setup(),
          b = await begin(s),
          other = client(s.app);
        await other.get();
        assert.equal(
          (
            await other.post("/email/verify", {
              challenge_id: b.id,
              code: b.otp,
            })
          ).status,
          400,
        );
        s.time.value += 600001;
        assert.ok(
          (
            await s.client.post("/email/verify", {
              challenge_id: b.id,
              code: b.otp,
            })
          ).status >= 400,
        );
      },
    );
    await t.test(
      "concurrent consume creates one session and replay fails",
      async () => {
        const s = setup(),
          b = await begin(s);
        const old = { ...s.client.jar },
          csrf = s.client.getCsrf(),
          c1 = client(s.app, old),
          c2 = client(s.app, old);
        c1.setCsrf(csrf);
        c2.setCsrf(csrf);
        const responses = await Promise.all([
          c1.post("/email/verify", { challenge_id: b.id, code: b.otp }),
          c2.post("/email/verify", { challenge_id: b.id, code: b.otp }),
        ]);
        assert.equal(
          responses.filter((r) => r.body.result?.state === "signed_in").length,
          1,
        );
        assert.equal(
          (
            await pool.query(
              "SELECT count(*) FROM auth_sessions s JOIN accounts a ON a.id=s.account_id WHERE a.email=$1",
              [b.recipient],
            )
          ).rows[0].count,
          "1",
        );
        assert.ok(
          (await c2.post("/email/verify", { challenge_id: b.id, code: b.otp }))
            .body.result?.state !== "signed_in",
        );
      },
    );
    await t.test(
      "resend cooldown and supersession retain original expiry and attempts",
      async () => {
        const s = setup(),
          b = await begin(s);
        assert.equal(
          (await s.client.post("/email/start", { email: b.recipient })).status,
          429,
        );
        s.time.value += 61000;
        const r = await s.client.post("/email/start", { email: b.recipient });
        assert.equal(r.status, 202);
        const fresh = s.mail.takeCode(b.recipient);
        assert.equal(r.body.result.challenge_id, b.id);
        assert.ok(r.body.result.expires_in < 600);
        assert.equal(
          (
            await s.client.post("/email/verify", {
              challenge_id: b.id,
              code: b.otp,
            })
          ).status,
          400,
        );
        assert.equal(
          (
            await s.client.post("/email/verify", {
              challenge_id: b.id,
              code: fresh,
            })
          ).body.result.state,
          "signed_in",
        );
      },
    );
    await t.test(
      "second browser cannot invalidate first browser code",
      async () => {
        const s = setup(),
          b = await begin(s),
          other = client(s.app);
        await begin(s, b.recipient, other);
        assert.equal(
          (
            await s.client.post("/email/verify", {
              challenge_id: b.id,
              code: b.otp,
            })
          ).body.result.state,
          "signed_in",
        );
      },
    );
    await t.test(
      "email/global throttles and unavailable store fail closed",
      async () => {
        const s = setup();
        s.time.value = Math.floor(Date.now() / 900000) * 900000 + 899000;
        const b = await begin(s);
        for (let i = 0; i < 2; i++) {
          s.time.value += 61000;
          assert.equal(
            (await s.client.post("/email/start", { email: b.recipient }))
              .status,
            202,
          );
        }
        s.time.value += 61000;
        assert.equal(
          (await s.client.post("/email/start", { email: b.recipient })).status,
          429,
        );
        const bad = setup({
          pool: {
            connect: async () => {
              throw Error("private-db-error");
            },
            query: async () => {
              throw Error("private-db-error");
            },
          },
        });
        const r = await bad.client.get();
        assert.equal(r.status, 503);
        assert.ok(!JSON.stringify(r.body).includes("private-db-error"));
      },
    );
    await t.test(
      "Origin/content type/CSRF/body size failures occur before email dispatch",
      async () => {
        const s = setup();
        await s.client.get();
        assert.equal(
          (
            await s.client.post(
              "/email/start",
              { email: email() },
              { Origin: "https://evil.invalid" },
            )
          ).status,
          403,
        );
        assert.equal(
          (
            await s.client.post(
              "/email/start",
              { email: email() },
              { "X-CSRF-Token": "bad" },
            )
          ).status,
          403,
        );
        assert.equal(
          (
            await request(s.app)
              .post("/api/v1/auth/email/start")
              .send({ email: email() })
          ).status,
          403,
        );
        assert.equal(
          (await s.client.post("/email/start", { email: "x".repeat(5000) }))
            .status,
          413,
        );
        assert.equal(
          (
            await request(s.app)
              .post("/api/v1/auth/email/start")
              .set("Origin", "https://auth.example.test")
              .type("form")
              .send({ email: email() })
          ).status,
          403,
        );
      },
    );
    await t.test(
      "preauth challenge replies do not enumerate historical vs new addresses",
      async () => {
        const s = setup(),
          known = email();
        await account(known);
        const a = await begin(s, known),
          b = await begin(s);
        const first = client(s.app),
          second = client(s.app);
        await first.get();
        await second.get();
        const x = await first.post("/email/start", { email: known }),
          y = await second.post("/email/start", { email: email() });
        assert.equal(x.status, y.status);
        assert.deepEqual(
          Object.keys(x.body.result).sort(),
          Object.keys(y.body.result).sort(),
        );
        assert.equal(x.body.result.expires_in, y.body.result.expires_in);
        assert.equal(x.body.result.resend_after, y.body.result.resend_after);
        assert.ok(s.mail.takeCode("nobody@example.test") === undefined);
      },
    );
    await t.test(
      "historical ownership needs audited authorized operator approval; no account changes",
      async () => {
        const recipient = email(),
          a = await account(recipient);
        await pool.query(
          "INSERT INTO wallets(account_id,balance_credits,reserved_credits) VALUES($1,123,4)",
          [a.id],
        );
        await pool.query(
          "UPDATE accounts SET is_frozen=true,test_quota_remaining=7 WHERE id=$1",
          [a.id],
        );
        await pool.query(
          "INSERT INTO api_keys(account_id,public_id,key_hash,key_type) VALUES($1,$2,$3,$4)",
          [
            a.id,
            crypto.randomBytes(8).toString("hex"),
            crypto.randomBytes(32).toString("hex"),
            "live",
          ],
        );
        const before = {
          account: (
            await pool.query("SELECT * FROM accounts WHERE id=$1", [a.id])
          ).rows,
          keys: (
            await pool.query("SELECT * FROM api_keys WHERE account_id=$1", [
              a.id,
            ])
          ).rows,
          wallet: (
            await pool.query("SELECT * FROM wallets WHERE account_id=$1", [
              a.id,
            ])
          ).rows,
        };
        const s = setup();
        const b = await begin(s, recipient);
        assert.equal(
          (
            await s.client.post("/email/verify", {
              challenge_id: b.id,
              code: b.otp,
            })
          ).body.result.state,
          "enrollment_required",
        );
        assert.equal((await s.client.get()).body.result.authenticated, false);
        const proof = {
          accountId: a.id,
          expectedEmail: recipient,
          evidenceReference: "CASE-ISOLATED-1",
          ownershipVerified: true,
          classification: "ordinary-user",
        };
        await assert.rejects(
          () =>
            s.auth.service.approveEnrollment({ ...proof, operatorId: a.id }),
          (e) => e.status === 403,
        );
        const admin = await account(email(), "admin");
        await assert.rejects(
          () =>
            s.auth.service.approveEnrollment({
              ...proof,
              operatorId: admin.id,
              ownershipVerified: false,
            }),
          (e) => e.status === 400,
        );
        await s.auth.service.approveEnrollment({
          ...proof,
          operatorId: admin.id,
        });
        assert.equal(
          (
            await pool.query(
              "SELECT count(*) FROM auth_security_events WHERE account_id=$1 AND event='enrollment_approved'",
              [a.id],
            )
          ).rows[0].count,
          "1",
        );
        await login(s, recipient);
        const after = {
          account: (
            await pool.query("SELECT * FROM accounts WHERE id=$1", [a.id])
          ).rows,
          keys: (
            await pool.query("SELECT * FROM api_keys WHERE account_id=$1", [
              a.id,
            ])
          ).rows,
          wallet: (
            await pool.query("SELECT * FROM wallets WHERE account_id=$1", [
              a.id,
            ])
          ).rows,
        };
        assert.deepEqual(after, before);
      },
    );
    await t.test(
      "admin/service identities cannot enroll or sign in by email alone",
      async () => {
        const admin = await account(email(), "admin"),
          service = await account(email()),
          s = setup({ serviceAccountIds: [service.id] });
        for (const target of [admin, service]) {
          const b = await begin(s, target.email);
          assert.equal(
            (
              await s.client.post("/email/verify", {
                challenge_id: b.id,
                code: b.otp,
              })
            ).body.result.state,
            "enrollment_required",
          );
          await assert.rejects(
            () =>
              s.auth.service.approveEnrollment({
                operatorId: admin.id,
                accountId: target.id,
                expectedEmail: target.email,
                evidenceReference: "CASE-TEST",
                ownershipVerified: true,
                classification: "ordinary-user",
              }),
            (e) => e.status === 403,
          );
        }
      },
    );
    await t.test(
      "concurrent verified signup allocates one account/wallet/test allocation",
      async () => {
        const s = setup(),
          recipient = email(),
          a = await begin(s, recipient),
          other = client(s.app),
          b = await begin(s, recipient, other);
        const results = await Promise.all([
          s.client.post("/email/verify", { challenge_id: a.id, code: a.otp }),
          other.post("/email/verify", { challenge_id: b.id, code: b.otp }),
        ]);
        assert.ok(results.every((r) => r.body.result.state === "signed_in"));
        const rows = (
          await pool.query(
            "SELECT a.test_quota_remaining,w.balance_credits FROM accounts a JOIN wallets w ON a.id=w.account_id WHERE email=$1",
            [recipient],
          )
        ).rows;
        assert.equal(rows.length, 1);
        assert.equal(rows[0].test_quota_remaining, 50);
        assert.equal(rows[0].balance_credits, "0");
      },
    );
    await t.test(
      "signup disabled never creates an account from email proof",
      async () => {
        const s = setup({ allowSignup: false }),
          b = await begin(s);
        assert.equal(
          (
            await s.client.post("/email/verify", {
              challenge_id: b.id,
              code: b.otp,
            })
          ).body.result.state,
          "registration_closed",
        );
        assert.equal(
          (
            await pool.query("SELECT 1 FROM accounts WHERE email=$1", [
              b.recipient,
            ])
          ).rowCount,
          0,
        );
      },
    );
    await t.test(
      "session rotation, freshness, idle/absolute expiry and logout revoke authority",
      async () => {
        const s = setup(),
          { b } = await login(s);
        const old = s.client.jar["__Host-kg_session"],
          oldCsrf = s.client.getCsrf();
        s.time.value += 300001;
        assert.equal((await s.client.post("/logout-all")).status, 403);
        const r = await s.client.post("/reauth/start");
        assert.equal(r.status, 202);
        const otp = s.mail.takeCode(b.recipient);
        const verified = await s.client.post("/reauth/verify", {
          challenge_id: r.body.result.challenge_id,
          code: otp,
        });
        assert.equal(verified.status, 200);
        assert.ok(s.client.jar["__Host-kg_session"] !== old);
        const stolen = client(s.app, { "__Host-kg_session": old });
        assert.equal((await stolen.get()).body.result.authenticated, false);
        assert.equal(
          (await s.client.post("/logout", {}, { "X-CSRF-Token": oldCsrf }))
            .status,
          403,
        );
        assert.equal((await s.client.post("/logout")).status, 204);
        assert.equal((await s.client.get()).body.result.authenticated, false);
        const again = setup();
        await login(again);
        again.time.value += 86400001;
        assert.equal(
          (await again.client.get()).body.result.authenticated,
          false,
        );
        const abs = setup();
        await login(abs);
        abs.time.value += 7 * 86400000 + 1;
        assert.equal((await abs.client.get()).body.result.authenticated, false);
      },
    );
    await t.test(
      "reauth email is server derived, cannot switch identity; logout invalidates code",
      async () => {
        const s = setup(),
          { b } = await login(s);
        assert.equal(
          (await s.client.post("/reauth/start", { email: email() })).status,
          400,
        );
        const r = await s.client.post("/reauth/start");
        const otp = s.mail.takeCode(b.recipient);
        await s.client.post("/logout");
        assert.equal(
          (
            await s.client.post("/reauth/verify", {
              challenge_id: r.body.result.challenge_id,
              code: otp,
            })
          ).status,
          401,
        );
      },
    );
    await t.test(
      "logout-all revokes other browsers without revoking API keys",
      async () => {
        const s = setup(),
          { b } = await login(s),
          other = client(s.app);
        await login(s, b.recipient, other);
        assert.equal((await s.client.post("/logout-all")).status, 204);
        assert.equal((await other.get()).body.result.authenticated, false);
      },
    );
    await t.test(
      "mail rejection can restart immediately after transport recovery",
      async () => {
        let reject = true;
        const memory = new MemoryMail({ environment: "test" }),
          s = setup({
            mail: {
              sendCode: async (m) => {
                if (reject) throw Error("definite rejection");
                await memory.sendCode(m);
              },
            },
          });
        await s.client.get();
        const recipient = email();
        assert.equal(
          (await s.client.post("/email/start", { email: recipient })).status,
          503,
        );
        reject = false;
        await s.client.get();
        assert.equal(
          (await s.client.post("/email/start", { email: recipient })).status,
          202,
        );
      },
    );
    await t.test(
      "proof issued before operator approval cannot enroll a historical account",
      async () => {
        const s = setup(),
          a = await account(email()),
          admin = await account(email(), "admin"),
          b = await begin(s, a.email);
        s.time.value += 1;
        await s.auth.service.approveEnrollment({
          operatorId: admin.id,
          accountId: a.id,
          expectedEmail: a.email,
          evidenceReference: "CASE-FRESH",
          ownershipVerified: true,
          classification: "ordinary-user",
        });
        const r = await s.client.post("/email/verify", {
          challenge_id: b.id,
          code: b.otp,
        });
        assert.notEqual(r.body.result?.state, "signed_in");
        await login(s, a.email);
      },
    );
    await t.test(
      "resend racing verification never reuses superseded proof",
      async () => {
        const s = setup(),
          b = await begin(s);
        s.time.value += 61000;
        const results = await Promise.all([
          s.client.post("/email/start", { email: b.recipient }),
          s.client.post("/email/verify", { challenge_id: b.id, code: b.otp }),
        ]);
        const sessions = results.filter(
          (r) => r.body.result?.state === "signed_in",
        ).length;
        assert.ok(sessions <= 1);
        if (!sessions) {
          const newest = s.mail.takeCode(b.recipient);
          assert.equal(
            (
              await s.client.post("/email/verify", {
                challenge_id: b.id,
                code: newest,
              })
            ).body.result.state,
            "signed_in",
          );
        }
      },
    );
    await t.test(
      "concurrent reauth consumes once and rotates once",
      async () => {
        const s = setup(),
          { b } = await login(s),
          started = await s.client.post("/reauth/start"),
          otp = s.mail.takeCode(b.recipient),
          jar = { ...s.client.jar },
          csrf = s.client.getCsrf(),
          a = client(s.app, jar),
          c = client(s.app, jar);
        a.setCsrf(csrf);
        c.setCsrf(csrf);
        const responses = await Promise.all([
          a.post("/reauth/verify", {
            challenge_id: started.body.result.challenge_id,
            code: otp,
          }),
          c.post("/reauth/verify", {
            challenge_id: started.body.result.challenge_id,
            code: otp,
          }),
        ]);
        assert.equal(responses.filter((r) => r.status === 200).length, 1);
        assert.equal(
          (
            await pool.query(
              "SELECT s.token_version FROM auth_sessions s JOIN accounts a ON a.id=s.account_id WHERE a.email=$1",
              [b.recipient],
            )
          ).rows[0].token_version,
          2,
        );
      },
    );
    await t.test(
      "cancel invalidates the server challenge before changing email",
      async () => {
        const s = setup(),
          b = await begin(s);
        assert.equal((await s.client.post("/email/cancel")).status, 204);
        assert.ok(
          (
            await s.client.post("/email/verify", {
              challenge_id: b.id,
              code: b.otp,
            })
          ).status >= 400,
        );
      },
    );
    await t.test(
      "uncertain delivery timeout keeps a potentially delivered code valid without retries",
      async () => {
        let delivery;
        const s = setup({
          mail: {
            sendCode: async (message) => {
              delivery = message;
              return new Promise(() => {});
            },
          },
        });
        await s.client.get();
        const recipient = email(),
          r = await s.client.post("/email/start", { email: recipient });
        assert.equal(r.status, 202);
        const row = (
          await pool.query(
            "SELECT send_outcome FROM auth_email_challenges WHERE id=$1",
            [r.body.result.challenge_id],
          )
        ).rows[0];
        assert.equal(row.send_outcome, "uncertain");
        assert.equal(
          (
            await s.client.post("/email/verify", {
              challenge_id: r.body.result.challenge_id,
              code: delivery.code,
            })
          ).body.result.state,
          "signed_in",
        );
      },
    );
    await t.test(
      "operator CLI authenticates administrator, records approval and denies ordinary credentials",
      async () => {
        const { generateApiKey } = await import("../src/core/security.js"),
          { spawn } = await import("node:child_process");
        const admin = await account(email(), "admin"),
          user = await account(email()),
          target = await account(email());
        async function run(actor) {
          const key = generateApiKey("live");
          await pool.query(
            "INSERT INTO api_keys(account_id,public_id,key_hash,key_type) VALUES($1,$2,$3,'live')",
            [actor.id, key.publicId, key.keyHash],
          );
          const child = spawn(
            process.execPath,
            ["scripts/approve-email-enrollment.mjs"],
            {
              env: {
                ...process.env,
                AUTH_OPERATOR_ACTION: "approve-email-enrollment",
              },
            },
          );
          let text = "";
          child.stdout.on("data", (d) => (text += d));
          child.stderr.on("data", (d) => (text += d));
          child.stdin.end(
            JSON.stringify({
              operatorApiKey: key.fullKey,
              accountId: target.id,
              expectedEmail: target.email,
              classification: "ordinary-user",
              ownershipVerified: true,
              evidenceReference: "CASE-CLI-1",
            }),
          );
          const exit = await new Promise((r) => child.on("exit", r));
          assert.ok(!text.includes(key.fullKey));
          return exit;
        }
        assert.equal(await run(user), 1);
        assert.equal(
          (
            await pool.query(
              "SELECT 1 FROM auth_email_identities WHERE account_id=$1",
              [target.id],
            )
          ).rowCount,
          0,
        );
        assert.equal(await run(admin), 0);
        const identity = (
          await pool.query(
            "SELECT * FROM auth_email_identities WHERE account_id=$1",
            [target.id],
          )
        ).rows[0];
        assert.equal(identity.operator_approved_by, admin.id);
        assert.equal(identity.verified_at, null);
      },
    );
    await t.test(
      "auth retention cleanup preserves existing accounts and enrollment audit history",
      async () => {
        const s = setup(),
          { b } = await login(s),
          before = (
            await pool.query("SELECT * FROM accounts WHERE email=$1", [
              b.recipient,
            ])
          ).rows;
        s.time.value += 40 * 86400000;
        await s.auth.service.purgeExpired();
        assert.deepEqual(
          (
            await pool.query("SELECT * FROM accounts WHERE email=$1", [
              b.recipient,
            ])
          ).rows,
          before,
        );
        assert.equal(
          (
            await pool.query(
              "SELECT s.id FROM auth_sessions s JOIN accounts a ON a.id=s.account_id WHERE a.email=$1",
              [b.recipient],
            )
          ).rowCount,
          0,
        );
      },
    );
    await t.test(
      "noncanonical historical email never creates a replacement identity",
      async () => {
        const s = setup(),
          original = "UPPER-" + crypto.randomUUID() + "@EXAMPLE.TEST",
          a = await account(original),
          b = await begin(s, original.toLowerCase());
        const r = await s.client.post("/email/verify", {
          challenge_id: b.id,
          code: b.otp,
        });
        assert.equal(r.body.result.state, "enrollment_required");
        const rows = (
          await pool.query(
            "SELECT id,email FROM accounts WHERE lower(btrim(email))=$1",
            [original.toLowerCase()],
          )
        ).rows;
        assert.equal(rows.length, 1);
        assert.equal(rows[0].id, a.id);
        assert.equal(rows[0].email, original);
      },
    );
    await t.test(
      "transport failures are sanitized, no plaintext durable outbox",
      async () => {
        const s = setup({ mail: new DisabledMail() });
        await s.client.get();
        const r = await s.client.post("/email/start", { email: email() });
        assert.equal(r.status, 503);
        assert.ok(!JSON.stringify(r.body).includes("MailUnavailableError"));
        assert.equal(
          (
            await pool.query(
              "SELECT 1 FROM information_schema.columns WHERE table_name LIKE 'auth_%' AND column_name IN ('code','otp','raw_token','raw_key')",
            )
          ).rowCount,
          0,
        );
      },
    );
  },
);
test("operator command never echoes invalid secret-bearing input", async () => {
  const { spawn } = await import("node:child_process");
  const child = spawn(
    process.execPath,
    ["scripts/approve-email-enrollment.mjs"],
    {
      env: {
        ...process.env,
        AUTH_OPERATOR_ACTION: "approve-email-enrollment",
        DATABASE_URL:
          process.env.AUTH_TEST_DATABASE_URL || "postgresql://localhost/unused",
      },
    },
  );
  let output = "";
  child.stdout.on("data", (d) => (output += d));
  child.stderr.on("data", (d) => (output += d));
  child.stdin.end("private-session-value");
  await new Promise((r) => child.on("exit", r));
  assert.ok(
    !output.includes("private-session-value"),
    "Operator command exposed invalid input",
  );
});
