# Email sign-in and account sessions — approved design and implementation

Status: approved for implementation and isolated testing on 2026-11-15; implemented behind disabled-by-default flags. Production migration, delivery and deployment remain unapproved. B/Pocket Mischief remains approved. The original proposal sections below preserve design history; the implementation checkpoint at the end records current choices and evidence. Exact limits are project defaults, not externally mandated compliance guarantees.

## Recommendation and alternatives

Use passwordless email codes: one email field, one eight-digit code field, then an opaque server-backed browser session. No passwords to store/reset and no credentials embedded in links. Keep manual API keys available.

| Approach | Benefit | Cost / reason not selected for this proposal |
|---|---|---|
| Email code (recommended, awaiting approval) | Works when email is read on another device; code stays out of URLs; paste/autofill friendly | Requires throttling, brief lifetime and mailbox access; not phishing-resistant MFA |
| Magic link | Fewer keystrokes | Authentication token in a URL conflicts with the current no-secret-in-URLs rule; scanner/prefetch consumption and device handoff need extra design |
| Email + password | Familiar and independent of mail after enrollment | Adds password hashing, reset/recovery and credential-attack surface the current product does not have |

Email possession is the identity proof for ordinary enrolled accounts. It is not a second factor, strong transaction authorization, or permission to access admin/service identities. Admin sign-in is out of scope.

## Facts verified in this repository

- Node ESM/Express, Postgres and Redis already exist. No account login/session issuance or transactional email transport/configuration is implemented. An oauth_identities table exists, with no implemented sign-in flow found. Do not repurpose its provider fields as an email-code store.
- createOrFindAccount trims/lowercases email and creates an account plus wallet; accounts.email is unique, but there is no verification timestamp or verified identity record. Never call it merely because an email was submitted.
- Account creation grants the existing lifetime test allocation. Login must not recreate wallet/quota rows, reactivate a frozen account, touch last_live_activity_at, issue API keys or reset daily/lifetime usage. Explicit reactivation remains separate.
- API keys are hash-only/reveal-once. listApiKeys exposes metadata, not recoverable secrets. verifyApiKey checks hash/revocation/expiry/IP; endpoint scopes are declared in registry but not enforced there. Do not claim scope enforcement already exists.
- Current rate limiting precedes auth and fails open when Redis fails. getClientIP trusts the first forwarded value. The supplied Nginx example appends forwarded addresses and only shows HTTP, not verified deployed TLS. New auth cannot reuse those defaults as a secure guarantee.
- The legacy account fallback must never apply to auth/browser routes. Existing API-key contracts, pricing, quotas and ledger behavior remain unchanged in sign-in phase.

## User flow and interaction design

1. Existing nav gains Sign in; docs and manual playground stay accessible. Sign-in page uses Pocket Mischief tokens in both themes, a small calm Momo companion, readable labels and a stable-width Send code button. No opening animation or background request on typing.
2. Label: Email address. email autocomplete, sensible length limit, visible format error. Button: Send code. Copy: “Use your email to sign in. New accounts are created after verification.” This latter sentence is shown only when registration is enabled.
3. Submit explicitly. For a syntactically valid address, accepted response copy is identical regardless of account existence: “If this address can receive mail, a sign-in code will arrive shortly.” Show masked entered address and Change email; no account-existence check is exposed.
4. One text input for the eight-digit code: inputmode=numeric, autocomplete=one-time-code, paste works, leading zeros preserved. No eight separate focus traps; no automatic submit. Verify and sign in is explicit. Code submitted only in a POST body, never a URL or storage. Keep email/code/CSRF state in memory only.
5. Default validity: 10 minutes; resend available after 60 seconds. Server is authoritative. Resend replaces the code for this browser/email flow without refreshing its aggregate attempt allowance. Changing email cancels this browser's old flow; does not alter other browsers or accounts.
6. Wrong/expired/used code: same recoverable “That code is invalid or expired. Try again or request a new one.” Delivery outage: clear retry state, no fake successful sign-in. Loading retains layout, prevents duplicate actions, leaves Change email/cancel usable. No automatic sends/retries.
7. On valid code, normal enrolled account receives a fresh session and returns only to an allowlisted local destination (default /explorer.html). New account is created only if registration enabled, after verification, in the same transaction as identity/session enrollment. No key is auto-created and no request auto-executes.
8. Existing unenrolled account follows the operator-reviewed enrollment flow below. Initial sign-in shows only the signed-in identity alongside the existing manual-key playground. Masked key selection, session key administration and session execution are deferred together to the separately reviewed integration stage; no reconstructed key is ever offered.
9. Momo notices focus, waits quietly on send/verify, briefly smiles on actual success, shows a restrained confused expression for errors. Text/live regions carry all feedback. Respect optional reactions, reduced motion, keyboard, touch and focus restoration; email/code are never included in screenshots or analytics.

