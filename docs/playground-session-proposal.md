# Session-authenticated playground — architecture proposal (not implemented)

## Observed constraints

server.js exposes API-key-authenticated account and key management; no browser login/session issuance exists. createApiKey reveals rawKey once; listApiKeys never returns it. authMiddleware verifies Bearer/X-API-Key/legacy query keys. quotaGuard consumes account test/daily quota and reserves/captures/releases paid credits. Rate limiter currently precedes authentication, so key-type branches are not populated. No frontend code can safely infer an authenticated account or recover a stored key. Existing backend remains unchanged.

## Proposed boundary

First choose/review an account sign-in and recovery mechanism. Without that contract, do not add a session bypass route. Use a secure HttpOnly, Secure, SameSite cookie with server-side expiring/revocable session records and rotation on sign-in/privilege change. Never place API secrets or session credentials into localStorage or HTML. Same-origin execution only, strict Origin checks plus per-session CSRF token for state-changing/session execution requests; retain credential-free explicit manual-key path.

A proposed execution action accepts registry endpoint ID, owned selected-key public identity and schema-validated parameters. It must not accept arbitrary proxy URLs/methods/headers or account IDs. Server authenticates session, derives account, loads the owned non-revoked/non-expired key policy record, enforces its IP allowlist and endpoint scopes, and constructs a principal with explicit live/test semantics. Do not synthesize a wildcard principal or generate new API keys per request. This requires defining which existing key policy applies by default; no default-key field currently exists. Unknown ownership is rejected, never fallback to legacy account.

Refactor only after review so both API-key and session authentication feed one shared validated execution pipeline. Ordering: request context -> authentication -> verified principal rate limiting -> endpoint permissions/validation -> existing quota and credit reservation -> existing handler/provider -> existing capture/release and error envelope. Preserve price-version behavior, deadlines and one charge per explicit request. Avoid loopback HTTP forwarding that could double-charge, bypass scope checks or create SSRF. No automatic retries. Cancellation abort semantics must distinguish browser disconnect from upstream completion/credit capture; never refund merely because UI stopped waiting.

Log account/key public identifiers and request ID only where policy permits; redact cookie, Authorization and sensitive parameters from all error/observability paths. CORS stays narrow for cookie-authenticated route; do not broaden existing public API policy as a shortcut. Use existing sanitized response envelopes. Re-check ownership/revocation at execution, not only at session issue.

## Required review and tests

Review sign-in/session issuance, default key and live/test consent, expiration, IP policy, principal mapping, middleware ordering and transaction lifecycle before implementation. Verify cross-account key selection, revoked/expired keys, missing scopes, CSRF/origin rejection, rate isolation, quota exhaustion, insufficient credits, timeout/cancel/success/failure ledger outcomes, concurrent requests, session logout/rotation and secret logging/storage checks in isolated Postgres/Redis/provider fixtures. No authenticated production requests or migrations are authorized by this proposal.

## Email sign-in design update — 2026-11-15

Operator selected email sign-in. Concrete proposed design: [Email sign-in and account sessions](auth/email-sign-in-design.md), independently reviewed, awaiting operator approval. Email-code identity/session phase preserves manual-key execution; it does not imply the proposed browser executor already exists. Historical accounts need operator-reviewed enrollment; existing wildcard-key minting behavior is not a safe ownership bootstrap.
