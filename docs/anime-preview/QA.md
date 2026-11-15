# Anime exploration QA — 2026-11-15

## Scope and environment

Two local interactive concepts, not production redesign. Existing Express backend, public/index.html, authentication, billing and quotas unchanged. Previous rejected compositions preserved in docs/design-preview/ and history snapshots. Pre-existing package.json/package-lock changes preserved. MASTER.md was missing; created from current operator protocol. No model switch, infrastructure change, production-data writes, commits or deployments.

Playwright MCP was attempted and failed because root Chromium sandboxing is unsupported. Used existing cached local Playwright with Chrome 157.0.8103.78 --no-sandbox against loopback Python static server, operator-authorized fallback. QA script blocks nonlocal browser network. Fixtures are local only; catalog.json is derived from actual registry/OpenAPI (42 records), no live provider requests. All character assets are original generation/authored prototypes, no anime reference footage redistributed.

## Flow and checks

Entry -> character scene/day-night -> optional opening/skip -> real registry search -> endpoint parameter editor -> explicit local simulation -> accessible status and character reaction -> JSON/snippet/copy.

- 20 layout combinations: widths 320/390/768/1280/1440, both themes, both concepts; no horizontal document overflow and all referenced images loaded.
- Page title/content, reviewed screenshots without framework overlays, zero captured console/page errors.
- System theme changes, explicit preference persistence/reload, pointer head tracking, native anchor scroll, greeting touch taps in mobile emulation.
- Explicit opening completes; Skip and Escape restore focus to Play; intro is opt-in and does not replay on navigation. Reduced motion bypasses opening and suppresses idle/pointer movement.
- Registry search including no-results; selecting TikTok starts URL empty; missing required parameter announced and input marked invalid. External snippets use environment variables with safe URL/string/shell quoting; no key inputs in these prototypes.
- Loading disables duplicate execution; cancellation restores control; 401/429/500 and success excerpt fixtures render. Copy JSON success/failure tested using clipboard stubs. All response fields in fixture explained as common envelope only, no fabricated downloader fields.
- Keyboard skip link targets main. Full WCAG/contrast/zoom, complete tab audit and Firefox/Safari/real-device tests remain unperformed; do not infer those from smoke checks.

## Visual and motion review

Reviewed desktop A/day, B/night, both mobile worlds, opening stages and full-page composition captures. A originally let the lower shoe touch mobile functional headline; reduced/repositioned cutout and reran captures. Both worlds have distinct characters/composition/type/palette; raster A is cinematic key art with a temporary head/body segmentation. B uses a simplified independent-layer SVG puppet based on the original concept, not a production Rive file. A does not yet have real independent blink/gaze/hair layers, a documented asset gap. Emotional quality is for operator review, not a test assertion.

Recordings: evidence/after-hours-interaction.webm and evidence/pocket-interaction.webm show idle/gaze, optional opening, world change and local simulation. Frame captures: *-opening-early.png / *-opening-middle.png. Trace: evidence/browser-trace.zip. Full screenshots and hero crops: scene-width-theme names. These are evidence artifacts, not assets shipped by production routes.

## Measurements and actual limitation

Local headless Chrome, 1440×1000, unthrottled loopback, no CPU/network emulation. Traced QA frames are distorted by screenshot/trace overhead; independent samples are evidence/profile-untraced.json. No production LCP/INP/CLS claim.

Final 2.1-second samples without tracing:

| Scene | Idle frames | Opening frames | Opening frames >33ms | Max opening gap | JS heap idle → opening |
|---|---:|---:|---:|---:|---:|
| A After School Internet | 120 | 88 | 27 | 66.7ms | 1.81 → 2.22MB |
| B Pocket Mischief | 127 | 121 | 5 | 66.7ms | 2.61 → 2.86MB |

Greeting handler synchronous time: A .5ms, B .3ms in this sample; this is not INP or a real-device interaction measurement. Heap snapshots do not prove memory stability/leak freedom. Results vary with shared headless environment.

A still exhibits opening frame spikes. Replaced expensive full-scene circular clip with a transform aperture and removed extra raster camera rotation; earlier sample preserved in profile-before-refinement.json. This reduced the observed slow-frame count in one sample but does not establish causation or consistent 60fps. Keep intro opt-in; further compositor/device profiling and reduced raster complexity needed before production. B has fewer slow frames but still needs device validation. Do not claim flawless/smooth animation.

Asset derivatives: Nami WebP 136,308 bytes, Momo WebP 137,534 bytes, logo 13,550 bytes. Raw world.js ~12KB and CSS ~13KB plus existing GSAP distribution; no installed frontend build/bundler, no production bundle metric. Original PNGs preserved for art handoff, not loaded as runtime hero assets.

## Commands and limits

`PLAYWRIGHT_MODULE=/root/.npm/_npx/31e32ef8478fbf80/node_modules/playwright node docs/anime-preview/verify.cjs` starts/stops server and persists results/screenshots/trace. `node --check docs/anime-preview/world.js`, `node --check docs/anime-preview/verify.cjs`, `git diff --check`, `node --test tests/registry.test.js` passed (registry 5 tests, 0 failures). No lint/typecheck/build scripts exist. Full suite not run because it mutates DB/billing and invokes providers without verified isolation.

A prototype is not a finished rig; precise required production assets and research links are in ASSETS.md. Session execution is architecture only in ../playground-session-proposal.md; requires actual sign-in/default-key decisions and review. Character approval, final fonts/art, real response schemas, authenticated execution, full accessibility, device/cross-browser and production performance remain release work.

Next: operator chooses anime A or B before any production redesign. No model switch justified by this bounded exploration; current lead continues after the choice.

Final screenshot review additionally caught A's mobile greeting controls touching its primary action after wrapping. Increased the mobile scene's lower space and separated the control rows; added explicit primary/control-rectangle overlap assertions at every tested width/theme. The expanded assertion also caught B at 320px; separated its mobile action/control rows and reran the full suite. Successful final results include controlsOverlap:false. Desktop recordings remain representative; final mobile screenshots reflect this fix.
