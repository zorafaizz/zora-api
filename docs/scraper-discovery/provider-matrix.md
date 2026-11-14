# KanjutGede API — Production Multi-Engine Provider Matrix (42 Endpoints)

**Generated:** 2026-11-14  
**Orchestrator:** `src/core/resilience.js` (`executeMultiProvider`, EWMA Health $\alpha=0.3$, `FailureDomainTracker`, Circuit Breaker, Retry Budget + Jitter, AbortSignal Deadline, Bulkhead Isolation)  
**SSRF Guard:** `validateSSRF` (`src/core/security.js`)

## 1. Active Endpoint & Provider Failover Matrix

| # | Endpoint ID | Canonical Path | Ordered Provider Chain (`Tier 1 -> Fallback`) | Multi-Engine | Cache TTL | Deadline | Billing | SSRF Guard |
| ---: | :--- | :--- | :--- | :---: | ---: | ---: | :--- | :---: |
| 1 | `sys.health` | `/health` | `local_process` | Single | Disabled | 3000ms | no_quota (0 cr) | N/A |
| 2 | `dl.aio` | `/api/downloader/aio` | `ttdl_zone` -> `tikwm` -> `savetube` -> `youtube_initial_player` -> `fdown` -> `twimg_syndication` -> `fxtwitter` -> `x2twitter` -> `spotify_embed` -> `pinterest_html_json` -> `soundcloud_api_v2` -> `mediafire_cheerio` -> `sfile_cheerio` -> `pixeldrain_api` | Yes | Disabled | 25000ms | free_eligible (1 cr) | Enforced |
| 3 | `dl.tiktok` | `/api/downloader/tiktok` | `ttdl_zone` -> `tikwm` -> `lovetik` -> `yt-dlp` | Yes | 600s | 15000ms | free_eligible (1 cr) | Enforced |
| 4 | `dl.youtube` | `/api/downloader/youtube` | `savetube_vip` -> `youtube_initial_player` -> `invidious_nadeko` -> `yt-dlp` -> `noembed` | Yes | 900s | 25000ms | free_eligible (1 cr) | Enforced |
| 5 | `dl.instagram` | `/api/downloader/instagram` | `reelsvideo` -> `yt-dlp` | Yes | 900s | 15000ms | free_eligible (1 cr) | Enforced |
| 6 | `dl.facebook` | `/api/downloader/facebook` | `fdown` -> `yt-dlp` | Yes | 900s | 15000ms | free_eligible (1 cr) | Enforced |
| 7 | `dl.twitter` | `/api/downloader/twitter` | `twimg_syndication` -> `fxtwitter` -> `x2twitter` -> `yt-dlp` -> `twitter_oembed` | Yes | 900s | 15000ms | free_eligible (1 cr) | Enforced |
| 8 | `dl.spotify` | `/api/downloader/spotify` | `spotify_embed` -> `fabdl` -> `itunes_search` -> `spotify_oembed` | Yes | 3600s | 25000ms | free_eligible (1 cr) | Enforced |
| 9 | `dl.pinterest` | `/api/downloader/pinterest` | `pinterest_html_json` -> `pinterest_oembed` -> `yt-dlp` | Yes | 1800s | 15000ms | free_eligible (1 cr) | Enforced |
| 10 | `dl.soundcloud` | `/api/downloader/soundcloud` | `soundcloud_api_v2` -> `soundcloud_mobi` -> `soundcloud_oembed` | Yes | 3600s | 15000ms | free_eligible (1 cr) | N/A |
| 11 | `dl.sfile` | `/api/downloader/sfile` | `sfile_cheerio` | Single | 900s | 20000ms | free_eligible (1 cr) | Enforced |
| 12 | `dl.mediafire` | `/api/downloader/mediafire` | `mediafire_cheerio` | Single | 900s | 12000ms | free_eligible (1 cr) | Enforced |
| 13 | `dl.pixeldrain` | `/api/downloader/pixeldrain` | `pixeldrain_api` | Single | 900s | 12000ms | free_eligible (1 cr) | Enforced |
| 14 | `ai.chat` | `/api/ai/chat` | `pollinations_openai` -> `pollinations_mistral` -> `pollinations_qwen` | Yes | Disabled | 30000ms | free_eligible (2 cr) | N/A |
| 15 | `media.hd` | `/api/tools/hd` | `sharp_clahe` | Single | 86400s | 20000ms | paid_only (2 cr) | Enforced |
| 16 | `media.uhd` | `/api/tools/uhd` | `sharp_lanczos3` | Single | 86400s | 30000ms | paid_only (4 cr) | Enforced |
| 17 | `info.gempa` | `/api/tools/gempa` | `bmkg_tews` | Single | 300s | 8000ms | free_eligible (1 cr) | N/A |
| 18 | `info.gempa.terkini` | `/api/tools/gempa/terkini` | `bmkg_tews` | Single | 300s | 8000ms | free_eligible (1 cr) | N/A |
| 19 | `info.sholat` | `/api/tools/jadwalsholat` | `aladhan_kemenag` -> `myquran_api` | Yes | 86400s | 8000ms | free_eligible (1 cr) | N/A |
| 20 | `util.lirik` | `/api/tools/lirik` | `lrclib` -> `lyrics_ovh` | Yes | 604800s | 10000ms | free_eligible (1 cr) | N/A |
| 21 | `util.shortlink` | `/api/tools/shortlink` | `dagd` -> `spoome` -> `isgd` -> `tinyurl` | Yes | 2592000s | 8000ms | free_eligible (1 cr) | Enforced |
| 22 | `search.gsmarena` | `/api/search/gsmarena` | `wikipedia_device_specs` -> `gsmarena_cheerio` | Yes | 604800s | 12000ms | free_eligible (1 cr) | N/A |
| 23 | `search.anime` | `/api/search/anime` | `anilist_graphql` -> `kitsu_edge` -> `kusonime_cheerio` -> `jikan_mal` | Yes | 86400s | 12000ms | free_eligible (1 cr) | N/A |
| 24 | `tool.tempmail` | `/api/tools/tempmail` | `mail_tm` -> `tempmail_lol` -> `guerrillamail` -> `tempmail_io` | Yes | Disabled | 10000ms | free_eligible (1 cr) | N/A |
| 25 | `tool.tempmail.inbox` | `/api/tools/tempmail/inbox` | `mail_tm` -> `tempmail_lol` -> `guerrillamail` -> `tempmail_io` | Yes | Disabled | 10000ms | free_eligible (1 cr) | N/A |
| 26 | `stalk.github` | `/api/tools/github` | `github_api` | Single | 3600s | 8000ms | free_eligible (1 cr) | N/A |
| 27 | `util.iplookup` | `/api/tools/iplookup` | `ipwhois` -> `ipapi_co` -> `freeipapi` | Yes | 86400s | 6000ms | free_eligible (1 cr) | N/A |
| 28 | `tool.presetam` | `/api/tools/presetam` | `alight_finder` | Single | 3600s | 15000ms | free_eligible (1 cr) | Enforced |
| 29 | `search.manga` | `/api/search/manga` | `anilist_graphql` -> `kitsu_edge` | Yes | 86400s | 15000ms | free_eligible (1 cr) | N/A |
| 30 | `search.wikipedia` | `/api/search/wikipedia` | `wikipedia_rest_v1` -> `mediawiki_extracts` | Yes | 86400s | 12000ms | free_eligible (1 cr) | N/A |
| 31 | `search.pinterest` | `/api/search/pinterest` | `pinterest_resource` -> `pinterest_html_search` | Yes | 3600s | 15000ms | free_eligible (1 cr) | N/A |
| 32 | `search.applemusic` | `/api/search/applemusic` | `itunes_catalog_id` -> `itunes_catalog_us` | Yes | 3600s | 12000ms | free_eligible (1 cr) | N/A |
| 33 | `search.steam` | `/api/search/steam` | `steam_storesearch` -> `steam_cheapshark` | Yes | 3600s | 15000ms | free_eligible (1 cr) | N/A |
| 34 | `search.sticker` | `/api/search/sticker` | `sticker_stickerly_v4` -> `sticker_tenor_web` | Yes | 3600s | 15000ms | free_eligible (1 cr) | N/A |
| 35 | `search.soundboard` | `/api/search/soundboard` | `soundboard_myinstants` -> `soundboard_archive_org` | Yes | 86400s | 15000ms | free_eligible (1 cr) | N/A |
| 36 | `stalk.npm` | `/api/stalker/npm` | `npm_official_registry` -> `npm_npms_io` | Yes | 3600s | 15000ms | free_eligible (1 cr) | N/A |
| 37 | `tool.translate` | `/api/tools/translate` | `translate_google_gtx` -> `translate_mymemory` | Yes | 86400s | 12000ms | free_eligible (1 cr) | N/A |
| 38 | `tool.dns` | `/api/tools/dns` | `dns_cloudflare_doh` -> `dns_google_doh` | Yes | 600s | 10000ms | free_eligible (1 cr) | N/A |
| 39 | `tool.ssweb` | `/api/tools/ssweb` | `ssweb_thumio` -> `ssweb_wp_mshots` | Yes | 1800s | 16000ms | free_eligible (1 cr) | Enforced |
| 40 | `solve.waf` | `/api/solver/waf` | `flaresolverr_local` | Single | Disabled | 60000ms | paid_only (5 cr) | Enforced |
| 41 | `solve.turnstile` | `/api/solver/turnstile` | `flaresolverr_local` | Single | Disabled | 60000ms | paid_only (5 cr) | Enforced |
| 42 | `solve.bridge` | `/v1` | `flaresolverr_local` | Single | Disabled | 60000ms | paid_only (5 cr) | N/A |

