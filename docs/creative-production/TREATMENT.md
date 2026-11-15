# Pocket Mischief — a pocket opens into a world

Production treatment by GPT-6 Astra, 2026-11-15. Approved B remains the foundation. This is an independently developed treatment and working motion study, not final art approval. The runtime identifies Astra; reasoning-effort setting is not exposed and is not claimed.

## Dramatic idea

A developer's “what if?” is the opening into a larger world. Momo hears the idea first, looks toward it, then pulls the scarf through the composition. The scarf supplies one continuous visual gesture: a folded portal in the hero, a wipe in the optional opening, a directional cue when entering the tool. No unrelated particles, stickers or decorative telemetry.

Momo is an observant little accomplice, not a manic mascot. Idle is comfortable; curiosity starts in the eyes; a successful request releases a held breath. Errors get a small thoughtful tilt, never shame or an elaborate sad routine. Its asymmetrical folded ears and scarf remain recognizable in silhouette. The current authored SVG is an acting proxy; final linework needs the production asset brief below.

## Composition and typography

The study places “What if?” across the scene behind Momo, with a scarf-shaped portal framing the character. “Make it happen.” sits in the foreground, and a concise REST API description and tactile action anchor the scene. Mobile uses a taller portal and a smaller, intact title; it is composed separately rather than cropped from desktop. Functional controls sit outside character hit areas.

Title performance: restrained skew at rest, compression before the opening, separated word recovery as Momo lands. No animated paragraphs, code or status text. The study uses system fonts; production lettering should be an original drawn wordmark-like title with accessible HTML equivalent, or an explicitly licensed display face. No external font requests.

## Worlds

Day: lilac paper (#eee7f6), plum ink (#32233f), violet portal, mint scarf and pale peach face. Night: grape-black (#1c1428), lavender-white text, desaturated violet portal, mint interaction accent. Character lighting needs separate painted materials, not inversion. Theme preference uses the existing system/day/night architecture. Production environmental transitions can change lighting over180ms; text/surface contrast changes atomically.

## Motion score

| Moment | Acting and timing | Interruption/fallback |
|---|---|---|
| Pointer | Pupils lead, head follows, ears lag; bounded head±5deg, eyes±5px, scarf±4deg. Exponential damping with slower secondary layers. RAF stops when settled. | Fine pointer only; neutral on leave/hidden/offscreen; touch greeting. |
| Greeting | Ear anticipation90ms, head arc280ms, arm lifts350ms, scarf follows120ms later, recovery700ms. | New action cancels old; reduced motion uses expression only. |
| Opening | 0–350ms portal folds inward;350–900ms character close-up;900–1650ms scarf sweeps and words compress/recover;1650–2800ms camera settles into exact resting hero. | Explicit Play; Skip/Escape; no navigation/auth gate; no autoplay sound; reduced motion static. |
| Scroll handoff | Once tool enters viewport, attention moves downward and portal changes framing;520ms handoff, no scrubbed pinning. | Native scroll; reverses on return; disabled for reduced motion. |
| Preparation | Eyes focus, brows lift slightly. | Remains quiet while typing. |
| Loading | Mouth closes, ears draw in; one anticipation then still attention. | No indefinite whole-body bounce. |
| Success | Arm release, smiling mouth, ear recovery over650ms. | Never delay response display. |
| Invalid/auth/rate/server | Distinct thoughtful brow/head/ear poses, always paired with explicit status/recovery. | No fabricated success. |
| Cancel/retry/theme | Neutral return / small anticipation / attentive blink. | Most recent state wins. |

CSS owns resting materials and limited blink; native Web Animations owns finite named layers in this isolated study. Damped pointer owns only gaze wrapper/pupil variables. No new libraries. Existing GSAP remains appropriate for a later multi-scene timeline; no Live2D/Rive/Three adoption without delivered assets and measured benefit.

## Bounded implementation

index.html, study.css, study.js demonstrate composition, themes, pointer damping, optional2.8s opening, scroll handoff and labeled request-state simulation. No backend or production page is replaced. Buttons explicitly simulate outcomes; no API calls, credentials or fake latency. A link opens the existing manual playground. This separation allows art review without risking accepted authentication.

## Production asset request

Required before final character integration: one original Momo illustration/rig package matching approved B, with confident variable line weight, two-tone cel shading and expressive asymmetry. Do not add cyberpunk equipment or generic anime accessories.

Deliver:
- 3000px transparent layered PSD/PSB or clean named SVG; front and three-quarter neutral poses, turnaround/silhouette sheet, three gesture poses (listen, pull scarf, release/celebrate).
- Separate head, face, tuft, left/right ear base and folded tip, eye white/iris/pupil/highlight/upper/lower lid, brows, mouth shapes, torso, each arm/hand, feet, scarf collar, knot, near/far tail. Paint hidden regions. Document local pivots and clipping masks.
- Expressions: neutral, curious, concentrating, pleased, uncertain, authentication refusal, patient/rate-limit, cancelled, server failure, retry. Face must remain legible at96px without tiny detail. Eyes track within painted sclera; never expose unpainted gaps.
- Day/night material layers and cel-shadow masks; no baked glow. Neutral desktop1600×1000 and portrait800×1100 posters, transparent character exports at480/960px. Commercial web use, editing/rigging/derivative rights and source ownership documented.
- Scarf/portal environment: separate near/far painted ribbon layers, fold seams and neutral hero background; desktop16:9 and mobile4:5 framing. No text baked into artwork.

Optional only if procedural rig fails final acting requirements: authored Rive state-machine .riv with input/state map and reduced-motion pose, or complete Live2D model/texture/physics/expression/motion exports plus source. An SDK installation does not satisfy the requirement.

Optional cinematic film: silent2.8s, separately composed1920×1080 and1080×1920. Shot1 close-up ear hears idea(0–.35); shot2 eye turns/head follows(.35–.9); shot3 hand pulls scarf across frame(.9–1.65); shot4 settle into hero pose(1.65–2.8). Deliver source, WebM/MP4, WebP/AVIF poster and clean layers. No strobe, copyrighted footage or text baked over essential UI. Video is not required for the current working study.

Asset acceptance includes source/creator/license, stable layer names, no edge gaps under full motion range, actual byte/decode/frame measurements, static fallback and explicit final art approval. Existing generated concept is reference only. Do not call the proxy final because it renders.

## Integration sequence

1. Review study visually and deliver/approve final character assets; refine acting against actual rig.
2. Integrate hero/intro and shared character state adapter while keeping request/auth state machines intact.
3. Carry materials and tactile states to explorer/sign-in with smaller, calmer character framing.
4. Run existing frontend/browser and isolated auth regressions, measure desktop/mobile startup and animation costs; capture both themes/reduced motion and interruption evidence.

Production mail, infrastructure, migrations and deployment remain deferred. No spending or asset commission is authorized by this brief.
