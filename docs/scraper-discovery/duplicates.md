# KanjutGede API — Multi-Level Deduplication Report (Levels A–D)

**Generated:** 2026-11-14  
**Scope:** 529 external candidates + 20 active production modules + 32 `library/raw/` modules  
**Algorithm:** Linear $O(N)$ comment/whitespace normalizer, SHA-256 token fingerprinting, structural signature clustering, and upstream failure-domain extraction.

## 1. Deduplication Summary

| Classification | Count | Meaning & Architectural Action |
| :--- | ---: | :--- |
| `EXACT_DUPLICATE` | 12 | Byte-identical or normalized comment-stripped SHA-256 match. Redundant copies rejected. |
| `STRUCTURAL_CLONE` | 39 | Repackaged/renamed wrapper hitting identical upstream endpoint + HTTP method + DOM/JSON path across sites. Consolidated to 1 canonical entry per cluster. |
| `SAME_UPSTREAM` | 47 | Different code implementation calling an upstream domain already present in KanjutGede API (`tikwm.com`, `kusonime.com`, `temp-mail.io`, `savetube`, etc.). Does NOT add failure-domain diversity. |
| `PARTIALLY_INDEPENDENT` | 26 | Shares partial metadata helper (e.g. oEmbed) while using a distinct media CDN or secondary API. |
| `INDEPENDENT_PROVIDER` | 99 | Solves an existing KanjutGede API capability via a genuinely independent upstream failure domain. Prime candidates for Multi-Engine failover tiers. |
| `UNIQUE_CAPABILITY` | 296 | Capability not previously exposed on KanjutGede API. Evaluated for clean-room endpoint expansion. |
| `UNVERIFIED_METHOD` | 10 | Password-locked entries (5) or non-scraper helper snippets without external HTTP targets (5). |
| **Total** | **529** | **36 Cross-Source Duplicate Clusters Identified** |

## 2. Cross-Source Duplicate Clusters (`EXACT_DUPLICATE` & `STRUCTURAL_CLONE`)