## 2. Empirical Benchmark Latency Highlights (Live VPS Validation)

| Provider ID | Capability | Failure Domain | Success Rate | p50 Latency | p95 Latency | Role |
| :--- | :--- | :--- | ---: | ---: | ---: | :--- |
| `tiktok.tikwm` | `dl.tiktok` | `tikwm.com` | 100% | 830ms | 1326ms | `primary_or_co_primary` |
| `tiktok.ttdlzone` | `dl.tiktok` | `ttdl.zone.id` | 100% | 226ms | 5914ms | `primary_or_co_primary` |
| `youtube.oembed_official` | `dl.ytmp4 / search.youtube` | `youtube.com` | 100% | 127ms | 866ms | `primary_or_co_primary` |
| `youtube.noembed` | `dl.ytmp4` | `noembed.com` | 100% | 96ms | 565ms | `primary_or_co_primary` |
| `youtube.html_ytinitialdata` | `search.youtube` | `youtube.com` | 100% | 595ms | 812ms | `primary_or_co_primary` |
| `spotify.oembed` | `dl.spotify` | `spotify.com` | 100% | 282ms | 863ms | `primary_or_co_primary` |
| `spotify.embed_json` | `dl.spotify` | `open.spotify.com/embed` | 100% | 385ms | 1469ms | `primary_or_co_primary` |
| `spotify.itunes_preview_fallback` | `dl.spotify / search.applemusic` | `itunes.apple.com` | 100% | 115ms | 811ms | `primary_or_co_primary` |
| `pinterest.oembed` | `dl.pinterest` | `pinterest.com/oembed` | 100% | 627ms | 1406ms | `primary_or_co_primary` |
| `pinterest.pinsearch_resource` | `search.pinterest` | `pinterest.com` | 100% | 924ms | 2095ms | `secondary_fallback` |
| `tempmail.mailtm` | `tool.tempmail` | `api.mail.tm` | 100% | 330ms | 863ms | `primary_or_co_primary` |
| `tempmail.tempmail_lol` | `tool.tempmail` | `api.tempmail.lol` | 100% | 387ms | 497ms | `primary_or_co_primary` |
| `tempmail.guerrillamail` | `tool.tempmail` | `guerrillamail.com` | 100% | 391ms | 3857ms | `primary_or_co_primary` |
| `lyrics.lrclib` | `util.lirik` | `lrclib.net` | 100% | 476ms | 1192ms | `primary_or_co_primary` |
| `lyrics.lyrics_ovh` | `util.lirik` | `lyrics.ovh` | 100% | 439ms | 1631ms | `primary_or_co_primary` |
| `iplookup.ipwhois` | `util.iplookup` | `ipwho.is` | 100% | 169ms | 656ms | `primary_or_co_primary` |
| `iplookup.freeipapi` | `util.iplookup` | `freeipapi.com` | 100% | 365ms | 1376ms | `primary_or_co_primary` |
| `iplookup.ipapi_co` | `util.iplookup` | `ipapi.co` | 100% | 293ms | 762ms | `primary_or_co_primary` |
| `anime.kusonime` | `search.anime` | `kusonime.com` | 100% | 573ms | 1028ms | `primary_or_co_primary` |
| `anime_manga.anilist_graphql` | `search.anime / search.manga` | `graphql.anilist.co` | 100% | 441ms | 791ms | `primary_or_co_primary` |
| `ai.pollinations_openai` | `ai.chat` | `text.pollinations.ai` | 100% | 589ms | 3492ms | `primary_or_co_primary` |
| `ai.pollinations_image` | `ai.text2img` | `image.pollinations.ai` | 50% | 642ms | 7519ms | `degraded_fallback` |
| `translate.google_gtx` | `util.translate` | `translate.googleapis.com` | 100% | 158ms | 1806ms | `primary_or_co_primary` |
| `translate.mymemory` | `util.translate` | `api.mymemory.translated.net` | 100% | 1062ms | 2152ms | `secondary_fallback` |
| `dns.cloudflare_doh` | `dev.dns` | `cloudflare-dns.com` | 100% | 186ms | 662ms | `primary_or_co_primary` |
| `dns.google_doh` | `dev.dns` | `dns.google` | 100% | 426ms | 1277ms | `primary_or_co_primary` |
| `ssweb.microlink` | `img.ssweb` | `api.microlink.io` | 100% | 348ms | 1928ms | `primary_or_co_primary` |
| `ssweb.thumio` | `img.ssweb` | `image.thum.io` | 100% | 436ms | 3567ms | `primary_or_co_primary` |
| `pixeldrain.api_info` | `dl.pixeldrain` | `pixeldrain.com` | 100% | 528ms | 1642ms | `primary_or_co_primary` |
| `sholat.myquran_kemenag` | `regional.sholat` | `api.myquran.com` | 100% | 1807ms | 2301ms | `secondary_fallback` |
| `sholat.aladhan` | `regional.sholat` | `api.aladhan.com` | 100% | 742ms | 2811ms | `primary_or_co_primary` |
| `wikipedia.rest_id` | `search.wikipedia` | `wikipedia.org` | 100% | 49ms | 928ms | `primary_or_co_primary` |
| `github.user_profile` | `stalk.github` | `api.github.com` | 100% | 95ms | 590ms | `primary_or_co_primary` |
| `steam.storesearch` | `search.steam` | `store.steampowered.com` | 100% | 557ms | 690ms | `primary_or_co_primary` |
| `steam.cheapshark_deals` | `search.steam` | `cheapshark.com` | 100% | 445ms | 811ms | `primary_or_co_primary` |
| `stickerly.search` | `search.sticker` | `api.sticker.ly` | 100% | 477ms | 1522ms | `primary_or_co_primary` |
| `myinstants.soundboard` | `audio.soundboard` | `myinstants.com` | 100% | 196ms | 791ms | `primary_or_co_primary` |
| `tracemoe.api_me` | `search.tracemoe` | `api.trace.moe` | 100% | 405ms | 1241ms | `primary_or_co_primary` |
| `twitter.fxtwitter_real` | `dl.twitter` | `fxtwitter.com` | 100% | 431ms | 658ms | `primary_or_co_primary` |
| `twitter.syndication_twimg_real` | `dl.twitter` | `twimg.com` | 100% | 199ms | 856ms | `primary_or_co_primary` |
| `soundcloud.oembed_active` | `dl.soundcloud` | `soundcloud.com` | 100% | 362ms | 849ms | `primary_or_co_primary` |
| `twitter.oembed_publish` | `dl.twitter` | `publish.twitter.com` | 100% | 709ms | 1673ms | `primary_or_co_primary` |
| `shortlink.dagd` | `util.shortlink` | `da.gd` | 100% | 450ms | 1237ms | `primary_or_co_primary` |
| `shortlink.spoome` | `util.shortlink` | `spoo.me` | 100% | 528ms | 1002ms | `primary_or_co_primary` |
| `manga.kitsu_api` | `search.manga` | `kitsu.io` | 100% | 591ms | 1154ms | `primary_or_co_primary` |
| `anime.kitsu_api` | `search.anime` | `kitsu.io` | 100% | 1111ms | 1999ms | `secondary_fallback` |
| `manga.anilist_graphql` | `search.manga` | `graphql.anilist.co` | 100% | 525ms | 1491ms | `primary_or_co_primary` |
| `wikipedia.rest_en_fallback` | `search.wikipedia` | `en.wikipedia.org` | 100% | 81ms | 927ms | `primary_or_co_primary` |
| `npm.registry_package` | `stalk.github / dev.npm` | `registry.npmjs.org` | 100% | 275ms | 1712ms | `primary_or_co_primary` |
| `soundcloud.apiv2_active` | `dl.soundcloud` | `api-v2.soundcloud.com` | 100% | 1485ms | 2122ms | `secondary_fallback` |
| `device_specs.wikipedia_search_api` | `search.gsmarena` | `en.wikipedia.org` | 100% | 561ms | 881ms | `primary_or_co_primary` |
| `tiktok.ttdlzone_detail` | `dl.tiktok` | `ttdl.zone.id` | 100% | 215ms | 716ms | `primary_or_co_primary` |
