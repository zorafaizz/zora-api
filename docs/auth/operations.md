# Email OTP operations and verification

Implementation is approved; production email, migration and deployment are not. AUTH_ENABLED and AUTH_ALLOW_SIGNUP default off. The manual Bearer/API-key playground remains independent; cookies never authorize product API calls. No session executor, automatic key recovery or key administration was added.

## Files and contracts

- src/modules/email-auth/: Node crypto primitives, bounded MemoryMail/DisabledMail, transactional Postgres service and scoped Express router.
- migrations/002_email_auth.sql and002_email_auth_down.sql: new auth-only tables plus a non-unique normalized account-email lookup index. No updates/deletes of existing identities, balances, keys, usage, ledger, frozen benefits or other entitlements. No uniqueness/merge backfill.
- server.js mounts the router before legacy global CORS/body/auth middleware, so auth owns JSON4KB, Origin/CSRF, throttles and sanitized errors. Existing product middleware order/behavior is unchanged.
- public/signin.html and assets/signin.js use existing B themes/Momo, one8digit input, explicit verification, resend/change email/cancellation, expiry, session identity, logout/all and recent verification. Redirect allowlist is / or /explorer.html with an optional validated endpoint ID only. Email/code never enter URLs/storage.
- scripts/approve-email-enrollment.mjs is a privileged operator command, never an HTTP endpoint. It verifies a live wildcard administrator API credential with its IP policy, rereads actor role/target eligibility, requires ordinary-user classification, explicit ownershipVerified=true and an evidence reference, and writes an immutable approval marker/audit event. A fresh code issued with that marker is still required. No API key alone enrolls an account.

All auth responses are no-store. Production cookie names use __Host- prefix, Secure/HttpOnly, SameSite=Lax session /Strict preauth; local insecure cookies use distinct names and require explicit nonproduction loopback configuration. Sessions7day absolute/24h idle; recent verification5minutes for sign-out-all. Reauth rotates token/CSRF without extending absolute expiry. Public code-start/verify operations do not grant privileged operations. Admin/service identities cannot email-sign-in; no automatic role changes.

## Isolated tests

Prerequisites already present in this workspace: Postgres16 binaries, postgres OS user, redis-server, Node/npm dependencies. Runner creates its own temporary cluster/data/socket/log directory and random loopback ports, applies001+002 only there, overrides DATABASE_URL/Redis/pepper for its child and removes the cluster on completion. It never reads .env, connects to configured production Postgres/Redis, sends real mail or changes system services.

```sh
node scripts/test-auth-isolated.mjs
node scripts/test-auth-isolated.mjs --browser
node scripts/build-frontend.mjs --check
```

Default regression set: email-auth, email-auth-boundary, frontend, registry, auth-quota, billing-ledger, concurrency-security, core-resilience. HTTP-provider and multi-engine tests that make live upstream requests are excluded; they need explicit provider fixtures before an entire npm test run is safe. Current run: 78 passed, 0 failed, 0 skipped. No npm lint/typecheck/build scripts exist; JavaScript syntax, frontend asset drift and whitespace checks passed. Existing frontend browser regression also passed 20 layouts with zero page errors. Browser uses cached Playwright by default, or PLAYWRIGHT_MODULE=/path/to/playwright; Chrome path is /opt/google/chrome/chrome and --no-sandbox is only a container test setting. MCP cannot launch as root in this environment; local workflow supplies evidence.

Browser harness uses the real scoped auth router, isolated Postgres and private MemoryMail, with signup enabled only in that injected test configuration. No test-only credential endpoint exists. Codes are transferred programmatically to test inputs, cleared after verification, and never included in traces/recordings/screenshots/logs. Screenshots capture empty forms only.10 layout/theme combinations (320/390/768/1280/1440 × day/night) and 10 flows, including network/throttle recovery, desktop/mobile full flow, invalid/expired/restart/resend/change, destination safety, cookie/session identity, fresh verification/logout-all, keyboard, reduced motion and manual playground separation are checked. Artifacts in evidence/browser-qa.json and signin-*.png.