| Cluster ID | Canonical ID | Member Count | Member Candidate IDs & Sources | Target / Upstream |
| :--- | :--- | ---: | :--- | :--- |
| `DUP-GRP-001` | `CAND-0020-PBIZZ` | 2 | `CAND-0020-PBIZZ` (pastebin.com/u/IzzXdVibe), `CAND-0066-CKIZZ` (codeku.izzxd.my.id) | `id.akinator.com` |
| `DUP-GRP-002` | `CAND-0025-PBIZZ` | 2 | `CAND-0025-PBIZZ` (pastebin.com/u/IzzXdVibe), `CAND-0029-PBIZZ` (pastebin.com/u/IzzXdVibe) | `image-video` |
| `DUP-GRP-003` | `CAND-0058-CKIZZ` | 5 | `CAND-0058-CKIZZ` (codeku.izzxd.my.id), `CAND-0061-CKIZZ` (codeku.izzxd.my.id), `CAND-0064-CKIZZ` (codeku.izzxd.my.id), `CAND-0076-CKIZZ` (codeku.izzxd.my.id), `CAND-0082-CKIZZ` (codeku.izzxd.my.id) | `emailqu.com, inboxkitten.com, tmailcloud.my.id` |
| `DUP-GRP-004` | `CAND-0063-CKIZZ` | 4 | `CAND-0063-CKIZZ` (codeku.izzxd.my.id), `CAND-0071-CKIZZ` (codeku.izzxd.my.id), `CAND-0072-CKIZZ` (codeku.izzxd.my.id), `CAND-0074-CKIZZ` (codeku.izzxd.my.id) | `api.ikyyxd.my.id, api.proxyscrape.com, reactch20jiyyad.vercel.app` |
| `DUP-GRP-005` | `CAND-0080-CKIZZ` | 2 | `CAND-0080-CKIZZ` (codeku.izzxd.my.id), `CAND-0469-CDXKU` (codexku.vercel.app) | `api.allorigins.win, api.codetabs.com, api.qrserver.com` |
| `DUP-GRP-006` | `CAND-0085-CKIZZ` | 2 | `CAND-0085-CKIZZ` (codeku.izzxd.my.id), `CAND-0086-CKIZZ` (codeku.izzxd.my.id) | `adlinksumo.com` |
| `DUP-GRP-007` | `CAND-0091-CKIZZ` | 2 | `CAND-0091-CKIZZ` (codeku.izzxd.my.id), `CAND-0098-CKIZZ` (codeku.izzxd.my.id) | `api.freeconvert.com, www.freeconvert.com` |
| `DUP-GRP-008` | `CAND-0112-CKIZZ` | 3 | `CAND-0112-CKIZZ` (codeku.izzxd.my.id), `CAND-0113-CKIZZ` (codeku.izzxd.my.id), `CAND-0119-CKIZZ` (codeku.izzxd.my.id) | `www.reelshort.com` |
| `DUP-GRP-009` | `CAND-0126-CKIZZ` | 2 | `CAND-0126-CKIZZ` (codeku.izzxd.my.id), `CAND-0127-CKIZZ` (codeku.izzxd.my.id) | `satriam.satriadeveloperz.workers.dev` |
| `DUP-GRP-010` | `CAND-0130-CKIZZ` | 2 | `CAND-0130-CKIZZ` (codeku.izzxd.my.id), `CAND-0133-CKIZZ` (codeku.izzxd.my.id) | `oppadrama.io` |
| `DUP-GRP-011` | `CAND-0134-CKIZZ` | 2 | `CAND-0134-CKIZZ` (codeku.izzxd.my.id), `CAND-0138-CKIZZ` (codeku.izzxd.my.id) | `anisail.com, v1.animesail.xyz` |
| `DUP-GRP-012` | `CAND-0141-CKIZZ` | 2 | `CAND-0141-CKIZZ` (codeku.izzxd.my.id), `CAND-0142-CKIZZ` (codeku.izzxd.my.id) | `api.giphy.com, giphy.com` |
| `DUP-GRP-013` | `CAND-0143-CKIZZ` | 3 | `CAND-0143-CKIZZ` (codeku.izzxd.my.id), `CAND-0144-CKIZZ` (codeku.izzxd.my.id), `CAND-0145-CKIZZ` (codeku.izzxd.my.id) | `mediadownn.vercel.app` |
| `DUP-GRP-014` | `CAND-0167-GHERZ` | 2 | `CAND-0167-GHERZ` (gist.github.com/herzonly), `CAND-0168-GHERZ` (gist.github.com/herzonly) | `api.dashx.dpdns.org` |
| `DUP-GRP-015` | `CAND-0186-GHERZ` | 2 | `CAND-0186-GHERZ` (gist.github.com/herzonly), `CAND-0187-GHERZ` (gist.github.com/herzonly) | `ytdown.to` |
| `DUP-GRP-016` | `CAND-0194-GHERZ` | 2 | `CAND-0194-GHERZ` (gist.github.com/herzonly), `CAND-0195-GHERZ` (gist.github.com/herzonly) | `www.google.com` |
| `DUP-GRP-017` | `CAND-0216-CKTHV` | 2 | `CAND-0216-CKTHV` (codeku.theresav.eu), `CAND-0217-CKTHV` (codeku.theresav.eu) | `arashi.kadokun.com, www.pornhub.com` |
| `DUP-GRP-018` | `CAND-0234-CKTHV` | 2 | `CAND-0234-CKTHV` (codeku.theresav.eu), `CAND-0235-CKTHV` (codeku.theresav.eu) | `www.google.com` |
| `DUP-GRP-019` | `CAND-0241-CKTHV` | 2 | `CAND-0241-CKTHV` (codeku.theresav.eu), `CAND-0436-JHXFC` (code.jhx.my.id) | `www.tikwm.com, www.tikwm.com$` |
| `DUP-GRP-020` | `CAND-0247-CKTHV` | 2 | `CAND-0247-CKTHV` (codeku.theresav.eu), `CAND-0248-CKTHV` (codeku.theresav.eu) | `general-web` |
| `DUP-GRP-021` | `CAND-0265-CKTHV` | 2 | `CAND-0265-CKTHV` (codeku.theresav.eu), `CAND-0266-CKTHV` (codeku.theresav.eu) | `manwhaku.my.id` |
| `DUP-GRP-022` | `CAND-0270-CKTHV` | 4 | `CAND-0270-CKTHV` (codeku.theresav.eu), `CAND-0274-CKTHV` (codeku.theresav.eu), `CAND-0299-CKTHV` (codeku.theresav.eu), `CAND-0367-HAIDR` (snippet.haidarxd.my.id) | `myanimelist.net` |
| `DUP-GRP-023` | `CAND-0276-CKTHV` | 3 | `CAND-0276-CKTHV` (codeku.theresav.eu), `CAND-0278-CKTHV` (codeku.theresav.eu), `CAND-0279-CKTHV` (codeku.theresav.eu) | `x.com` |
| `DUP-GRP-024` | `CAND-0282-CKTHV` | 2 | `CAND-0282-CKTHV` (codeku.theresav.eu), `CAND-0283-CKTHV` (codeku.theresav.eu) | `putzoffc.vercel.app` |
| `DUP-GRP-025` | `CAND-0294-CKTHV` | 2 | `CAND-0294-CKTHV` (codeku.theresav.eu), `CAND-0295-CKTHV` (codeku.theresav.eu) | `igexport.com` |
| `DUP-GRP-026` | `CAND-0303-CKTHV` | 2 | `CAND-0303-CKTHV` (codeku.theresav.eu), `CAND-0304-CKTHV` (codeku.theresav.eu) | `cdn.zass.in, picsum.photos, www.photiu.ai` |
| `DUP-GRP-027` | `CAND-0320-CKTHV` | 2 | `CAND-0320-CKTHV` (codeku.theresav.eu), `CAND-0337-CKTHV` (codeku.theresav.eu) | `general-web` |
| `DUP-GRP-028` | `CAND-0402-PBOMN` | 2 | `CAND-0402-PBOMN` (pastebin.com/u/OmnifyLabs), `CAND-0403-PBOMN` (pastebin.com/u/OmnifyLabs) | `bauval.org, www.googletagmanager.com` |
| `DUP-GRP-029` | `CAND-0404-PBOMN` | 2 | `CAND-0404-PBOMN` (pastebin.com/u/OmnifyLabs), `CAND-0410-PBOMN` (pastebin.com/u/OmnifyLabs) | `en.ephoto360.com` |
| `DUP-GRP-030` | `CAND-0408-PBOMN` | 2 | `CAND-0408-PBOMN` (pastebin.com/u/OmnifyLabs), `CAND-0413-PBZYN` (pastebin.com/ZyNLyKna) | `1.1.1.1` |
| `DUP-GRP-031` | `CAND-0417-JHXFC` | 5 | `CAND-0417-JHXFC` (code.jhx.my.id), `CAND-0419-JHXFC` (code.jhx.my.id), `CAND-0456-JHXFC` (code.jhx.my.id), `CAND-0459-JHXFC` (code.jhx.my.id), `CAND-0464-JHXFC` (code.jhx.my.id) | `i.ytimg.com, m.youtube.com, ytdownloader.tech` |
| `DUP-GRP-032` | `CAND-0425-JHXFC` | 4 | `CAND-0425-JHXFC` (code.jhx.my.id), `CAND-0431-JHXFC` (code.jhx.my.id), `CAND-0435-JHXFC` (code.jhx.my.id), `CAND-0437-JHXFC` (code.jhx.my.id) | `www.lirikonline.com` |
| `DUP-GRP-033` | `CAND-0427-JHXFC` | 2 | `CAND-0427-JHXFC` (code.jhx.my.id), `CAND-0428-JHXFC` (code.jhx.my.id) | `api-wh.sssinstagram.com, cap.jhx.my.id, sssinstagram.com` |
| `DUP-GRP-034` | `CAND-0446-JHXFC` | 2 | `CAND-0446-JHXFC` (code.jhx.my.id), `CAND-0448-JHXFC` (code.jhx.my.id) | `api.pikwy.com, music.jhx.my.id, pikwy.com` |
| `DUP-GRP-035` | `CAND-0485-ZANE` | 2 | `CAND-0485-ZANE` (github.com/zanegiluyy-maker/Scraper-By-Zane), `CAND-0507-ZANE` (github.com/zanegiluyy-maker/Scraper-By-Zane) | `adamnurs.my.id` |
| `DUP-GRP-036` | `CAND-0488-ZANE` | 2 | `CAND-0488-ZANE` (github.com/zanegiluyy-maker/Scraper-By-Zane), `CAND-0509-ZANE` (github.com/zanegiluyy-maker/Scraper-By-Zane) | `alight-creative.firebaseapp.com, ampremium.eu.cc` |