Functional UX state list: email idle/invalid/sending/accepted; code entering/verifying/invalid/expired/rate-limited/resending; delivery unavailable; existing-account enrollment required; signed in; session expired; signed out. No countdown live announcement every second. Browser reload restarts code entry rather than persisting credentials; transport resend remains user-driven.

## Existing accounts and new registration

Proposed safe migration: no existing account is silently marked email-verified/enrolled. Add a separate email identity enrollment record, initially absent for all historical accounts; do not change existing account emails/roles/wallets/keys. Preserve trim+lowercase matching for compatibility; no Gmail dot removal, plus-address merging, or silently broader canonicalization.

For an existing ordinary user account not enrolled: valid code proof returns an enrollment-required result, with a neutral ownership-review instruction, and consumes that challenge. It does **not** issue an account session or expose account/key/balance metadata. Enrollment approval happens through a separately audited operator process outside this public flow; afterward the user requests/verifies a fresh code. No public API-key ownership claim is offered in v1.

Reason: the current key-creation API accepts any valid API key and defaults new keys to wildcard scopes. Requiring a wildcard key would not establish stronger ownership than a scoped key, because that key can currently mint a wildcard key. Do not build account claiming on that assumption. A future self-service claim requires separately approved key-management authorization hardening and review. This design deliberately leaves existing Bearer behavior unchanged rather than silently tightening it.
Admin/service/legacy shared-account identities are denied public enrollment, including with a key. role=admin is a hard deny; role=user alone does not prove a historical service account is safe. Launch requires an explicit enrollment eligibility policy/allowlist for historical ordinary accounts and classification of legacy/service accounts by the operator. No bulk email normalization or ownership backfill is run by this design.

New registrations: propose unified sign-up/sign-in, gated by AUTH_ALLOW_SIGNUP (off until operator launch approval). On first verified email create exactly one role=user account and wallet; handle concurrent account creation using unique email plus transaction/row/advisory locking. Reuse existing quota-allocation constants/invariants; no duplicate allocation on retry or later login. Enrollment and account creation must use one transaction-aware service, not nested independent account transactions. Existing createOrFindAccount requires refactoring for this transaction boundary without changing existing callers' outcomes.

Mailbox loss has no self-service bypass in v1. Operator ownership review must be an audited, explicit account-security action. Admins need a separately approved stronger authentication path; this design does not grant admin browser sessions.

## Challenge and verification protocol

Proposed defaults:

| Control | Value |
|---|---|
| Code | 8 random decimal digits generated with cryptographic randomness, including leading zeros |
| Lifetime | Maximum 10 minutes, bounded by the remaining browser-flow lifetime |
| Failed checks | 5 per browser/email flow, with email/network aggregate limits |
| Resend | At least 60 seconds; max 3 sends per normalized email per 15 minutes, 10/day |
| Network start limit | 20 starts per trusted client-IP bucket per 15 minutes |
| Network verify limit | 30 checks per trusted client-IP bucket per 15 minutes |

