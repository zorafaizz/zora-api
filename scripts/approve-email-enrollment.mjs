// Privileged operator command. JSON input via stdin; credentials never argv/logs.
import pg from "pg";
import { EmailAuthService } from "../src/modules/email-auth/service.js";
let pool, closeDb;
try {
  if (
    process.env.AUTH_OPERATOR_ACTION !== "approve-email-enrollment" ||
    !process.env.DATABASE_URL
  )
    throw new Error("Explicit operator configuration required");
  let input = "";
  for await (const chunk of process.stdin) {
    input += chunk;
    if (input.length > 8192) throw new Error("Input too large");
  }
  const payload = JSON.parse(input);
  input = "";
  const { verifyApiKey } =
    await import("../src/modules/api-keys/api-keys.service.js");
  ({ closeDb } = await import("../src/core/db.js"));
  pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const { account, key } = await verifyApiKey(
    payload.operatorApiKey,
    "127.0.0.1",
  );
  payload.operatorApiKey = undefined;
  if (
    account.role !== "admin" ||
    key.keyType !== "live" ||
    !key.scopes?.includes("*")
  )
    throw new Error("Operator authorization required");
  const service = new EmailAuthService({
    pool,
    serviceAccountIds: (process.env.AUTH_SERVICE_ACCOUNT_IDS || "")
      .split(",")
      .filter(Boolean),
  });
  await service.approveEnrollment({ ...payload, operatorId: account.id });
  process.stdout.write(
    "Enrollment approval recorded; fresh email proof is still required.\n",
  );
} catch {
  process.stderr.write(
    "Enrollment approval failed. No credentials or account details are displayed.\n",
  );
  process.exitCode = 1;
} finally {
  await pool?.end();
  await closeDb?.();
}
