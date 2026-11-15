# KanjutGede — Anime Internet Universe

## Direction and history

The operator rejected the cream/cobalt editorial artwork and typography prototypes on 2026-11-15. They remain in docs/design-preview/ for history only; original specification is docs/history/DESIGN-editorial-rejected.md. Do not polish or productionize them. Current authority: MASTER.md and the operator's anime reset.

Create a youthful original anime universe with useful REST APIs immediately clear. Character, typography, action and environment share one composition. Approved icon.png remains a small identity mark. No enlargement as hero art. No random Japanese text, stickers, stars, badges, HUD, fake telemetry, repetitive cards or generic split hero.

## Two exploration worlds

A — After School Internet: Nami, an adult creative programmer with a violet bob, warm orange-lined jacket and knowing grin. A cinematic sun-disc/studio composition; huge oblique title sits behind the character; horizontal horizon grounds the scene, not a text/image grid. Apricot/lilac daylight and plum/persimmon night. Compressed italic title and small readable body. Optional 2.6-second opening uses aperture fold, character close-up and title recoil, never blocks docs. Pointer controls bounded head orientation independently of body; concept cutout segmentation is explicitly temporary, not a Live2D model.

B — Pocket Mischief: Momo, a folded-ear plum digital familiar with mint scarf. An interactive illustrated pocket world: character occupies the center of a curved open canvas; rounded word forms orbit compositionally, not perpetually. Mint/lavender day and deep grape night. Thick rounded display letters, gentle squash-and-recover button, procedural native SVG head, pupils, ears, arm, scarf and mouth layers. Hand-authored procedural rig is a prototype; generated creature sheet documents intended finish. No runtime video or WebGL required.

Exploration acceptance (B now approved): usable mobile composition explicitly rearranges text, character and actions, two art-directed themes, primary action to local playground, full docs link, actual registry search, clearly labeled fixture requests. B approved by operator; A retained as unselected exploration history.

## Typography, color and controls

A uses compressed heavy italic system display fallback with cut/trapezoid title framing; B uses rounded heavy display fallback with staggered baseline and elastic recovery. Final custom font choice/rights require approval, never assume a font license. Body 16–18px, code 13–15px. Semantic CSS variables per world and theme; no inversion filters on art. One dominant accent and one supporting color. Day/night environments change shape/color and character state. Measure contrast in rendered controls.

Primary controls have asymmetric capsule silhouettes, substantial target size, inset edge, pressed compression, keyboard outline and stable loading width. Functional screens calm and readable; motion never changes code while reading. Controls include disabled/loading/cancel/success/error and clipboard recovery. Theme has system initial choice, explicit persistence, OS change handling and no initial flash. Only theme preference stored. Motion toggle independent of reduced-motion and usable by keyboard.

## Motion specification

- Feedback: 90ms anticipation, 220ms action, 350–550ms damped recovery; no overshoot on code/response text.
- A opening: 0–450ms scene aperture fold, 450–1300ms character framing, 1000–2100ms title compression/recovery, complete at 2600ms. Explicit Play opening only; persistent nav/docs never covered. Skip and Escape end immediately. Static poster is default. Reduced motion skips cinematic movement.
- B greeting: ears anticipate 100ms, head arc 280ms, scarf follows 160ms later, 500ms elastic letter recovery. User tap or opening control triggers sequence. No loop of bounces.
- Idle: breath 4–5s, blink brief every 4–7s; A cutout rig only head/body segmentation until authored layers exist. B independent pupils/lids/ears/scarf. Pointer max head rotation ±5deg, eye translation ±5 SVG units, body ±2deg; damped return on pointerleave. Disabled on coarse touch; touch greeting is equivalent.
- Scroll: threshold scene handoff changes gaze/pose once when playground enters, no scroll hijacking or mechanically scrubbed parallax. Independent environment depth is bounded.
- Product states: focus/preparation -> attention; loading -> concentration; success -> brief smile; invalid/auth/rate/server -> distinct brows/mouth plus explicit live text; cancel -> neutral; retry -> anticipation. One active reaction, new state cancels old; optional reactions.
- CSS owns button/material/idle layers; GSAP owns opening/finite reactions on separate wrappers. Pointer owns head/pupils via CSS custom properties. Reduced-motion disables idle, pointer, choreography and smooth scroll; text/status/theme remain instant. IntersectionObserver and visibilitychange suspend idle offscreen/hidden. Cleanup animations/listeners on page exit.

## 5. API explorer and documentation
Use actual endpoint registry/OpenAPI or existing source of truth. Search/filter by category, method, path and description. Deep-link each endpoint. Desktop: endpoint navigation + request editor + response/code area; responsive stacking or tabs on mobile. Preserve selection and non-secret draft values as appropriate. Documentation readable without authentication where existing policy allows; execution requires actual authorization.

