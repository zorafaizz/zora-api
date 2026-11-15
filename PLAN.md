# KanjutGede — Anime Internet Universe roadmap

## Authority and history

Follow MASTER.md, AGENTS.md and current DESIGN.md. Previous roadmap and decisions preserved in docs/history/PLAN-before-anime-reset.md; previous previews in docs/design-preview/ are rejected as final visual directions. They are historical engineering evidence only. Current reset authorized by operator on 2026-11-15. No automatic model switch; last operator label GPT-6.1 Solana High, runtime mapping unverified.

## Phase 0 — preserved audit

- [x] Repository/contracts/auth/quota/billing inventory and baseline evidence: docs/ui-audit/phase-0.md.
- [x] Verify hash-only reveal-once keys and absent session execution path.
- [x] Preserve pre-existing package/lockfile edits and original icon; existing backend unchanged.
- [x] Document rejected visual directions and reset authority. MASTER.md was missing and has been created from current operator instructions.

## Phase 1R — two anime worlds (exploration completed; B approved)

- [x] Write distinct concepts, character silhouettes, palette, typography, component and motion specs in DESIGN.md.
- [x] Generate original Nami and Momo concept art; record provenance, source prompts, optimization and pending production approval.
- [x] Build isolated interactive prototypes under docs/anime-preview/: desktop/mobile, day/night, explicit optional opening, character interaction, tactile controls, actual registry discovery and local API fixture states.
- [x] Browser QA: 320/390/768/1280/1440 × both themes × both concepts, pointer/touch, keyboard, opening/skip, reduced motion, search, request loading/errors/cancel/copy and no live execution.
- [x] Capture screenshot/motion evidence and measure local rendering with limitations. See docs/anime-preview/QA.md; A intro frame spikes remain a production risk.
- [x] Present both worlds plus asset briefs and receive direction approval. Operator approved B — Pocket Mischief.

## Phase 2 — approved character and foundations

Implement approved world's tokens, typography (licensed/subset fonts), accessible component states, theme prepaint/persistence/system handling, optional animation controls and interruption model. Commission/approve separated character art and rig or refine procedural SVG production quality. Validate static fallback, both worlds, contrast, keyboard, mobile, touch, hidden/offscreen suspension and cleanup.

## Phase 3 — landing production and motion

Integrate approved direction into existing Express/public routing, optimized responsive assets and static defaults. Intro opt-in/skip, no essential-content gate, no sound, no repeated automatic playback. Character reacts in finite actions; native scrolling. Measure production bundle/startup/LCP/CLS and frame behavior on documented devices/network, not just local fixtures. No production performance claim from prototype testing.

## Phase 4A — session execution architecture review

Propose secure account session provisioning and execution before changing backend. Preserve hashed key storage. Review ownership, CSRF, scopes, schema validation, quota and billing transaction lifecycle, rate limits, safe logging, abuse prevention, account isolation and manual-key compatibility. No implementation until review/authorization resolves missing login/session contract.

## Phase 4B — API explorer/docs/playground

Use actual registry/OpenAPI and verified scraper outputs; fill schema gaps without inventing fields. Search/filter/deep links, generated parameter forms, empty user URLs, explicit real execution, cancellation/timeout/errors, measured status/latency, sanitized headers, JSON/raw/tree, field explanations and safe synchronized cURL/JS/TS/Python snippets. Manual key in memory only until a reviewed session path exists. Character reactions supplemental/optional. Distinguish fixture/example/live. Do not send live/paid requests without authorization.

## Phase 5 — account and dashboard

Integrate existing keys, wallet, ledger, usage, quotas and billing contracts. No fake numbers/plans; no plaintext retrieval. Empty/loading/error/permission states and destructive confirmations. Requires actual onboarding/auth contract first.

## Phase 6 — release quality

Run available lint/typecheck/tests/build; missing scripts are reported. Full tests only on verified isolated infrastructure with provider fixtures. Desktop/mobile, day/night, keyboard, touch, reduced motion, intro skip, all request states, copy failure, real/large/malformed JSON, secrets/account isolation, contrast/zoom and cross-browser QA. Measure startup, interaction, frame consistency and memory. Report unverified limits. No deployment/production-data writes without authorization.

