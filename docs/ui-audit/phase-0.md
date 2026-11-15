# Phase 0 audit — 2026-11-15

## Scope and preservation

Operator-selected lead: GPT-6.1 Solana High (provider label; actual runtime mapping/settings not verified; no model change). Read AGENTS.md, DESIGN.md, PLAN.md and creative-frontend skill in full. Latest master protocol authorizes isolated composition previews before a single landing approval; this supersedes PLAN's older “Phase 0 only” initial prompt. DESIGN overrides the generic anti-ai-slop skill's palette and clone aesthetic. No backend redesign, commits, deployment or production data operations.

Pre-existing changes: PLAN.md, package.json, package-lock.json modified; .agents/, AGENTS.md, DESIGN.md, icon.png, kanjutgede-codex.zip untracked. Preserve all. Newly created artifacts are state files, this audit, preview sources and evidence. PLAN progress is appended without removing requirements.

## Actual inventory

- Node ESM + Express 5.3 declaration; npm/package-lock.json and installed node_modules. No React application, bundler or component library. Frontend: public/index.html, inline CSS/JS, external Google fonts. Static files served only from public/. Root icon.png is not publicly served.
- Public routes before guards: /api/v1/openapi.json, /docs and /api/v1/docs (Scalar via external unpinned CDN), /health and /api/v1/health. Health contains real process information; avoid publishing baseline live details.
- Source of truth: src/registry/endpoints.js contains 42 records across System, Downloaders, AI & LLM, Image & Media, Information & Data, Search & Discovery, Utilities, Social & Public Profiles, Solvers. Registry is metadata; server.js manually implements routes/aliases.
- OpenAPI maps ALL to GET and documents canonical paths, not every alias or account/billing route. Endpoint query parameter rules are manually enumerated in src/modules/docs/openapi.js. Schemas only specify common envelope with untyped result/data. /health actually returns a different shape than its generated generic success schema. Confirm actual scraper fields before field explanations; do not infer provider/model capability from a name.
- Protected routes accept Authorization Bearer, X-API-Key and legacy query apikey. Prefer headers in all new UI. No login/session, default-key attribute or selected-key server execution mechanism found. Key creation returns rawKey once; database stores hash, listing exposes public identity only. Manual in-memory key entry is the safe supported explorer path. Automatic retrieval of existing plaintext keys is impossible under current storage.
- Account/key/wallet/ledger/pricing/reactivation/topup routes exist under /api/v1 and require a key. No public signup/login UI or public pricing plans. Do not invent account/access destinations. Existing docs may be linked; account onboarding needs a later contract decision if required.
- Quotas in source: 50 account lifetime test requests, 20 daily free live requests for eligible endpoints using Asia/Jakarta reset; inactivity freeze after 120 hours; paid credits reserved/captured/released in middleware. These are policies, not current user balances. Pricing endpoint lists registry policies, not subscription plans.
- Rate limiter runs before auth: nominal live/test branches use req.apiKey but it is unset at that stage; effective default is IP-based 60/min unless other middleware supplies it. Never advertise nominal 120 live/min. Redis failure is fail-open. Reported only; preserve backend.
- Dependencies already include gsap, motion, lenis, three, @react-three/* and sharp. None needed in these static previews. No reason to add a frontend framework or animate continuously.
- Commands: start = node server.js; test = node --test tests/**/*.test.js. No lint, typecheck or build scripts. Tests include DB mutations, billing reservations and real upstream calls. Running full suite on existing unverified infrastructure would conflict with production-data restrictions; defer until isolated Postgres/Redis and provider fixtures are available.

## Prioritized gaps

1. Keys cannot be auto-filled from hash-only storage. Use explicit manual entry in future explorer; no backend auth changes assumed.
2. Endpoint-specific response schemas and parameter constraints incomplete. Validate server and scraper behavior before designing field explanations or generic execution.
3. Existing page lacks theme, visible input labels, cancellation and authenticated request editor. TikTok and other inputs prefilled. Health request runs on mount. New request execution must be explicit only.
4. Existing header hardcodes online/location and infrastructure claims; replace with factual copy. Catalog is a manually maintained subset, repeated cards and provider badges; it can drift from registry.
5. Root brand not integrated. Original inspected: square black/silver KG emblem with underwear. 1280px PNG approximately 1.36MB; optimized unaltered-identity WebP derivative belongs in an explicitly served asset path upon integration. Original untouched.
6. Sensitive defaults exist in src/core/db.js (connection fallback). Values deliberately omitted here; future security remediation should remove/rotate them under a separately reviewed change. Do not copy source defaults into examples or screenshots.

