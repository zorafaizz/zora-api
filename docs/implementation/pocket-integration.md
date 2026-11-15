# Pocket Mischief integration plan

Operator approved B on 2026-11-15. Native execution continues autonomously per master protocol; no extra planning approval or commits. Scope: shared foundations, approved landing integration, manual-key explorer; no session/backend changes. This supersedes earlier pending A/B checkpoints.

- [x] Record B approval in MASTER/DESIGN/PLAN/state; preserve A and rejected editorial history.
- [x] Add shared semantic tokens, accessible theme controls (system + persisted preference), reduced-motion/reaction settings, reusable Momo SVG and finite interruptible gestures. Keep logo original.
- [x] Integrate B into public/index.html; static content and native navigation work without JS, optional intro lazy-loads existing GSAP, no live requests on mount. Registry snapshot generated directly from source, checked for drift; keep backend unchanged.
- [x] Add /explorer.html with real registry-derived forms, deep links, explicit manual-key execution to same-origin versioned routes, quota notice, cancellation/timeout/errors, bounded response rendering, sanitized headers and key redaction. Support safe synchronized cURL/JS/TS/Python snippets, tree/raw JSON, field explanations only where verified. Keys only in memory, no history/storage/logs/URLs/snippets. No session-authenticated execution until architecture reviewed.
- [x] Unit tests first for request construction, quoting, secret redaction and bounded response handling. Browser fixtures first for request execution; never call live providers in QA.
- [x] Browser desktop/mobile/day/night, keyboard, touch, intro skip, motion lifecycle, sample/live labeling, error/cancel/clipboard, no automatic API requests, no secret persistence and source schema drift. Local performance measurements with clear limits.
- [x] Update state/evidence. At architecture boundary: session login/default-key provisioning and account onboarding need an operator decision; do not implement auth changes under a visual approval.

Risks: incomplete endpoint-specific output schemas, unverified provider behavior, no sign-in contract; current SVG style approved as direction but not externally rigged art. Use existing system fonts until font rights explicitly settled. Full integration suite cannot run against unverified DB/billing infrastructure. No deploy.
