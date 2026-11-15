# Email OTP implementation plan

Approved by operator for implementation and isolated testing only. Native execution; no commits, production migrations, real sends or deployment.

- [x] Isolated Postgres cluster and test runner; additive002 auth schema. Snapshot original account/key/wallet/quota/ledger data before and after migration/authentication.
- [x] Failing integration tests first; cryptographic OTP/HMAC, browser-bound flows, atomic attempts/resend/consume, persistent fail-closed rate buckets, session/CSRF/reauth/logout, audited operator enrollment. Pg transactions own identity/session state. Existing Bearer pipeline untouched.
- [x] Provider-neutral delivery interface, bounded in-memory development/test adapter, disabled production adapter until explicitly supplied/configured; no console codes or secret HTTP endpoints.
- [x] Auth router mounted before global CORS/legacy guards with4KB JSON, exact Origin/CSRF, secure host cookies, generic errors. Feature disabled by default; isolated local configuration may use loopback nonsecure cookies with distinct names, never production.
- [x] Pocket Mischief sign-in/session UI with single pasteable8digit input, resend/change/email/network/expiry states, safe local destination, logout/fresh verification. Manual playground remains credential-omit and separate.
- [x] Isolated automated and browser tests; relevant regressions; independent security review, reproduce/fix important findings, update evidence/state/rollout docs.

Ruling: auth throttles use transactional Postgres rolling timestamp buckets, not Redis, keeping attempts/limits authoritative and fail-closed without an additional dependency. Existing Redis API limiter remains unchanged. No durable plaintext OTP outbox. No live mail transport chosen because no existing configuration/adapter was found; injection interface supports later provider integration.

Verified checkpoint: 78 automated tests passed, migration UP/DOWN/UP preserved original table snapshots, 10 auth viewport/theme combinations and 10 browser flows passed. Existing frontend regression: 20 layouts, zero page errors. See evidence/ and operations.md. Production rollout and live delivery remain separate gates.