## Checkpoint discipline

Maintain STATE.md after meaningful milestones. HANDOFF.md records exact resumable scope and evidence. Switch models only for a specific evidenced need, checkpoint and wait for operator. Report changed files, commands, failures, screenshots/recordings, measured environment, risks and next action. Never declare production complete from prototypes.

## Operator approval — 2026-11-15

B — Pocket Mischief is approved. Continue shared foundations, landing integration and manual-key explorer autonomously using existing backend contracts. A remains exploration history. Approval covers visual direction, not a session-authentication architecture change, deployment or paid/live QA requests. See docs/implementation/pocket-integration.md.

## Implementation checkpoint after B approval

- [x] Phase2 shared foundations: semantic day/night/system themes, native accessible controls, Momo SVG reactions and reduced/offscreen motion. System fonts retained.
- [x] Phase3 landing integrated into public/index.html; lazy opt-in opening, actual catalog, local example, real docs links. No deployment.
- [x] Phase4B supported manual-key execution UI in public/explorer.html; tests use intercepted fixtures only. Native bridge docs-only; endpoint-specific schema completion remains.
- [x] Local browser20layout/theme checks and fixture flows;14 unit/registry tests; asset drift/syntax/whitespace checks and local profile recorded in docs/implementation/pocket-qa.md.
- [x] Phase4A sign-in/credential policy approved and isolated implementation verified (see auth checkpoint below).
- [ ] Phase4A session-authenticated API execution: separate architecture review and implementation; manual-key playground remains independent.
- [ ] Phase5 account/onboarding and Phase6 full integration/real-device/cross-browser/release QA pending. Full suite needs isolated DB/Redis/provider fixtures.

## Email sign-in design checkpoint — 2026-11-15

- [x] Operator selected email sign-in as the account direction.
- [x] Inspect actual account/key/schema/mail/auth/rate/quota contracts and document constraints.
- [x] Draft concrete email-code/session/CSRF design, compare magic links/passwords, record rollout and test criteria: docs/auth/email-sign-in-design.md.
- [x] Independent builder review: resolved unsafe historical wildcard-key claim, missing reauth contracts and initial key-selection stage mismatch. Reviewer found no remaining blocking contradiction after revisions.
- [x] Operator approved email OTP and operator-reviewed historical enrollment for implementation and isolated testing only.
- [x] Implemented disabled-by-default auth router, additive migration, HMAC OTP, transactional rolling throttles, sessions/CSRF/reauth/logout, privileged enrollment CLI and in-memory test delivery. Production migration and real sends not performed.
- [ ] Before launch: mail transport/sender configuration, historical ordinary/service identity classification, actual TLS/trusted proxy and security/retention review. No provider chosen or spending authorized.

## Email OTP implementation checkpoint — 2026-11-15

- [x] Independent security review; reproduced and fixed preapproval-proof acceptance and mail-rejection recovery findings. Added race, timeout, cancellation, rolling-rate-boundary and historical identity regressions.
- [x] Isolated Postgres16/Redis: 78 tests passed, zero failed/skipped; original table snapshots preserved through migration UP/DOWN/UP. Relevant billing, quota, Bearer, concurrency and resilience regressions included.
- [x] Local Playwright/Chrome157: 10 auth viewport/theme combinations and 10 flows, plus existing frontend 20 layouts; zero page errors. Empty-form screenshots and machine-readable results: docs/auth/evidence/.
- [x] Frontend asset drift, JavaScript syntax and git whitespace checks. No project lint/typecheck/build npm scripts exist; static asset check used.
- [ ] Production activation: approved real transport/sender, TLS/proxy/secrets/service classification, representative migration/lock review, cleanup scheduling and separate migration/delivery/deployment authorization. Full cross-browser/real-device/performance QA remains open.

Detailed scope, commands, review fixes and deployment gates: docs/auth/operations.md. Existing package/lockfile and unrelated frontend edits preserved; no new dependencies or commits in this phase.

## Current priority — creative production handoff (operator-directed)