Limits are initial configurable tuning values, not anti-Sybil guarantees. Key Redis buckets by a dedicated HMAC of normalized email/IP rather than raw mailbox strings; retain only for necessary windows. Keep atomic database attempt accounting as authoritative. Redis/auth-store errors fail closed for auth, independent of the old product limiter. Do not lock an account or revoke valid sessions just because someone guessed its email/code. Network limits are a weak abuse signal, never the only reason for permanent account suspension.

Bootstrap issues a 256-bit random HttpOnly preauth cookie, stores only its digest, and returns a CSRF token bound to that browser. One active challenge per preauth/browser+email, multiple browser flows permitted within email/global limits. An unauthenticated resend from a different browser cannot invalidate the victim's existing flow.

Store only a dedicated server-keyed HMAC of code + challenge ID + generation + browser binding + purpose, with key version. A plain hash of an eight-digit code is insufficient against an offline search after database exposure. Use constant-time comparison; never reuse API_KEY_PEPPER or its fallback for auth. Require independently provisioned secrets and no hardcoded production fallbacks. Challenge ID is an opaque noncredential handle; browser cookie + matching code + CSRF are required.

Resend serializes with verify using a challenge row lock/version. Consume/reset generation only for that flow; original flow expiration and cumulative failures do not reset. Challenge expiry is min(now+600 seconds, browser-flow expiry); return the actual remaining seconds to the UI. Expired/exhausted flow must start again under aggregate throttles. Incorrect attempts commit even when validation fails. Correct verification locks the row and atomically checks expiry/generation/attempt budget, marks consumed, establishes identity/session, and records security metadata. Two parallel correct verifies cannot produce two sessions; replay never succeeds.

Plain code exists only transiently in application memory, outbound mail payload and user's mailbox. Never put it into a durable queue, analytics, logs, traces or database. Persist digest first; send via a bounded timeout adapter. For a definite send rejection invalidate that generation only; for an uncertain timeout do not invalidate a possibly delivered valid code or resend automatically. Accepted/start responses reveal no recipient-specific delivery detail. A global provider outage can return generic 503 consistently for all recipients, with Retry-After, rather than pretending delivery succeeded.

Mail dispatch is idempotent per challenge generation within one process invocation; no automatic provider retries that generate multiple codes. Process failure may leave an undelivered challenge; user requests resend. A durable outbox would need a separately reviewed encrypted-secret/retention design and is not silently introduced. Small generic English email: service identity, the code, expiry, “enter it only on the site where you requested it,” and ignore-if-unrequested guidance. No sign-in links, tracking pixels, account balances or API keys.

## Sessions and CSRF

Use 32-byte random opaque session identifiers; only SHA-256 digests indexed in Postgres. Proposed cookie: __Host-kg_session, Secure, HttpOnly, SameSite=Lax, Path=/, no Domain. Fixed absolute lifetime 7 days and server-enforced 24-hour idle timeout, no permanent remember-me. Preauth cookie uses __Host-kg_preauth, Secure, HttpOnly, SameSite=Strict, Path=/, 10-minute lifetime. No partially verified or enrollment-required flow is accepted as an authenticated session. Challenge expiry never exceeds its binding browser flow, and the response reports the actual remaining lifetime.

After successful authentication create a new session token, clear preauth/challenges for that completed browser flow, revoke the session being replaced in that browser, and rotate CSRF binding. Do not revoke other browsers automatically. Normal login does not change last_live_activity_at or account freeze status. On expiry return 401; no hidden refresh grant. Logout revokes the current session in the database and clears cookie; sign out all revokes all account sessions and outstanding reauthentication flows. Session revocation remains effective across app instances and restarts.

CSRF: JSON-only POST, body size <=4KB for auth, exact configured HTTPS Origin, Fetch Metadata checks where present, and explicit X-CSRF-Token. Reject null/missing Origin on browser mutations. CSRF token can be derived by dedicated keyed HMAC of opaque cookie token + purpose; returned by same-origin no-store bootstrap/session response into JS memory, compared constant-time. Never rely on SameSite alone. No CORS allow-origin/credentials for auth/browser routes. Any cross-origin or simple/form POST must fail before mail or account actions. Existing bearer API CORS remains unchanged.

