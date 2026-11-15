# KanjutGede — implementation roadmap

## Model routing (human-controlled)
The user mentioned GPT-6 Astra, GPT 6.1 Solana and GPT 6.1 Luna. These are user-supplied labels, not verified model IDs or benchmark rankings. Inspect the actual Codex model selector/provider and available reasoning settings; do not hard-code aliases, claim capabilities, or switch models automatically. If available, evaluate each on the same bounded task (hero composition, component implementation, API contract/security review), compare visual output, correctness, tests and cost/latency. Assign strongest demonstrated visual model to art direction, strongest demonstrated coding model to implementation, strongest demonstrated reasoning model to architecture/security and final review. A suggested trial order is Astra for architecture/review, Solana for visual exploration, Luna for implementation/QA; this is a hypothesis, not a capability claim. Use the best available model for difficult components; smaller/faster only for routine work if quality holds. Keep handoffs in repo notes: phase, decisions, changed files, screenshots, tests, blockers, next action. No Hermes dependency.

## Phase 0 — audit (start here)
Read AGENTS/DESIGN/skill. Inspect git status, framework, package manager, route tree, styles, auth/key storage and reveal policy, endpoint registry, response schemas, billing/rate limits, existing tests, root icon.png, current dependencies. Identify actual backend contracts and current UX. Capture baseline screenshots at desktop/mobile and both themes if available. Record findings and gaps in a concise audit note. Do not rewrite backend or install redundant packages. Confirm whether secure auto-fill or selected-key execution is possible. Exit: factual inventory, prioritized issues, baseline evidence, explicit blockers.

## Phase 1 — art direction and landing prototype
Produce two materially different compositions (editorial artwork-led and typography-led), not cosmetic palette variants. Use actual logo and copy. Compare visual hierarchy, personality, usability, mobile and asset cost. Choose one, document rationale. Build a bounded landing prototype with navigation, hero, API demo, catalog preview, factual value section and CTA. No fake metrics or placeholders presented as real. Ask for custom asset only if necessary, with brief, format, dimensions, budget and fallback. Exit: screenshots desktop/mobile, both themes, no visual noise, clear CTA, coherent composition. Do not expand dashboard before landing direction is validated by user or explicit authorization to proceed.

## Phase 2 — foundations and component system
Implement semantic tokens, typography, spacing, layout, theme initialization/persistence, reusable buttons, inputs, tabs, toggles, menus, dialogs, status, copy feedback and loading/error states. Build a local component preview if useful, not a public production route by default. Test keyboard, focus, touch, reduced motion and theme contrast. Exit: consistent states, no theme flash, no duplicated primitives, screenshots and tests.

## Phase 3 — landing production and motion
Integrate approved landing composition into real routes. CSS first; GSAP for meaningful sequences; use Motion only where component needs justify it. Rive/Three/Lenis optional after static baseline. Verify cleanup, reduced motion, mobile native scroll, no offscreen loops. Use actual catalog/pricing links. Exit: responsive production build, visual QA, measured performance baseline and improvements.

## Phase 4 — API explorer/docs/playground
Derive UI from actual endpoint metadata and auth contract. Implement searchable catalog, endpoint details, parameter editor, secure default key selection/autofill with manual override, empty TikTok URL input, request preview, explicit execution, response JSON/raw/tree, sanitized headers, field explanations, cURL/JS/Python snippets, copy, error recovery. Use existing backend or authorized dev/test environment; do not send paid/live requests without authorization. Use fixtures for automated tests and label examples. Add tests for auth/key isolation, no secret leakage, missing key, invalid URL, request cancellation, timeout, 401/403/429/5xx, malformed/large JSON, clipboard failure, responsive layout and keyboard. Exit: verified contract and end-to-end flow, real or clearly labeled fixture evidence, no secrets in logs/storage/screenshot.

## Phase 5 — dashboard and account surfaces
Only after landing and explorer foundations. Integrate existing account, keys, usage, quota, billing and status with real data. No invented stats. Preserve business logic. Handle empty/loading/error/permission states and destructive confirmation. Exit: regression tests and accessibility/visual QA.

## Phase 6 — release-quality review
Run repository lint/typecheck/unit/integration/build commands. Playwright desktop/mobile, both themes, reduced motion, keyboard, route navigation, key flow, request/response and copy. Check console/network errors, screenshots, layout overflow, contrast, accessibility and production performance (Lighthouse/DevTools or available equivalent). Profile motion on representative hardware; report limits of emulation. Review dependency/bundle cost, secret leakage and backend regressions. Fix issues, rerun checks. No deployment without explicit authorization.

## Reporting template per phase
- Scope and model used (actual label, if known)
- Decisions and reasons; deviations from DESIGN
- Changed files and commands
- Screenshots/test evidence and measured metrics
- Blockers, failures, unverified assumptions, remaining risks
- Next phase and whether approval is needed

## Initial Codex prompt
Read AGENTS.md, DESIGN.md, PLAN.md and .agents/skills/creative-frontend/SKILL.md. Start Phase 0 only. Inspect actual repository and icon.png; establish facts, screenshots, auth/key constraints and baseline. Do not redesign or change backend yet. Return audit and two proposed landing compositions with rationale and asset needs. After approval, proceed phase by phase, testing and documenting evidence. Maximize quality through iteration, not decorative complexity.

## Execution checkpoint — 2026-11-15

- [x] Phase 0: factual inventory and prioritized gaps recorded in `docs/ui-audit/phase-0.md`; baseline desktop/mobile captures under both system themes in `docs/ui-audit/evidence/`. Original frontend supports dark only.
- [x] Phase 0: confirm key policy — hash-only/reveal-once, no session execution path; explicit manual key entry required under current contracts.
- [x] Phase 0: registry tests (5 passed), syntax and whitespace checks; full DB/upstream integration tests deferred until isolated infrastructure is available.
- [x] Phase 1 exploration: two isolated compositions in `docs/design-preview/`, optimized logo derivative, both themes, local demo and factual catalog. 20 viewport/theme checks and interaction checks passed via local Playwright fallback; screenshots recorded.
- [ ] Phase 1 approval: operator chooses A artwork-led or B typography-led (recommended). Latest master protocol explicitly requires this approval before broad redesign.
- [ ] Phase 2 onward: continue foundations and approved landing integration after the choice. Production performance and complete product acceptance remain unverified.

Model policy clarification: latest master protocol supersedes the trial-order suggestion above. Continue current operator-selected GPT-6.1 Solana High label while progress is satisfactory; runtime mapping unverified. No switch, benchmarking or provider configuration change performed.
