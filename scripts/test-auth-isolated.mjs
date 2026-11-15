import { mkdtemp, chmod, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import net from "node:net";
import crypto from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import pg from "pg";
const root = path.resolve(import.meta.dirname, ".."),
  dir = await mkdtemp(path.join(tmpdir(), "kg-auth-isolated-"));
await chmod(dir, 0o755);
execFileSync("chown", ["postgres:postgres", dir]);
async function port() {
  const server = net.createServer();
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const p = server.address().port;
  await new Promise((r) => server.close(r));
  return p;
}
const pgPort = await port(),
  redisPort = await port(),
  bin = "/usr/lib/postgresql/16/bin";
let started = false,
  redis;
try {
  execFileSync(
    "runuser",
    [
      "-u",
      "postgres",
      "--",
      bin + "/initdb",
      "-D",
      dir + "/data",
      "-A",
      "trust",
      "--no-locale",
    ],
    { stdio: "ignore" },
  );
  execFileSync(
    "runuser",
    [
      "-u",
      "postgres",
      "--",
      bin + "/pg_ctl",
      "-D",
      dir + "/data",
      "-l",
      dir + "/postgres.log",
      "-o",
      `-h 127.0.0.1 -p ${pgPort} -k ${dir}`,
      "-w",
      "start",
    ],
    { stdio: "ignore" },
  );
  started = true;
  redis = spawn(
    "redis-server",
    [
      "--bind",
      "127.0.0.1",
      "--port",
      String(redisPort),
      "--save",
      "",
      "--appendonly",
      "no",
    ],
    { stdio: "ignore" },
  );
  const url = `postgresql://postgres@127.0.0.1:${pgPort}/postgres`,
    pool = new pg.Pool({ connectionString: url });
  await pool.query(
    await readFile(
      path.join(root, "migrations/001_initial_schema.sql"),
      "utf8",
    ),
  );
  const fixture = (
    await pool.query(
      "INSERT INTO accounts(email,is_frozen,test_quota_remaining,last_live_activity_at) VALUES('migration-fixture@example.test',true,7,'2020-01-01') RETURNING id",
    )
  ).rows[0].id;
  const wallet = (
    await pool.query(
      "INSERT INTO wallets(account_id,balance_credits,reserved_credits) VALUES($1,123,4) RETURNING id",
      [fixture],
    )
  ).rows[0].id;
  await pool.query(
    "INSERT INTO api_keys(account_id,public_id,key_hash,key_type) VALUES($1,'migration-fixture',$2,'live')",
    [fixture, crypto.randomBytes(32).toString("hex")],
  );
  await pool.query(
    "INSERT INTO daily_quotas(account_id,quota_date,used_count) VALUES($1,'2020-01-01',5)",
    [fixture],
  );
  await pool.query(
    "INSERT INTO credit_ledger(wallet_id,account_id,amount,balance_after,operation_type,actor,reason) VALUES($1,$2,123,123,'grant','isolated-test','migration preservation fixture')",
    [wallet, fixture],
  );
  const tables = (
    await pool.query(
      "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename",
    )
  ).rows.map((r) => r.tablename);
  async function snapshot() {
    const result = {};
    for (const name of tables) {
      result[name] = (
        await pool.query(
          "SELECT jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text) AS rows FROM " +
            name +
            " t",
        )
      ).rows[0].rows;
    }
    return JSON.stringify(result);
  }
  const before = await snapshot();
  await pool.query(
    await readFile(path.join(root, "migrations/002_email_auth.sql"), "utf8"),
  );
  if ((await snapshot()) !== before)
    throw Error("Migration modified original data");
  await pool.query(
    await readFile(
      path.join(root, "migrations/002_email_auth_down.sql"),
      "utf8",
    ),
  );
  if ((await snapshot()) !== before)
    throw Error("Rollback modified original data");
  await pool.query(
    await readFile(path.join(root, "migrations/002_email_auth.sql"), "utf8"),
  );
  console.log(
    "Isolated migration UP/DOWN/UP preserved every original table snapshot.",
  );
  await pool.end();
  const env = {
    ...process.env,
    NODE_ENV: "test",
    DATABASE_URL: url,
    AUTH_TEST_DATABASE_URL: url,
    REDIS_HOST: "127.0.0.1",
    REDIS_PORT: String(redisPort),
    API_KEY_PEPPER: crypto.randomBytes(32).toString("hex"),
    ENABLE_MOCK_PAYMENT: "true",
    AUTH_ENABLED: "false",
  };
  delete env.REDIS_PASSWORD;
  const args = process.argv.slice(2);
  const files = args.length
    ? args
    : [
        "tests/email-auth.test.js",
        "tests/email-auth-boundary.test.js",
        "tests/frontend.test.js",
        "tests/registry.test.js",
        "tests/auth-quota.test.js",
        "tests/billing-ledger.test.js",
        "tests/concurrency-security.test.js",
        "tests/core-resilience.test.js",
      ];
  const command =
    files[0] === "--browser"
      ? ["scripts/verify-email-auth.mjs"]
      : ["--test", ...files];
  const child = spawn(process.execPath, command, {
    cwd: root,
    env,
    stdio: "inherit",
  });
  const code = await new Promise((r) => child.on("exit", r));
  process.exitCode = code || 0;
} finally {
  redis?.kill();
  if (started)
    execFileSync(
      "runuser",
      [
        "-u",
        "postgres",
        "--",
        bin + "/pg_ctl",
        "-D",
        dir + "/data",
        "-m",
        "immediate",
        "stop",
      ],
      { stdio: "ignore" },
    );
  await rm(dir, { recursive: true, force: true });
}