Preauth guard covers start and verify to prevent login CSRF; new session binding covers logout and all browser account actions. No session or code in query strings, fragments, localStorage, sessionStorage, logs or example snippets. Auth/session responses use Cache-Control:no-store and Referrer-Policy:no-referrer. No third-party scripts on sign-in/account pages. Session rotation changes token on login/step-up/identity change; cookie-bearing endpoints do not also accept arbitrary Bearer keys or client account IDs.

Proposed last_verified_at freshness: 5 minutes for create/revoke keys, sign-out-all and any later identity/security changes. Reauthentication uses separate authenticated start/verify operations with session CSRF, never the preauth-only sign-in operations. Server derives account/email from the active enrolled ordinary-user session; no client-supplied email/account/role is accepted. Bind the challenge to stable session ID plus current token digest/version and reauth purpose. On success, lock/recheck session and challenge, consume once, rotate session token and CSRF, set last_verified_at, preserve the session's original absolute expiry, and invalidate sibling reauth challenges. Revoked/expired/idle-expired sessions cannot start/finish reauth. All resend/attempt/expiry limits apply; reauth lifetime is capped by the session/flow remaining lifetime. Logout invalidates bound challenges immediately. Reauth cannot sign into another identity; account switching requires explicit logout then normal sign-in. Email change/admin actions remain out of scope. A stolen mailbox remains a limitation of email-only sign-in, so this is not advertised as phishing-resistant or MFA.

## Proposed HTTP contracts — none exist yet

Use a dedicated auth router after request context/envelope helpers and before the legacy global CORS/rate/auth/fallback chain. Router owns small JSON limits, Origin/CSRF and fail-closed auth throttles. Do not broaden old authMiddleware to silently accept cookies on every API route. Future cookie browser router has the same separation.

| Proposed operation | Request | Result / constraints |
|---|---|---|
| GET /api/v1/auth/session | Cookie if present | No-store bootstrap; anonymous preauth CSRF or sanitized session/account identity + fresh CSRF. No key secrets, wallet or email-code data. Does not extend an expired session. |
| POST /api/v1/auth/email/start | email, browser-bound CSRF | 202 generic accepted + challenge handle, actual expires_in<=600, resend_after=60. Invalid syntax400, aggregate throttling429, global outage503. No account lookup early-exit. Active signed-in browser receives409 to sign out first, before inspecting submitted email. |
| POST /api/v1/auth/email/verify | challenge_id, code as 8-digit string, CSRF | Valid proof sets session only for eligible enrolled/new accounts; unenrolled historical accounts get enrollment-required. Invalid/expired/replayed generic400;429 on throttling;503 on store failure. Never returns a raw session/code/API key. |
| POST /api/v1/auth/reauth/start | Active session + session CSRF; no email field | 202 accepted + reauth handle/actual lifetime/resend-after. Derive recipient server-side, bind current session/token version, fail401 for expired/revoked session. |
| POST /api/v1/auth/reauth/verify | Active session + session CSRF, reauth challenge_id, code | Consume bound proof atomically; rotate session cookie/CSRF and update recent proof. Invalid/used code400; expired/revoked/different-session401; rate429. No account switch or new absolute lifetime. |
| POST /api/v1/auth/logout | Session CSRF |204 revoke current session/clear cookie; idempotent when already signed out using valid preauth CSRF. |
| POST /api/v1/auth/logout-all | Session CSRF + recent same-account verification |204 revoke all sessions/grants; no API-key revocation or quota mutation. |

Exact response envelope conforms to existing sendSuccess/sendError conventions, with specified status codes and no private driver/provider messages. The table describes data within that envelope, not an already deployed API. GET /auth/session is identity bootstrap, not an API execution or billable request. Sign-in/signup terms/privacy copy require operator launch approval.

