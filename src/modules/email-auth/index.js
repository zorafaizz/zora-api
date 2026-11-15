import express from "express";
import net from "node:net";
import { EmailAuthService, AuthFault } from "./service.js";
import { equal, validId } from "./crypto.js";
import { DisabledMail, MemoryMail } from "./mail.js";
export function createEmailAuth(options = {}) {
  const { enabled = false } = options;
  const router = express.Router();
  router.use((req, res, next) => {
    res.set({
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
    });
    next();
  });
  const failure = (res, status, message) =>
    res
      .status(status)
      .json({
        status: false,
        creator: "KanjutGede",
        error: message,
        message,
        code: "AUTH_REQUEST_FAILED",
      });
  if (!enabled) {
    router.use((req, res) =>
      failure(
        res,
        503,
        "Email sign-in is not enabled. The manual API-key playground remains available.",
      ),
    );
    return { router };
  }
  const {
    pool,
    origin,
    codeKey,
    csrfKey,
    limitKey,
    allowInsecureLocal = false,
    environment = process.env.NODE_ENV || "production",
    trustedProxyIps = [],
  } = options;
  const url = new URL(origin);
  if (url.origin !== origin || !pool)
    throw new Error("Auth requires a canonical origin and database.");
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  const insecure =
    allowInsecureLocal &&
    environment !== "production" &&
    local &&
    url.protocol === "http:";
  if (url.protocol !== "https:" && !insecure)
    throw new Error(
      "Authentication requires HTTPS except explicit local test configuration.",
    );
  for (const key of [codeKey, csrfKey, limitKey])
    if (typeof key !== "string" || key.length < 32)
      throw new Error(
        "Dedicated auth secrets of at least32characters are required.",
      );
  if (new Set([codeKey, csrfKey, limitKey]).size !== 3)
    throw new Error("Auth secrets must be independent.");
  if (trustedProxyIps.some((ip) => !net.isIP(ip)))
    throw new Error("Auth trusted proxies must be explicit IP addresses.");
  const service = new EmailAuthService({
    ...options,
    mail: options.mail || new DisabledMail(),
  });
  const names = {
    session: insecure ? "kg_local_session" : "__Host-kg_session",
    preauth: insecure ? "kg_local_preauth" : "__Host-kg_preauth",
  };
  const cookieOptions = {
    httpOnly: true,
    secure: !insecure,
    sameSite: "lax",
    path: "/",
  };
  const setCookie = (res, name, value, ttl) =>
    res.cookie(name, value, {
      ...cookieOptions,
      sameSite: name === names.preauth ? "strict" : "lax",
      maxAge: ttl,
    });
  const clear = (res, name) =>
    res.clearCookie(name, {
      ...cookieOptions,
      sameSite: name === names.preauth ? "strict" : "lax",
    });
  const getCookies = (req) => {
    const text = req.headers.cookie || "";
    if (text.length > 8192) throw new AuthFault(400, "Invalid cookie header.");
    const values = {};
    for (const item of text.split(";")) {
      const at = item.indexOf("=");
      if (at < 0) continue;
      const name = item.slice(0, at).trim();
      if (!Object.values(names).includes(name)) continue;
      if (Object.hasOwn(values, name))
        throw new AuthFault(400, "Duplicate auth cookie.");
      values[name] = item.slice(at + 1).trim();
    }
    return values;
  };
  const ip = (req) => {
    const peer = req.socket.remoteAddress?.replace(/^::ffff:/, "") || "unknown";
    if (!trustedProxyIps.includes(peer)) return peer;
    const forwarded = req.headers["x-forwarded-for"];
    if (typeof forwarded !== "string" || forwarded.length > 512) return peer;
    const last = forwarded.split(",").at(-1).trim();
    return net.isIP(last) ? last : peer;
  };
  const ok = (res, result, status = 200) =>
    res
      .status(status)
      .json({ status: true, creator: "KanjutGede", result, data: result });
  router.use((req, res, next) => {
    if (req.method !== "GET" && req.method !== "POST")
      throw new AuthFault(405, "Method not allowed.");
    if (req.headers.origin && req.headers.origin !== origin)
      throw new AuthFault(403, "Same-origin request required.");
    if (req.headers["sec-fetch-site"] === "cross-site")
      throw new AuthFault(403, "Same-origin request required.");
    if (
      req.method === "POST" &&
      (req.headers.origin !== origin || !req.is("application/json"))
    )
      throw new AuthFault(403, "Same-origin JSON request required.");
    next();
  });
  router.use(express.json({ limit: "4kb", strict: true }));
  router.use(async (req, res, next) => {
    req.authCookies = getCookies(req);
    const token = req.authCookies[names.session];
    const session = await service.session(token, { touch: false });
    req.emailSession = session ? { ...session, rawToken: token } : null;
    next();
  });
  router.get("/session", async (req, res) => {
    await service.limits([["bootstrap-ip", ip(req), 60000, 60]]);
    if (req.emailSession) {
      const s = req.emailSession;
      await service.session(s.rawToken);
      return ok(res, {
        authenticated: true,
        account: { id: s.account_id, email: s.email },
        csrf: service.csrf(s.rawToken, "session"),
        fresh: service.now() - new Date(s.last_verified_at).getTime() < 300000,
      });
    }
    clear(res, names.session);
    const { token } = await service.bootstrap(req.authCookies[names.preauth]);
    setCookie(res, names.preauth, token, 600000);
    ok(res, { authenticated: false, csrf: service.csrf(token, "preauth") });
  });
  async function context(req, sessionRequired = false) {
    const s = req.emailSession;
    if (sessionRequired && !s) throw new AuthFault(401, "Sign in again.");
    if (s) {
      if (!equal(req.get("X-CSRF-Token"), service.csrf(s.rawToken, "session")))
        throw new AuthFault(403, "Refresh this page before trying again.");
      return { session: s };
    }
    const token = req.authCookies[names.preauth],
      flow = await service.preauth(token);
    if (
      !flow ||
      !equal(req.get("X-CSRF-Token"), service.csrf(token, "preauth"))
    )
      throw new AuthFault(403, "Refresh this page before trying again.");
    return { flowId: flow.id };
  }
  function verifyBody(req, allowed) {
    if (
      !req.body ||
      typeof req.body !== "object" ||
      Array.isArray(req.body) ||
      Object.keys(req.body).some((k) => !allowed.includes(k))
    )
      throw new AuthFault(400, "Invalid request.");
  }
  router.post("/email/start", async (req, res) => {
    verifyBody(req, ["email"]);
    const ctx = await context(req);
    if (ctx.session)
      throw new AuthFault(409, "Sign out before signing into another account.");
    ok(
      res,
      await service.start({ ...ctx, email: req.body.email, ip: ip(req) }),
      202,
    );
  });
  const verify = (reauth) => async (req, res) => {
    verifyBody(req, ["challenge_id", "code"]);
    const ctx = await context(req, reauth);
    if (!reauth && ctx.session) throw new AuthFault(409, "Already signed in.");
    if (
      !validId(req.body.challenge_id) ||
      typeof req.body.code !== "string" ||
      !/^\d{8}$/.test(req.body.code)
    )
      throw new AuthFault(
        400,
        "That code is invalid or expired. Request a new code if needed.",
      );
    const result = await service.verify({
      ...ctx,
      challengeId: req.body.challenge_id,
      otp: req.body.code,
      ip: ip(req),
    });
    const { token, expiresAt, ...safe } = result;
    if (token) {
      setCookie(
        res,
        names.session,
        token,
        Math.max(0, expiresAt - service.now()),
      );
      clear(res, names.preauth);
      safe.csrf = service.csrf(token, "session");
    }
    ok(res, safe);
  };
  router.post("/email/verify", verify(false));
  router.post("/email/cancel", async (req, res) => {
    verifyBody(req, []);
    const ctx = await context(req);
    await service.cancel(ctx);
    if (!ctx.session) clear(res, names.preauth);
    res.status(204).end();
  });
  router.post("/reauth/start", async (req, res) => {
    verifyBody(req, []);
    const ctx = await context(req, true);
    ok(res, await service.start({ ...ctx, ip: ip(req) }), 202);
  });
  router.post("/reauth/verify", verify(true));
  router.post("/logout", async (req, res) => {
    verifyBody(req, []);
    const ctx = await context(req);
    await service.logout(ctx.session);
    clear(res, names.session);
    clear(res, names.preauth);
    res.status(204).end();
  });
  router.post("/logout-all", async (req, res) => {
    verifyBody(req, []);
    const ctx = await context(req, true);
    if (
      service.now() - new Date(ctx.session.last_verified_at).getTime() >
      300000
    )
      throw new AuthFault(403, "Verify your email again before this action.");
    await service.logout(ctx.session, true);
    clear(res, names.session);
    clear(res, names.preauth);
    res.status(204).end();
  });
  router.use((req, res) =>
    failure(res, 404, "Authentication operation not found."),
  );
  router.use((err, req, res, next) => {
    const status =
      err instanceof AuthFault
        ? err.status
        : err.type === "entity.too.large"
          ? 413
          : err instanceof SyntaxError
            ? 400
            : 503;
    if (status === 429 || status === 503) res.set("Retry-After", "60");
    failure(
      res,
      status,
      err instanceof AuthFault
        ? err.message
        : status === 413
          ? "Request too large."
          : status === 400
            ? "Invalid request."
            : "Authentication temporarily unavailable. Try again later.",
    );
  });
  return { router, service, cookieNames: names };
}
export function configuredEmailAuth(pool, env = process.env) {
  if (env.AUTH_ENABLED !== "true") return createEmailAuth();
  const environment = env.NODE_ENV || "production";
  let mail = new DisabledMail();
  if (env.AUTH_MAIL_TRANSPORT === "memory")
    mail = new MemoryMail({ environment });
  return createEmailAuth({
    enabled: true,
    pool,
    environment,
    origin: env.AUTH_ORIGIN,
    allowInsecureLocal: env.AUTH_ALLOW_INSECURE_LOCAL === "true",
    allowSignup: env.AUTH_ALLOW_SIGNUP === "true",
    codeKey: env.AUTH_CODE_HMAC_KEY,
    csrfKey: env.AUTH_CSRF_KEY,
    limitKey: env.AUTH_LIMIT_KEY,
    mail,
    trustedProxyIps: (env.AUTH_TRUSTED_PROXY_IPS || "")
      .split(",")
      .filter(Boolean),
    serviceAccountIds: (env.AUTH_SERVICE_ACCOUNT_IDS || "")
      .split(",")
      .filter(Boolean),
  });
}
