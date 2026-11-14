# KanjutGede API — Scraper Discovery, Validation & Multi-Engine Expansion Report

**Date:** 2026-11-14  
**Repository:** `/home/zorafaiz/api-service`  
**Specification:** `integrations1.md` (Sections 1–14 & Execution Rules)

---

## 1. Executive Summary

- **External Sources Audited:** **12** sources inspected (`11` active sources harvested completely across pagination/sitemaps/JSON APIs; `1` source `https://xmz-scraper.my.id/index.php` verified dead/unavailable).
- **Total Candidates Cataloged:** **529** external entries (`524` public raw artifacts staged in `staging/discovery/sources/` + `5` password/auth-locked entries respected without bypass), compared against **20** active production modules and **32** internal `library/raw/` modules.
- **Multi-Level Deduplication (Levels A–D):** Identified **12** `EXACT_DUPLICATE`, **39** `STRUCTURAL_CLONE` across **36** cross-site clusters, **47** `SAME_UPSTREAM`, **26** `PARTIALLY_INDEPENDENT`, **99** `INDEPENDENT_PROVIDER`, **296** `UNIQUE_CAPABILITY`, and **10** `UNVERIFIED_METHOD`.
- **Live Empirical Benchmarking:** Executed **75** bounded live evaluations (`CONCURRENCY = 4`, `TIMEOUT_MS = 8500`) across 3 rounds in `staging/benchmarks/`.
- **Production Multi-Engine Upgrade:** Upgraded `src/core/resilience.js` with EWMA health scoring ($\alpha=0.3$), failure-domain tracking, circuit breakers, retry budgets with jitter, deadline propagation, and bulkhead concurrency isolation.
- **Endpoint Surface Expansion:** Expanded `ENDPOINT_REGISTRY` and `server.js` from **30** to **42** active endpoints (**29** backed by multi-provider failover chains), preserving 100% legacy envelope and `/api/v1/...` compatibility.

---

## 2. Source Discovery Coverage (All 12 Sources)