Historical enrollment is not a hidden public endpoint. The operator records explicit ordinary-user eligibility/approval for an existing account through an audited, access-controlled operational action; only a subsequent fresh code can set verified_at and issue a browser session. No live database update is authorized by this design. Neither the code nor any API key is proof of operator approval.
## Persistence and operations (proposed additive migration, not run)

- email_identities: account_id FK unique, canonical_email unique, verified_at (nullable until fresh email proof), enrollment_method, operator_approved_at/actor for historical enrollment, created_at. Keep existing account.email matching; no retroactive verification or role changes.
- auth_browser_flows: ID, kind=preauth/reauth, purpose, expiry/revocation metadata; preauth flows have unique preauth_digest, while reauth flows bind account_sessions.id and current token digest/version (no extra cookie). Enforce mutually exclusive binding fields with CHECK constraints. Never treat either flow as full account authorization.
- email_challenges: ID, flow_id FK, canonical_email, purpose, code_hmac/key_version, generation, attempt_count, created_at/expires_at, consumed_at, send_outcome, optional bound account/session for reauth. Constraints/checks plus row-level atomic consume; never code plaintext.
- account_sessions: stable UUID ID primary key, token_digest unique, token_version, account_id FK, created_at, last_seen_at, expires_at, last_verified_at, revoked_at. Avoid storing full IP/UA as permanent identity; no IP binding that breaks roaming. Throttle last_seen writes with a bounded database scheme that still rejects idle expiry before update.
- Security audit: event type, opaque account ID only after authorization, outcome and timestamp/request ID. No raw codes/cookies/keys, full request bodies, raw mail payloads or recipient-specific provider errors. Existing account creation logs include raw email; the new auth path must use safe logging or refactor that event to account ID only. Never log request bodies at proxy/error tracing layers.

Short retention proposal: consumed/expired challenge/flow data purged within24h; expired/revoked sessions within30days; low-detail security events30days, configurable pending privacy policy. Mail vendor retention/tracking/region must be approved before launch; this design does not invent user consent or a mail account. No destructive down migration in production; disabling feature leaves keys/accounts/quota data intact.

Configuration names proposed: AUTH_ENABLED, AUTH_ALLOW_SIGNUP, AUTH_ORIGIN, AUTH_CODE_HMAC_KEY, AUTH_CSRF_KEY, AUTH_LIMIT_KEY, AUTH_MAIL_FROM and transport credentials via server secret configuration. Dedicated secrets required; API key hashing and all existing hashes stay unchanged. AUTH_ENABLED defaults off until migration, TLS/proxy verification, transport and tests are ready. Local automated tests use an in-memory mail adapter and isolated Postgres/Redis; no codes printed to console or live email. No vendor selected/purchased and no credentials requested in chat.

Client IP must derive from a validated peer/trusted proxy chain, not current getClientIP's arbitrary first X-Forwarded-For value. Validate actual HTTPS termination and canonical external origin independent of untrusted Host/Forwarded headers. Do not edit Nginx/TLS/provider configuration automatically. Production email sender/domain delivery and permission are operational launch prerequisites, not reasons to block writing/tests after design approval.

## Session playground and accounts: separate controlled integration

Email sign-in phase establishes identity and account-safe read operations; existing manual-key execution stays available. A full session is not an API key or unlimited execution grant. No automatic key generation or wildcard principal on login.

Next separately reviewed browser API can list owned masked key metadata and request explicit create/revoke using existing reveal-once storage/service with fresh verification and CSRF. New-account empty state offers Create a test key, explicit user action; login never allocates extra test quota. Newly created raw key is revealed once only as existing policy permits; copying/reveal stays explicit and memory-only. No existing plaintext is fetched.

For session execution: select an owned active test key by default if present; never silently choose a live/billable key. Persist only an optional owned key ID preference, not a secret. Live selection and Execute clearly disclose billing; revalidate owner/revocation/expiry/IP/scope every execution. No valid key means prompt to create/select one, not bypass quota. A stale preference fails visibly instead of choosing another account/key. Account login alone leaves scopes and charges unchanged.

