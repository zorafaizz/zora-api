# Character production and asset briefs

Both concepts are original built-in imagegen explorations, not approved production assets. Original icon.png remains unchanged and is only a navigation/favicon mark. Generated PNG masters retained alongside optimized WebP derivatives; author/style/rig acceptance remains pending operator review. Exact prompts are in prompts.json; asset status in manifest.json.

## Nami — After School Internet

Adult creative programmer, 22; midnight violet blunt bob and curved forelock, amber eyes, warm tan skin, oversized ivory jacket with persimmon lining, plum clothing, orange sneakers, laptop. Mischievous warm grin; casual grounded pose. Current art: original transparent full-character concept. Current rig: temporary head/body clipped segmentation from one image. It demonstrates head orientation and breathing but has no independent eyes, hair physics, mesh deformation or expression production layers. Do not represent this as Live2D. Raster art remains unchanged; layered animation uses CSS clips.

Required for production: original layered PSD/PSB, long edge ≥3000px, transparent, RGB, all hidden regions painted; separate left/right eyes (whites/iris/pupils/highlights/lids), brows, mouth shapes, front/side/back hair groups, face/ears/neck, torso, each jacket sleeve/hand, laptop, clothing panels and soles. Separate daylight and night-light paint layers; no baked rim glow. Provide turnaround, expression sheet and neutral poster at desktop 1600×1000 and mobile 800×1100 framing. Rights: explicit commercial web use, editing/rigging and derivatives, no franchise content.

If choosing Live2D, supply reviewed .moc3 + .model3.json + textures + .physics3.json + expression and motion exports with consistent paths. Inputs: angleX ±15, angleY ±10, angleZ ±5, bodyX ±5, independent eye open/gaze, mouth/smile, brow and clothing physics. Idle, focus, loading, success, invalid, unauthorized, rate-limit, cancel, server-error, retry, theme. Aim for compact textures with 1× fallback; actual asset/network budget measured before acceptance.

## Momo — Pocket Mischief

Original folded-ear plum familiar, cream face, amber eyes, mint scarf and coral soles. Generated concept is detailed finish reference; inline SVG is an original simplified procedural animation study, not traced/generated raster replacement. Runtime supports independent pupils, eyelids, head, ears, mouth, scarf and arm group. Final linework and silhouette need operator/art review; current character has no exported Rive file.

Required for production: clean SVG or layered illustration with separate ears/head/tuft/face/eyes/pupils/lids/brows/mouth/arm/torso/feet/scarf groups; viewBox/pivots documented, no embedded raster fonts. Expression sheet and day/night materials. Preserve folded-corner ear silhouette, asymmetry and restrained palette. Optional Rive .riv only if authored professionally and demonstrated smaller/faster than procedural SVG; include documented state mapping, reduced-motion pose and licensed runtime terms review.

## Optional cinematic asset

Current openings use existing GSAP and static cutout posters; no missing video blocks prototypes. If a fully illustrated opening is commissioned: original 2.6s silent animation, desktop 16:9 1920×1080 and separately framed mobile 9:16 1080×1920; shot 1 (0–.45s) iris into character close-up, shot 2 (.45–1.3s) gaze/hand anticipation, shot 3 (1.0–2.1s) title compression and character gesture, shot 4 (2.1–2.6s) reveal same hero pose. No flashing/impact strobe, no licensed anime footage. Deliver WebM + MP4 and AVIF/WebP posters, clean alpha layers where appropriate, source project and usage rights. File-size/runtime budget agreed after chosen world, no purchase authorized.

## Research and stack decision

[Live2D model loading](https://docs.live2d.com/en/cubism-sdk-manual/model-web/) and [export requirements](https://docs.live2d.com/en/cubism-editor-manual/export-moc3-motion3-files/) confirm model/texture exports are required. [Rive character workflows](https://rive.app/use-cases/character-animation) support skeletal and state-driven character animation. These are technique references, no sample assets downloaded or redistributed. [GSAP matchMedia](https://gsap.com/docs/v3/GSAP/gsap.matchMedia()/) informed interruption/reduced-motion design through Context7. Current smallest stack is CSS/SVG + GSAP for finite opening/reaction timelines. No Live2D, Rive, Spine, WebGL or video runtime installed. GSAP is copied from the existing dependency for the isolated preview; original license notice retained in distribution header, see package https://gsap.com/standard-license/ before shipping.
