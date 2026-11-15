import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
const isolated = !!process.env.AUTH_TEST_DATABASE_URL;
test(
  "auth namespace and session cookies never bypass the legacy API-key boundary",
  { skip: !isolated },
  async () => {
    const { app } = await import("../server.js");
    const { query, closeDb } = await import("../src/core/db.js");
    const { closeRedis } = await import("../src/core/redis.js");
    try {
      const before = (await query("SELECT count(*) FROM accounts")).rows[0]
        .count;
      const auth = await request(app)
        .get("/api/v1/auth/session")
        .set("Origin", "https://outside.invalid");
      assert.equal(auth.status, 503);
      assert.ok(!auth.headers["access-control-allow-origin"]);
      assert.equal(
        (await query("SELECT count(*) FROM accounts")).rows[0].count,
        before,
      );
      const account = await request(app)
        .get("/api/v1/account")
        .set("Cookie", "__Host-kg_session=fixture-cookie");
      assert.equal(account.status, 401);
      assert.equal(account.body.status, false);
      const legacy = await request(app).get("/signin.html");
      assert.equal(legacy.status, 308);
      assert.equal(legacy.headers.location, "/signin");
      const page = await request(app).get("/signin");
      assert.equal(page.status, 200);
      assert.match(page.text, /eight-digit email verification/);
    } finally {
      await closeRedis();
      await closeDb();
    }
  },
);