Proposed POST /api/v1/browser/execute accepts endpoint ID, selected key ID and schema parameters with session CSRF. It cannot accept arbitrary destination URLs/methods/headers, raw secrets or account IDs. Native bridge unsupported until actual payload schema is reviewed. New cookie request principal must reach the same tested endpoint validation, quota/reservation, handler and settlement stages exactly once. Dispatch by verified registry ID, not loopback HTTP or forged req.path.

Important implementation prerequisites: current handlers are manual server.js closures, not dispatchable registry functions; quota guard resolves by req.path, so calling it on /browser/execute would silently miss the real endpoint. Extract a trusted endpoint descriptor + shared handler interface explicitly, with regression evidence before introducing the browser executor. Registry public scope does not imply no_quota; apply the actual billing policy when executing with an account/key. Scope checks are currently missing and shared enforcement may tighten behavior for previously mis-scoped API clients: require explicit compatibility/security review, not an unnoticed sign-in refactor. Existing reservation/cancellation logic also settles on finish/close; accepted upstream work and refunds must be specified/tested before claiming safe session execution.

Do not expose session account/key administration or chargeable session execution until those boundaries are implemented and reviewed. UI may initially show signed-in identity alongside manual execution; never label a session executor as working before it exists.

## Acceptance and rollout

1. Review this design, specifically email codes, operator-reviewed historical enrollment guard, default signup gate, session lifetimes and staged executor. This is not production rollout permission.
2. Implement behind disabled-by-default flag, additive migration files only, in-memory mail adapter tests; no provider sends/migrations/infra actions. Preserve manual API/Bearer compatibility.
3. Isolated Postgres/Redis tests: code randomness/leading zeros; no credential persistence/log output; constant-time comparisons; retry/replay/concurrent consume; resend generation race; expiry; aggregate attempts/rates; unavailable stores fail closed; session rotation/logout/all/idle/absolute; browser/CSRF/Origin/cross-account failures; signup race creates one wallet/quota allocation; historical/admin/service account enrollment denial; reauth cannot switch identity; no free-benefit reset; key hashing unchanged.
4. Browser fixture QA in day/night,320/390/768/1280/1440, keyboard/touch/paste/autofill/reduced motion, invalid/expiry/resend/provider errors, navigation/reload/no storage, safe local return target and session loss. Screenshot only empty/test fixtures, never valid codes or cookies. Regression existing14frontend/registry tests and existing backend tests only in isolated environment.
5. Review session-account/key and execution pipeline changes independently with billing/scope/ownership/SSRF and cancellation tests. No automatic real requests. Verify trusted proxy/TLS, sender and vendor permissions, retention, config and feature rollback before operator-approved launch.

## Original approval checkpoint (historical)

This document recommends code-based email sign-in and the operator-reviewed historical enrollment policy. User has approved email as a family, not these exact tradeoffs. Mail vendor/from-domain is deliberately transport-agnostic and can be configured later; no production sending works until supplied securely. Existing account/service eligibility requires operator classification before enrollment is enabled. No new code, migrations, mail sends or infrastructure changes have been performed.

## Sources and scope of guidance

[OWASP token/code lifecycle guidance](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html) supports generic responses, random expiring single-use proofs and submission throttles; it addresses recovery and is applied here as an engineering reference, not an assertion that recovery and sign-in are equivalent. [OWASP session management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html) informs cookie flags, token rotation, expiration and revocation. [OWASP CSRF guidance](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html) supports explicit browser request defenses beyond SameSite. [OWASP authentication guidance](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html) informs verified email, sensitive-account separation and fresh proof for sensitive actions. Exact numbers and scope choices are project proposals, not benchmark or compliance claims.

## Independent builder review

