---
name: creative-frontend
description: Art-direct, implement, animate, and visually validate KanjutGede frontend, including landing pages, accessible components, theme systems, API documentation and interactive request-response playgrounds. Use for UI/UX, motion, responsive design and browser QA tasks.
---
# Creative frontend engineering

Read repository AGENTS.md, DESIGN.md and PLAN.md. Inspect actual code and contracts before changes. Work as a creative developer, product designer and frontend engineer; do not substitute aesthetic jargon for visual decisions.

## Workflow
1. Identify user goal, current phase, screen, constraints and actual data. Inspect existing screenshots and component states.
2. Establish hierarchy, composition, typography, artwork and interaction intent. For major screens compare two genuinely distinct compositions. Remove every element without a functional, communicative or deliberate artistic role. No stickers, micro-labels, decorative badges, fake telemetry or generic SaaS grids.
3. Implement semantic HTML and reusable primitives using existing framework and tokens. Design both themes, mobile and keyboard states. Use root icon.png as approved asset; optimize derivatives without overwriting.
4. Design component states before animation: idle, hover, focus, pressed, disabled, loading, success, error. Preserve layout, accessible names and focus. Buttons deserve careful silhouette, optical alignment, tactile press and clear hierarchy, not arbitrary decorations.
5. Motion: CSS first; GSAP timeline/ScrollTrigger for coordinated landing sequences; Motion for React for state/layout; Rive for justified interactive artwork; Three.js for justified 3D; Lenis optional only after native scroll baseline. One owner per property, cleanup on unmount, pause offscreen/hidden, reduced-motion fallback. No scroll hijack, unnecessary loops or animation that hides content.
6. API UI: use real contracts; secure default key selection/autofill only if authorized and technically supported; masked display, manual override, empty user URL field, explicit execution, actual JSON and field explanations, sanitized headers, copyable cURL/JS/Python with environment variable keys. Never invent endpoints/fields or expose secrets. Follow DESIGN security details.
7. Browser QA: use Playwright MCP if available to open dev server, inspect desktop/mobile, both themes, keyboard, hover/press, scroll, reduced motion, loading/error states and console. Capture screenshots at meaningful states. Use repeatable automated tests for behavior. If browser unavailable, report limitation. Do not claim screenshot or performance checks not performed.
8. Review actual output: focal point, spacing, contrast, readability, alignment, touch targets, layout overflow, interaction latency, motion purpose, asset/bundle cost. Fix and repeat. Measure production build performance where possible. Record evidence and blockers.

## Motion implementation checklist
- Prefer transform/opacity, but profile rather than assume compositor performance.
- Avoid layout reads/writes per frame, excessive layers, heavy blur and continuous render loops.
- GSAP React integration: scope animations to component and clean up context; register only used plugins; refresh scroll measurements when layout changes.
- Motion: stable keys, explicit state transitions, no duplicate GSAP ownership.
- Rive/Three: lazy load, static fallback, resize correctly, dispose instances/resources, cap DPR if appropriate.
- Lenis: only if justified, preserve anchor/focus behavior, native touch scroll, reduced motion; avoid duplicate RAF loops.
- Audio optional, off by default, user gesture required, no autoplay.

## Deliverable
Provide changed files, rationale, screenshots or test evidence, actual commands and results, measured performance if available, known gaps and next step. Never declare complete solely because code compiles. Quality means a real user can use the interface comfortably, not that a screenshot looks busy.

## Active project direction
As of 2026-11-15 use MASTER.md and revised DESIGN.md: ANIME INTERNET UNIVERSE. Editorial prototypes are rejected history. Explore two distinct original characters/worlds, purposeful layered animation, kinetic title, tactile controls, light/day and dark/night. Concept art and temporary procedural rigs are not production Live2D models. Preserve all API/security/accessibility requirements above.

## Operator approval — 2026-11-15

B — Pocket Mischief is approved. Continue shared foundations, landing integration and manual-key explorer autonomously using existing backend contracts. A remains exploration history. Approval covers visual direction, not a session-authentication architecture change, deployment or paid/live QA requests. See docs/implementation/pocket-integration.md.