Authentication milestone is accepted for development and isolated testing. Production sender/transport, infrastructure, migrations and deployment are deferred; do not spend this phase on activation. Earlier launch checklists remain future release requirements, not the next task.

- [x] Preserve accepted OTP/session/enrollment implementation, account identities, hashed/reveal-once keys, billing/quota behavior and regression suite. Evidence: 78 automated tests; isolated migration UP/DOWN/UP original snapshots unchanged; Playwright10authlayouts/10flows +20existingfrontendlayouts, zero page errors. See docs/auth/evidence/ and operations.md.
- [x] Inventory native Express/static frontend, shared B/Momo/theme/request architecture, installed motion dependencies, both anime prototypes, rejected editorial history and approved root icon.png in STATE.md/HANDOFF.md.
- [x] Prepare manual switch to GPT-6 Astra at highest practical supported effort; current operator label remains Solana High until operator changes it. Reason: independent demanding creative production assignment explicitly requested by operator, not an auth blocker.
- [x] Operator switched to runtime-confirmed GPT-6 Astra and resumed; effort setting unverified. Resume instruction: Continue from HANDOFF.md and STATE.md. Execute the next task.
- [ ] Astra: independently develop a concrete production treatment within approved Pocket Mischief/Anime Internet Universe; build on engineering foundations and do not restart A/B selection or auth audit. Refine original character silhouette, expressions, personality, materials and shared visual language. A material departure from approved B needs an explicit design decision.
- [ ] Define cinematic opening shot/timing/transition plan (approximately2–4seconds, justified by tests), character-linked kinetic typography, layered pointer physics, choreographed scroll scene handoffs, youthful day/night art direction, tactile control states and real API-state acting. Native scroll, immediate content, optional Skip/Escape, reduced-motion/static and no autoplay audio remain mandatory.
- [ ] Refine/request production asset briefs: original character sheets, clean layered illustration/rig, expressions/day/night lighting, responsive environment art/posters; optional Live2D/Rive/video only if justified. Preserve provenance/rights/optimization/status manifest. Temporary assets must be labeled; no weak placeholder final art.
- [ ] Implement bounded coherent creative increments across landing, explorer and sign-in; functional tools remain efficient. Connect existing companion state events to actual request outcomes without changing authentication or execution contracts. No session executor, automatic/paid provider calls or secret-bearing captures.
- [ ] Capture desktop/mobile, both themes, keyboard/touch/reduced-motion, pointer/scroll, intro skip, character/state and component evidence; review frames/recordings visually, measure actual startup/interaction/rendering costs. Run relevant existing regressions; preserve all78passingtests with isolated runner when runtime changes warrant it.

Acceptance: a coherent, original anime universe with production-quality character/art/motion and clear developer tools. Corporate editorial/industrial/enterprise SaaS/dashboard compositions, meaningless stickers/badges/technical annotations, fake metrics and clutter remain rejected. Existing performance targets are goals, not claims. Required assets or material design decisions should be requested precisely; no infrastructure work or production activation in this phase.

## Astra first creative increment — 2026-11-15

- [x] Independent concrete treatment within approved B: docs/creative-production/TREATMENT.md; scarf/portal concept, acting score, cinematic sequence, typography and day/night worlds.
- [x] Isolated working hero/character study: damped independent gaze/head/ear/scarf, optional2.8s opening, tactile action, scroll framing, reduced-motion/offscreen behavior and explicit simulated request states.
- [x] Local Playwright eight desktop/mobile theme layouts and interaction checks; screenshot review fixed clipped/wrapped title. Evidence: docs/creative-production/evidence/. No new runtime dependency or backend/public auth change.
- [x] Precise original character layer/pose/expression/day-night briefs, conditional Rive/Live2D and video delivery requirements. Current proxy honestly temporary.
- [ ] Obtain and approve production-quality original layered character package; refine acting with delivered art. No asset commission/spending authorized.
- [ ] Integrate approved art/motion across public landing/explorer/sign-in, then existing regression and measured performance/accessibility QA. Authentication and production infrastructure remain outside creative changes.