### Endpoint flow (TikTok downloader as example, not a contract)
1. Show actual method/path, description, auth scheme, parameters, required flags, constraints, quota/cost if available, and documented errors.
2. API key control defaults to the user's selected/default authorized key when available. Display masked identity and allow selecting another key or manual override. If the actual secret is securely available to the client, populate a password-type input without leaking it. If reveal-once/hashed, do not reconstruct it: use selected-key authenticated server execution if supported, or clearly prompt for manual key. Never fetch all plaintext keys. Logged-out users see sign-in/manual entry according to existing policy. Clear secrets on logout/account change; no localStorage, URL, analytics or error logging of secrets. Explicit reveal only if policy permits. Default generated snippets use environment variable/placeholders, not live keys.
3. URL input starts empty (placeholder may show format, never actual prefilled TikTok URL). Validate against real endpoint rules; do not invent restrictions. Other parameters reflect actual schema. Generate request preview as user edits, without network execution. Encode query params correctly; use actual auth header/query contract. If contract uses query key, avoid displaying/logging actual secret in URLs and flag risk for review.
4. Execute explicitly; show loading, prevent duplicate submissions, support cancellation where feasible, handle timeout/network/auth/validation/rate limit/upstream errors, show status and measured latency only if available. No automatic retries of billable/non-idempotent requests. Never fabricate success.
5. Response: actual JSON, pretty formatting, syntax highlighting, expandable tree, raw view, copy JSON, status, headers sanitized, response size/latency if measured. Distinguish documented example from live response. For large payloads cap rendering/virtualize with raw download only if supported and safe. Render untrusted response as text, never HTML. Do not auto-fetch arbitrary returned media URLs; explicit preview only if safe and supported.
6. Explain real response fields with paths, types, descriptions and examples from verified schema; clickable field paths can highlight JSON. For downloader, only show media URL/title/metadata fields if actual contract provides them. Show how to extract actual fields in code; never assume `data.video` or any other path. Unknown fields labeled as such.
7. Code snippets: cURL, JavaScript fetch, Python requests; optional additional languages based on demand. Use actual method, base URL, parameters, auth and body. Update with user input, safely escape strings and shell args, no injection. Placeholder/env var for key by default. Copy per language; explicit opt-in to include secret only if permitted, with warning. Show request and response examples, errors and field extraction. Do not include `curl | sh` or invented install commands.
8. Request history optional if existing privacy policy permits; redact keys and sensitive payloads, avoid persistent storage by default, provide clear/delete controls. Never expose another user's history.


## Security and backend architecture gate

Initial audit confirmed hash-only reveal-once keys and no session login/default-key execution endpoint. Email OTP sessions have since been implemented behind a disabled flag; no default-key execution endpoint exists. Prototypes do not accept keys or contact providers. Manual-key production execution remains supported by current backend. A secure session-authenticated path must be separately designed/reviewed before any backend change; session principal must traverse the same permission, validation, quota, rate and billing pipeline. No hidden legacy fallback or key reconstruction.

## Assets and release acceptance

Original image generation is concept art, not rig production. See docs/anime-preview/ASSETS.md and manifest.json. Retain provenance, prompts, derivative sizes, approval status. Do not ship reference footage or assume source availability grants rights. Production Live2D requires separated artwork, .moc3, .model3.json, textures, physics, expression/motion exports and usage approval. Rive requires authored .riv with documented state mapping. Static fallback always available.

Target WCAG 2.2 AA; test 320/390/768/1280/1440, keyboard/focus, zoom, errors, reduced motion, touch, both themes and optional intro skip. Record screenshots, animation frames/recordings and real measurements. Performance goals remain LCP ≤2s, INP ≤200ms, CLS ≤0.05 where measurable, not claims. No production completion while full flows or validation missing.

## Operator approval — 2026-11-15

B — Pocket Mischief is approved. Continue shared foundations, landing integration and manual-key explorer autonomously using existing backend contracts. A remains exploration history. Approval covers visual direction, not a session-authentication architecture change, deployment or paid/live QA requests. See docs/implementation/pocket-integration.md.

## Email sign-in architecture — approved and implemented in isolation, 2026-11-15

Operator chose email sign-in design. Recommendation: one email field and one eight-digit code input (paste/autofill supported), a calm Pocket Mischief surface in both themes, no forced intro. Browser-bound codes, secure opaque sessions and explicit status/error recovery. Historical accounts require operator-reviewed enrollment because existing emails lack verification history and current key-management scopes cannot safely prove ownership. Initial signed-in UI retains manual-key execution; masked key selection/admin/session execution wait for their own reviewed integration. See docs/auth/email-sign-in-design.md for the full flow, proposed contracts, lifetimes, security and rollout. The operator approved this architecture for implementation and isolated testing. The sign-in page now uses shared day/night tokens, existing Momo reactions, a single pasteable code field and accessible text feedback; no forced intro. Secure opaque sessions, browser-bound HMAC codes, CSRF, logout/fresh verification and audited operator enrollment are implemented behind disabled flags. Production transport, migrations and deployment remain unapproved. Evidence and release gates: docs/auth/operations.md.

## Astra production treatment — 2026-11-15

Approved B evolves through “A pocket opens into a world”: Momo’s scarf connects hero portal, opening transition and attention handoff. Concrete acting/typography/day-night score and precise asset requirements are in docs/creative-production/TREATMENT.md. The isolated working study uses temporary original procedural art; final illustration/rig approval remains open. Native frontend and accepted authentication preserved. No automatic adoption of neutral enterprise palettes from generic UI skills; operator anime art direction remains authoritative.