Read-only review identified three material issues and they were resolved in this design: (1) historical wildcard-key claim could be minted from a scoped key under current APIs, so v1 enrollment is operator-reviewed only; (2) reauth now has explicit session-bound start/verify contracts and token/CSRF rotation; (3) initial post-login UI shows identity plus manual execution, with key selection/management/execution deferred together. No implementation or production-state validation is implied by a document review.

## Implementation approval and current choices — 2026-11-15

Operator approved implementation and isolated testing; earlier “awaiting approval” statements above are design history. Production email delivery/migrations/deployment and session API execution are not authorized.

Implemented architecture uses atomic Postgres rolling timestamp rate buckets instead of Redis, with fail-closed behavior and keyed identifiers. This reduces dependencies and leaves the old product API limiter unchanged. Cookie names/flags remain secure by default; an explicitly enabled nonproduction loopback test mode uses distinct kg_local_* names for HTTP test servers, never production.

Historical enrollment requires the privileged operator command, a verified live wildcard administrator key, ordinary-user classification, explicit ownership attestation and evidence reference. No public enrollment endpoint or API-key claim flow exists. Approval gets an immutable UUID marker; challenge issuance snapshots it, so codes requested before operator approval cannot grant a session afterward. Existing frozen state/quota/key/balance rows are untouched by authentication.

Added POST /api/v1/auth/email/cancel (same browser/session CSRF): cancels pending proof flows when changing email or leaving reauth. It neither signs out the account nor executes APIs. Mail-outcome updates only affect still-active matching generations, so delayed callbacks cannot revoke newer/superseding proof state. Definite rejection revokes that flow so secure bootstrap can restart; uncertain five-second delivery timeout keeps possibly delivered code valid without automatic resend. Delivery adapters receive an AbortSignal.

Production delivery remains DisabledMail until a separately approved provider adapter is supplied through the interface; no existing SMTP/vendor configuration was found. Development/test MemoryMail retains bounded short-lived messages in private process memory, exposed only to test/development code, not HTTP/console. AUTH_ENABLED and AUTH_ALLOW_SIGNUP remain off by default. Dedicated independent secrets required; no new hardcoded production secrets. Current HMAC key version1 has no previous-key fallback: rotating it invalidates pending proofs, which can be resent explicitly.

Auth retention cleanup is implemented as a programmatic service operation, not an automatically installed job. It only removes expired auth state/rate buckets; enrollment approval audit records are retained until explicit retention policy, never silently purged. Session/key execution and account key administration remain deferred; signin shows identity plus the existing manual tool.

## Verified implementation checkpoint

78 automated tests passed (zero failed/skipped) against disposable Postgres16/Redis; migration UP/DOWN/UP preserved every original table snapshot. Local Chrome157 Playwright passed 10 auth layout/theme combinations and 10 flows, including actual isolated sign-in, invalid/expired codes, resend/cancellation, fresh verification/logout-all, keyboard/reduced motion, mobile, network and throttle recovery. Existing landing/explorer regression passed 20 layouts. Tests use private in-memory mail only; no production connection or real delivery. See evidence/test-summary.json, evidence/browser-qa.json and operations.md.

Independent security review identified preapproval proof acceptance and definite-delivery rejection recovery; both were reproduced before fixes and covered by regressions. Additional rolling-rate-boundary, concurrent consume/resend/reauth, stale delivery callback, operator authorization and sanitized CLI-error tests passed.

Historical account lookup additionally checks normalized email through a nonunique index. Noncanonical or ambiguous legacy records cannot create a replacement account or be silently normalized/merged; they require a separately reviewed data decision. Existing balances, keys, frozen benefits and related business rows are untouched.

No lint/typecheck/build npm scripts exist; JavaScript syntax, frontend asset drift and git whitespace checks passed. Provider-dependent suites were excluded to avoid live upstream requests. Real-mail deliverability, actual TLS/proxy ingress, cross-browser/real-device/full accessibility and production performance remain release tasks. Session-authenticated product execution remains a separate architecture phase.