## Baseline method

Serve only public/ on loopback port 43871 using Python static server; do not launch backend or read .env. The page's existing automatic /health request will receive a static-server 404; this documents frontend appearance and failure state, not runtime/backend health. Existing page only has dark theme, so system light/dark screenshots should show the same palette. Do not invoke existing request buttons. Browser evidence and final results appended after capture.

## Phase 1 acceptance and proposed directions

Local-only prototypes under docs/design-preview/; no product route replacement. Use existing approved logo, no custom assets required. Both include nav, hero, local example, factual catalog selection, docs value and CTA. Links to existing production /docs are deliberate navigation only, not automatically loaded. Catalog links currently lead to general docs; endpoint deep links belong to later explorer work. No account or pricing invention.

A — Artwork-led: split composition, medium-large type, original KG tile in a shaped neutral field, demo followed by two-column catalog index. Strong brand recognition; larger hero artwork competes with headline and costs more vertical space on mobile.

B — Typography-led: oversized two-line headline across the page, compact original mark, open single-column API index before a cobalt demo section. Stronger reading sequence and more deliberate editorial personality; less prominent logo and wider headline require careful small-screen checks.

Recommendation: B, subject to rendered review and operator choice. Shared warm paper/ink/cobalt light theme; neutral charcoal with periwinkle accents in dark. System fonts are an intentional prototype fallback, not final licensed typography. No JS animation library, no live API calls, no secrets, explicit local sample, clipboard on explicit action only. Theme preference is the only localStorage value.

## Verified checkpoint

- Baseline: four viewport captures (1440/390 × system light/dark), static original page; same dark palette under both system preferences. Original page displays “Online” on health fetch failure, so the screenshot does not prove health. External Google fonts were blocked for deterministic offline capture.
- Preview screenshots: artwork/typography × 1440/390 × light/dark, plus desktop hero crops; see evidence/. Rendered images reviewed for desktop composition and mobile readability. Refined typography demo button contrast/silhouette after visual review, then reran browser checks.
- Browser fallback: Playwright MCP failed initially because Chrome was absent, then because root sandboxing was unsupported. Installed Chrome using `npx -y playwright install chrome` (environment-only change; no package/lock changes). Used cached Playwright with local Chrome 157.0.8103.78 and --no-sandbox against loopback static fixtures. Browser plugin/skill not available. No production browser traffic or credentials.
- Final browser run: 20 layout checks passed (320,390,768,1280,1440 × two themes × two directions), no horizontal overflow or missing images; title/content visible; no framework overlay on reviewed screenshots; zero captured preview console/page errors. Verified system preference changes, explicit theme persistence/reload, skip link and tab traversal, reduced-motion native scroll behavior, explicit local sample without network calls, clipboard success/failure with stubs. Typography touch tap passed in Chromium mobile emulation. Baseline expected /health 404 is separate from preview console health.
- Initial browser assertion raced the system color change event; corrected the one-off harness to wait for the DOM theme update. A later rerun needed static harness servers restarted. Final run passed. No app bug inferred from either harness failure.
- `node --test tests/registry.test.js`: 5 passed, 0 failed. `node --check server.js`, `node --check docs/design-preview/preview.js`, `git diff --check`: passed. Existing backend and public/index.html unchanged.
- No lint/typecheck/build scripts exist. Full integration suite deferred until isolated infrastructure and upstream stubs are verified. Actual authenticated execution, account onboarding, billing, Firefox/Safari, real devices, zoom/contrast audit and production LCP/INP/CLS remain unvalidated. These are design prototypes, not release-ready pages.
- Asset sizes: approved logo derivative 13,550 bytes; shared preview CSS 6,751 bytes; JS 1,624 bytes (raw; no production bundle measurements). No claims of production performance.
- Reproduction: baseline `python3 -m http.server 43871 --bind 127.0.0.1 --directory public`; previews `python3 -m http.server 43872 --bind 127.0.0.1 --directory docs/design-preview`. One-off QA script: `/tmp/kg-preview-qa.cjs`, requires both static servers and the cached Playwright path embedded there. Results: evidence/qa-results.json. Servers may need restarting on resume.
- Next action: operator selects A artwork or B typography (recommended). Then implement Phase 2 foundations and later integrate approved direction in Phase 3. Phase 1 approval remains pending; no broad redesign performed.
