# KanjutGede — repository operating instructions

## Mission
Build a premium REST API product: simple in appearance, sophisticated in execution. Preserve the existing backend, contracts, authentication, billing, quotas and business logic. Codex is the implementation agent; do not depend on Hermes memory or skills.

## Read order
Read this file, DESIGN.md, PLAN.md, and `.agents/skills/creative-frontend/SKILL.md` before substantial UI work. Inspect actual repository structure, package manager, routes, API schemas, auth and existing components. If documentation conflicts with actual contracts, verify and report; never silently invent a contract. DESIGN defines experience, PLAN defines sequencing, this file defines non-negotiable rules. Keep all four consistent.

## Non-negotiables
- No decorative stickers, micro-labels, fake serial numbers, random stars, ornamental HUD, fake telemetry, gratuitous borders, neon hacker visuals, generic SaaS bento grids or repetitive card sections. Detail the experience, not the clutter.
- Use root `icon.png` as the approved brand asset. Inspect it before use; preserve its identity and underwear motif. Generate optimized derivatives only if needed, never overwrite original. Verify framework-specific asset paths; do not assume root files are publicly served.
- Landing page expressive; docs, dashboard and playground calm, clear, efficient. Dark/light toggle mandatory, with system preference and persistence. Both themes must be designed, not inverted.
- No invented endpoints, metrics, prices, uptime, response fields, capabilities or provider claims. Use real contracts and sanitized examples; label mocks explicitly.
- No secrets in source, logs, analytics, screenshots, URLs, generated examples, persistent browser storage or clipboard without explicit action. Never expose server-only keys. Auto-fill only a user-authorized, client-usable key through an existing secure mechanism. If keys are reveal-once or only hashed, use a masked selected-key state and authenticated server-side execution where supported; otherwise require manual entry. Never weaken key storage to satisfy UX.
- Never send a live request on mount, typing, theme change or hover. Explicit Execute only. Honor quotas, billing and rate limits; disclose billable requests. Do not bypass authentication, CORS or provider restrictions.
- Do not overwrite unrelated work, reset branches, commit secrets, deploy, run destructive migrations or change production infrastructure without authorization. Inspect git status; preserve user edits. Use existing package manager and lockfile.

## Working loop
1. Audit and record actual facts, gaps, dependencies and screenshots in working notes.
2. Select one bounded PLAN phase; establish acceptance criteria and relevant DESIGN sections.
3. Implement small coherent changes, using existing primitives where suitable.
4. Run relevant lint, typecheck, tests and build; inspect browser via Playwright MCP when available. Check desktop, mobile, keyboard, both themes, reduced motion and error states.
5. Review screenshots and traces; iterate on actual problems, not imagined quality. Record files changed, checks run, failures, remaining risks and next phase. Never claim unperformed checks.

## Tools
CSS first; GSAP + ScrollTrigger for complex landing choreography; Motion for React for component/layout transitions; Rive only for justified interactive artwork; Three.js only for a proven 3D need; Lenis optional, native scroll default. Avoid multiple libraries controlling the same element/property. Use Context7 for version-specific docs when available. Playwright MCP for browser interaction and screenshots; use existing automated test tooling for repeatable tests. If MCP unavailable, use local browser/test tools or report blocker. No need to install all libraries or add dependencies already present.

## Definition of done
Actual user flow works, real data or explicitly marked fixtures, both themes, responsive layouts, accessible controls, reduced motion, no secret leakage, no unnecessary animation loops, no regressions, evidence of tests and visual QA. Performance targets are goals, not claims. Ask for a decision only for material ambiguity, risky changes or missing assets/contracts that block progress. Otherwise proceed with reversible defaults and document them.

## Creative reset — 2026-11-15
The operator's ANIME INTERNET UNIVERSE protocol supersedes the former editorial visual direction. Read MASTER.md and current STATE/HANDOFF on resume. Preserve rejected prototypes as history; do not use enlarged icon artwork or cream/cobalt styling for the new hero. Two original anime concepts must be prototyped and reviewed before production redesign. Character assets and temporary rigs must be honestly labeled. Existing security/contract/noise rules remain in force.

## Operator approval — 2026-11-15

B — Pocket Mischief is approved. Continue shared foundations, landing integration and manual-key explorer autonomously using existing backend contracts. A remains exploration history. Approval covers visual direction, not a session-authentication architecture change, deployment or paid/live QA requests. See docs/implementation/pocket-integration.md.

## Email sign-in architecture checkpoint
Operator selected email sign-in design on 2026-11-15. Read docs/auth/email-sign-in-design.md before auth work. Email codes and conservative historical enrollment are proposed/reviewed architecture, awaiting operator approval before code changes. Existing frontend/manual-key/auth/quota/billing contracts remain unchanged.

## OTP implementation authorization
The operator approved email OTP architecture for implementation and isolated tests on 2026-11-15. No further routine implementation approval is needed. Do not send real mail, migrate production or implement session API execution. Use isolated temporary Postgres/Redis and memory mail for validation. Keep manual API-key execution and all existing data/contracts intact.