## 3. `SAME_UPSTREAM` Overlaps Against Existing Engine

| Candidate ID | Source Site | Title | Overlapping Upstream / Existing Module |
| :--- | :--- | :--- | :--- |
| `CAND-0095-CKIZZ` | `codeku.izzxd.my.id` | TikTok Search & Downloader | `www.tikwm.com` |
| `CAND-0097-CKIZZ` | `codeku.izzxd.my.id` | Fake KTP Generator | `fake-ktp.netlify.app, litterbox.catbox.moe, tmpfiles.org` |
| `CAND-0167-GHERZ` | `gist.github.com/herzonly` | sora2.js | `api.dashx.dpdns.org` |
| `CAND-0192-GHERZ` | `gist.github.com/herzonly` | plug-hackai.js | `api.dashx.dpdns.org` |
| `CAND-0198-GHERZ` | `gist.github.com/herzonly` | google-ai-mode.js | `www.google.com` |
| `CAND-0212-GHERZ` | `gist.github.com/herzonly` | upgist.js | `api.github.com` |
| `CAND-0214-CKTHV` | `codeku.theresav.eu` | SaveTheVideo Scraper & Task API | `api.v02.savethevideo.com, www.savethevideo.com` |
| `CAND-0222-CKTHV` | `codeku.theresav.eu` | Emailnator Temp-Mail API (emailnator.js) | `www.emailnator.com` |
| `CAND-0234-CKTHV` | `codeku.theresav.eu` | google-image | `www.google.com` |
| `CAND-0252-CKTHV` | `codeku.theresav.eu` | ytdl from azk.com.pl | `api.azk.com.pl, azk.com.pl` |
| `CAND-0256-CKTHV` | `codeku.theresav.eu` | Temp Mail.io | `api.internal.temp-mail.io` |
| `CAND-0258-CKTHV` | `codeku.theresav.eu` | am bulk | `generator.email, satriam.satriadeveloperz.workers.dev` |
| `CAND-0265-CKTHV` | `codeku.theresav.eu` | Manhwa | `manwhaku.my.id` |
| `CAND-0291-CKTHV` | `codeku.theresav.eu` | tempmail - tempmail.plus | `tempmail.plus` |
| `CAND-0309-CKTHV` | `codeku.theresav.eu` | tiktok downloader scrape | `www.tiktok.com` |
| `CAND-0319-CKTHV` | `codeku.theresav.eu` | PINTEREST SEARCH + DL | `www.pinterest.com` |
| `CAND-0331-CKTHV` | `codeku.theresav.eu` | Play music spotify | `spotidown.app` |
| `CAND-0343-CKTHV` | `codeku.theresav.eu` | sfile.co | `sfile.co` |
| `CAND-0348-HAIDR` | `snippet.haidarxd.my.id` | BMKG | `data.bmkg.go.id` |
| `CAND-0354-HAIDR` | `snippet.haidarxd.my.id` | Generator Email .com | `generator.email` |
| `CAND-0374-HAIDR` | `snippet.haidarxd.my.id` | Spotidown Scraper | `spotidown.app` |
| `CAND-0375-HAIDR` | `snippet.haidarxd.my.id` | Soundcloud Scraper | `api-v2.soundcloud.com` |
| `CAND-0380-HAIDR` | `snippet.haidarxd.my.id` | OneForAll Downloader | `oneforalldownloader.com` |
| `CAND-0382-HAIDR` | `snippet.haidarxd.my.id` | Chat Ai "DeepAI" | `api.deepai.org, deepai.org` |
| `CAND-0397-PBOMN` | `pastebin.com/u/OmnifyLabs` | Instagram Universal All-in-One | `www.google.com` |
| `CAND-0406-PBOMN` | `pastebin.com/u/OmnifyLabs` | Mediafire Direct Link Downloader | `www.mediafire.com` |
| `CAND-0418-JHXFC` | `code.jhx.my.id` | lualstring.js | `web-feature-garden.lovable.app` |
| `CAND-0421-JHXFC` | `code.jhx.my.id` | omdown.js | `www.omdown.site` |
| `CAND-0422-JHXFC` | `code.jhx.my.id` | bicolink.js | `bicolink.com` |
| `CAND-0425-JHXFC` | `code.jhx.my.id` | lirikonline.js | `www.lirikonline.com` |
| `CAND-0434-JHXFC` | `code.jhx.my.id` | mangadex.js | `api.mangadex.org, mangadex.org, uploads.mangadex.org` |
| `CAND-0449-JHXFC` | `code.jhx.my.id` | moviezone.js | `moviezone.web.id` |
| `CAND-0454-JHXFC` | `code.jhx.my.id` | pindl.js | `www.pinterest.com` |
| `CAND-0455-JHXFC` | `code.jhx.my.id` | pinsearch.js | `www.pinterest.com` |
| `CAND-0467-JHXFC` | `code.jhx.my.id` | tiktokdl.js | `www.tiktok.com` |
| `CAND-0468-JHXFC` | `code.jhx.my.id` | tiktoksearch.js | `www.tiktok.com` |
| `CAND-0492-ZANE` | `github.com/zanegiluyy-maker/Scraper-By-Zane` | capcutdl | `www.capcut.com` |
| `CAND-0495-ZANE` | `github.com/zanegiluyy-maker/Scraper-By-Zane` | facebookScraper | `www.facebook.com` |
| `CAND-0497-ZANE` | `github.com/zanegiluyy-maker/Scraper-By-Zane` | ffStalkScraper | `freefire.my.id` |
| `CAND-0498-ZANE` | `github.com/zanegiluyy-maker/Scraper-By-Zane` | generatorgmail | `generator.email` |
| `CAND-0499-ZANE` | `github.com/zanegiluyy-maker/Scraper-By-Zane` | igexportScraper | `igexport.com` |
| `CAND-0501-ZANE` | `github.com/zanegiluyy-maker/Scraper-By-Zane` | iloveimgRmBg | `www.iloveimg.com` |
| `CAND-0502-ZANE` | `github.com/zanegiluyy-maker/Scraper-By-Zane` | iloveimgUpscale | `www.iloveimg.com` |
| `CAND-0503-ZANE` | `github.com/zanegiluyy-maker/Scraper-By-Zane` | instaloadrScraper | `www.instaloadr.com` |
| `CAND-0508-ZANE` | `github.com/zanegiluyy-maker/Scraper-By-Zane` | omdown | `www.omdown.site` |
| `CAND-0511-ZANE` | `github.com/zanegiluyy-maker/Scraper-By-Zane` | pinterest | `www.pinterest.com` |
| `CAND-0519-ZANE` | `github.com/zanegiluyy-maker/Scraper-By-Zane` | tempmail | `www.emailnator.com` |