Migration runner seeds frozen account, nonzero wallet/reservation, key, daily quota and credit ledger rows before002; snapshots every original public table, and verifies exact equality after UP/DOWN/UP. Separate auth tests verify frozen-account/key/wallet rows unchanged by enrollment/login, no replacement for historical case variants, no duplicate wallet/quota under signup races, authorized enrollment audit and disabled signup. No subscriptions table exists in the supplied schema; migration never touches unrelated existing tables.

## Delivery adapter contract

Implement sendCode({to,code,expiresAt},{signal}) in an approved server-side transport. Secrets live in server secret configuration, never source/client/snippets. Treat known non-delivery as rejection and uncertain delivery as timeout; honor AbortSignal and do not retry automatically. The service bounds dispatch to5seconds, never stores plain codes in a queue, and keeps possibly delivered codes valid through expiry after uncertain timeout. Provider-specific account, pricing, sender-domain, retention and operational permissions are not assumed.

MemoryMail is intentionally limited to private process memory(max100messages, expired entries discarded). Its takeCode(email) API is for local test/development code only, with no HTTP route or console output. Production construction rejects this adapter. DisabledMail is the current production default; if enabled without a real transport, requests fail honestly with503 rather than pretending to send. Actual deployment requires adding/configuring the chosen adapter; AUTH_MAIL_TRANSPORT currently supports only disabled/memory. No real vendor credentials were inspected or requested.

## Operator enrollment procedure (not executed on production)

1. Review ownership through your operational process; classify the target as an ordinary customer, excluding admin/service/shared identities. Existing noncanonical/ambiguous email records require a separate reviewed data decision; the app never normalizes or merges them automatically.
2. Use an explicit DATABASE_URL through secure operator configuration and set AUTH_OPERATOR_ACTION=approve-email-enrollment. The command has no default database fallback. Administrator key and payload go through secure stdin, not argv/shell history. Do not paste a real key into chat or documentation.
3. Stdin JSON field names: operatorApiKey, accountId, expectedEmail, ownershipVerified, classification and evidenceReference. No sample real values are provided. The administrator must be live/wildcard/role=admin and satisfy its existing IP allowlist for the local operator command. Ordinary/scoped/test credentials and false ownership attestations are denied. The service rechecks operator role and target email/role/exclusions transactionally.
4. Confirm the sanitized approval result and audit event through your privileged process; next sign-in must request a new email code. Existing pending preapproval codes carry no valid approval marker and cannot become sessions. No wallet/key/account entitlement is changed.

The command is an authorized operational write only when the operator deliberately runs it. Implementation approval does not authorize running it against production now.

## Deployment requirements and rollback

Before production activation, obtain separate approval for002 migration, real delivery and deployment. Review actual HTTPS/canonical AUTH_ORIGIN and trusted-proxy topology; forwarded headers are used only for exact approved peer IPs and the last hop appended by that proxy. Provision three independent high-entropy server keys, at least32characters each, consistently across instances. No code default/old API pepper is reused; API key hashes stay unchanged. Review signup eligibility, service account exclusions, privacy/sender policies and the real mail adapter.

Take an authorized backup and test migration on a representative isolated copy. The account lookup index is non-concurrent inside the additive migration; plan its lock/maintenance impact before production migration. Do not invoke the existing automatic migrator on production without approval. Feature flags stay off until schema/transport/TLS/proxy/config checks are complete. Enabling signup is a separate deliberate launch choice; historical enrollment is never backfilled.

Schedule an authorized invocation of EmailAuthService.purgeExpired(): expired proof/flow records beyond24h, expired/revoked sessions beyond30days, expired rate buckets and ordinary security events beyond30days. Enrollment approvals are retained pending explicit audit-retention policy. No scheduler/production cleanup job was installed. Fail closed when auth data/limits are unavailable. Key rotation invalidates pending code HMACs; issue new codes explicitly. Expiration is enforced at every proof/session boundary regardless of cleanup.

Rollback normally sets AUTH_ENABLED=false, disables new signup and delivery, and revokes auth sessions under an approved procedure; leave historical business data untouched.002down was tested in the disposable cluster only and removes new auth records; never use it as an unreviewed production rollback. Full cross-browser/real-device/accessibility/performance, real mailbox deliverability and operational ingress verification remain release tasks. Existing API-key scope-management issue is documented and unchanged; session executor needs its separate architecture review.