| # | Source URL | Access Method | Public Staged | Locked (Respected) | Status & Notes |
| ---: | :--- | :--- | ---: | ---: | :--- |
| 1 | `https://pastebin.com/u/IzzXdVibe` | HTML pagination (p.1–2) + `/raw/<id>` | 38 | 0 | Complete |
| 2 | `https://pastebin.com/u/OmnifyLabs` | Public profile + `/raw/<id>` | 27 | 0 | Includes cross-listed `#3 ZyNLyKna` |
| 3 | `https://pastebin.com/ZyNLyKna` | Direct raw fetch | (in #2) | 0 | Cross-listed under OmnifyLabs (`CAND-0041`) |
| 4 | `https://codeku.izzxd.my.id/` | `/sitemap.xml` + `/code/<id>/raw` | 116 | 2 | `dy1w3f`, `fz7ezj` returned HTTP 401 (respected) |
| 5 | `https://xmz-scraper.my.id/index.php` | TLS/HTTP/Wayback probe | 0 | 0 | **Unavailable**: TLS SAN mismatch (`154.12.117.162`), HTTP 404, 0 Wayback captures |
| 6 | `https://gist.github.com/herzonly` | GitHub Gist pagination (p.1–6) | 56 | 0 | Includes explicit MIT-licensed `CAND-0158-GHERZ` |
| 7 | `https://codeku.theresav.eu/` | `/api/snippets` JSON API | 129 | 3 | 3 entries `isLocked: true` respected without bypass |
| 8 | `https://snippet.haidarxd.biz.id/` | Public snippet feed + raw endpoints | 41 | 0 | Complete |
| 9 | `https://code.jhx.my.id/` | Public index + raw endpoints | 55 | 0 | Flagged `CAND-0438-JHXFC` (`rejectUnauthorized: false`) |
| 10 | `https://codexku.vercel.app/` | Public API/listing | 12 | 0 | Complete |
| 11 | `https://donzfolderx.vercel.app/` | 3 ZIP archives (Zip-Slip guarded) | 11 | 0 | Complete |
| 12 | `https://github.com/AhmadAkbarID/Scraper-By-Zane` | Git shallow tree (`46` files) | 46 | 0 | No `LICENSE` file in repo; treated as unlicensed reference only |

---

## 3. Security, Licensing & Clean-Room Governance

1. **Strict Staging Isolation:** All 524 raw external files and 3 benchmark scripts reside exclusively inside `/home/zorafaiz/api-service/staging/` (excluded via `.gitignore`) with zero imports from production code.
2. **Clean-Room Implementation:** Because 474 snippets lacked explicit licenses and `Scraper-By-Zane` had no `LICENSE` file (only 4 candidates carried explicit MIT and 2 ISC), **no unlicensed external code was copied into production**. Every production adapter in `scrapers/` and `src/scrapers/` was written clean-room against documented public protocols using `executeMultiProvider` and `validateSSRF`.
3. **Abuse & Security Filtering:**
   - **17** candidates flagged for policy/abuse violations (OTP bombers such as Flox `CAND-0080-CKIZZ` / `CAND-0469-CDXKU`, fake KTP generators, NSFW/gore scrapers, WormGPT wrappers) were permanently rejected across entire duplicate clusters.
   - **4** candidates with unsafe TLS/eval (`rejectUnauthorized: false` in `CAND-0438-JHXFC`, dynamic `eval`) were quarantined.
   - **7** hardcoded third-party keys detected in external snippets were redacted to `[REDACTED]` during static analysis.

---

## 4. Upgraded Existing Endpoints (Multi-Engine Failover)

- **TikTok (`scrapers/tiktok.js`):** `ttdl_zone` (`215ms` p50) -> `tikwm` (`830ms` p50) -> `lovetik` -> `ytdlp`.
- **Twitter/X (`scrapers/twitter.js`):** `twimg_syndication` (`199ms` p50) -> `fxtwitter` (`431ms` p50) -> `x2twitter` (retained) -> `ytdlp` -> `twitter_oembed`.
- **Spotify (`scrapers/spotify.js`):** `spotify_embed` (`385ms` p50) + iTunes audio preview (`115ms` p50) -> `fabdl` -> `itunes_search` -> `spotify_oembed`.
- **YouTube (`scrapers/youtube.js`):** `savetube` (retained) -> `youtube_initial_player` (`595ms` p50) -> `invidious_nadeko` -> `ytdlp` -> `noembed` (`96ms` p50).
- **Pinterest (`scrapers/pinterest.js`):** `pinterest_html_json` -> `pinterest_oembed` -> `ytdlp`.
- **SoundCloud (`src/scrapers/soundcloud.js`):** `soundcloud_api_v2` dynamic `client_id` resolver (`1485ms` p50) -> `soundcloud_mobi` (retained) -> `soundcloud_oembed` (`362ms` p50).
- **TempMail (`src/scrapers/tempmail.js`):** `mail.tm` (`330ms` p50) -> `tempmail.lol` (`387ms` p50) -> `guerrillamail` (`391ms` p50) -> `temp-mail.io` (retained), backed by a bounded TTL session map (`MAX_STORED_SESSIONS = 2000`, 1h TTL) preserving `?email=` inbox routing.
- **Anime (`src/scrapers/anime.js`):** `anilist_graphql` (`441ms` p50) -> `kitsu_edge` (`1111ms` p50) -> `kusonime` (retained) -> `jikan`.
- **GSMArena (`src/scrapers/gsmarena.js`):** Fixed silent empty-array bug on datacenter block; fails over cleanly to `wikipedia_device_specs` (`240ms` p50).
- **Tools (`scrapers/tools.js`):** Upgraded `jadwalsholat` (`aladhan` Kemenag Method #20 `742ms` <-> `myquran` `1807ms`), `lirik` (`lrclib` <-> `lyrics.ovh`), `shortlink` (`da.gd` `450ms` <-> `spoo.me` `528ms` <-> `is.gd` <-> `tinyurl`), and `iplookup` (`ipwho.is` <-> `ipapi.co` <-> `freeipapi`).
- **All-In-One (`scrapers/aio.js`):** Expanded URL router across 11 platforms including SoundCloud, Sfile, MediaFire, and Pixeldrain with `validateSSRF`.

---

## 5. Twelve New Clean-Room Production Endpoints

1. `GET/POST /api/downloader/pixeldrain` (`/api/v1/downloader/pixeldrain`) — `src/scrapers/pixeldrain.js`
2. `GET/POST /api/search/manga` (`/api/v1/search/manga`) — `src/scrapers/manga.js` (`AniList` <-> `Kitsu`)
3. `GET/POST /api/search/wikipedia` (`/api/v1/search/wikipedia`) — `src/scrapers/wikipedia.js` (`REST v1` <-> `MediaWiki`)
4. `GET/POST /api/search/pinterest` (`/api/v1/search/pinterest`) — `src/scrapers/pinterest-search.js`
5. `GET/POST /api/search/applemusic` (`/api/v1/search/applemusic`) — `src/scrapers/applemusic.js`
6. `GET/POST /api/search/steam` (`/api/v1/search/steam`) — `src/scrapers/steam.js` (`Steam Storesearch` <-> `CheapShark`)
7. `GET/POST /api/search/sticker` (`/api/v1/search/sticker`) — `src/scrapers/sticker.js` (`Sticker.ly v4` <-> `Tenor Web`)
8. `GET/POST /api/search/soundboard` (`/api/v1/search/soundboard`) — `src/scrapers/soundboard.js` (`MyInstants` <-> `Archive.org`)
9. `GET/POST /api/stalker/npm` (`/api/tools/npm`, `/api/v1/stalker/npm`) — `src/scrapers/npm-stalk.js` (`NPM Registry` <-> `npms.io`)
10. `GET/POST /api/tools/translate` (`/api/v1/tools/translate`) — `src/scrapers/network-tools.js` (`Google GTX` <-> `MyMemory`)
11. `GET/POST /api/tools/dns` (`/api/v1/tools/dns`) — `src/scrapers/network-tools.js` (`Cloudflare DoH` <-> `Google DoH`)
12. `GET/POST /api/tools/ssweb` (`/api/v1/tools/ssweb`) — `src/scrapers/network-tools.js` (`validateSSRF` + `Thum.io` <-> `WP mShots`)
