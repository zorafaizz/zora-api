# Anime Internet Universe — two interactive concepts

These are isolated, non-production explorations. The previous editorial directions are rejected. No API credentials collected; the registry is a static source-derived snapshot and every response is explicitly simulated locally. No production endpoint executes.

```sh
python3 -m http.server 43873 --bind 127.0.0.1 --directory docs/anime-preview
```

- A: http://127.0.0.1:43873/after-hours.html — After School Internet; Nami, original adult programmer, cinematic oblique type, apricot/lilac daylight and plum night. Generated art, temporary clipped head/body rig; no independent eyes or hair physics. Production layered-art brief required.
- B: http://127.0.0.1:43873/pocket.html — Pocket Mischief; Momo, original folded-ear familiar, central illustrated pocket world, mint/grape atmosphere, procedural pupils/blinks/ears/scarf/head/mouth. SVG animation study; generated character sheet in assets/ establishes intended finish.

Try: day/night, greeting, explicit optional opening/Skip/Escape, reactions toggle, pointer tracking (fine pointer), search, endpoint selection, required input, simulation, cancel, 401/429/500/success fixtures, cURL/JS/TS/Python examples and copy JSON. Intro never automatically plays. Native navigation/docs stay accessible. A success fixture is explicitly a common-field excerpt, not a successful TikTok download.

Animation architecture: CSS idle on independent layers, CSS custom properties for bounded damped pointer, GSAP on separate wrappers for finite effects. No Live2D/Rive/Three runtime installed. Reduced-motion keeps static content; idle paused offscreen and when hidden. See DESIGN.md, ASSETS.md, manifest.json and prompts.json. Session architecture is only a proposal in ../playground-session-proposal.md.

QA (requires existing local Chrome and installed Playwright module):

```sh
PLAYWRIGHT_MODULE=/path/to/node_modules/playwright node docs/anime-preview/verify.cjs
```

In this workspace the cached module is `/root/.npm/_npx/31e32ef8478fbf80/node_modules/playwright`. The script starts/stops a loopback static server, blocks nonlocal browser network, records screenshots/trace and writes evidence/qa-results.json. MCP was attempted but failed on root Chromium sandbox; local Playwright fallback is operator-authorized. Original backend is not launched.

Production gaps: final character rig/art approval; font selection/licensing; actual session login/execution design review; endpoint-specific response schemas; real integration tests on isolated infrastructure; full accessibility/contrast/zoom and cross-browser/device/performance QA. No release completion implied.
