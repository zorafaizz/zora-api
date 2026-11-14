# KanjutGede API — Rejected, Quarantined & Restricted Candidates

**Generated:** 2026-11-14  
**Policy Reference:** `integrations1.md` Sections 1, 5, 8, and Execution Rules

## 1. Unavailable External Sources

- **`https://xmz-scraper.my.id/index.php` (Source #5 — Unavailable)**
  - **DNS / Origin IP:** `154.12.117.162` (`nginx/1.26.3`)
  - **TLS Inspection:** Presents Let's Encrypt certificate valid only for `IP Address:154.12.117.162` (*SSL Certificate Hostname Mismatch*).
  - **HTTP Status:** Returns `HTTP 404 Not Found` on both `/index.php` and `/`.
  - **Archive Verification:** Wayback Machine CDX API returned `0` historical captures.

## 2. Access-Restricted Candidates (Respected Without Bypass)

| Candidate ID | Source Site | URL | Access Status | Disposition |
| :--- | :--- | :--- | :--- | :--- |
| `CAND-0051-CKIZZ` | `codeku.izzxd.my.id` | `https://codeku.izzxd.my.id/code/dy1w3f` | `Authentication/password lock respected without bypass (locked_http_401).` | `rejected_access_restricted` |
| `CAND-0089-CKIZZ` | `codeku.izzxd.my.id` | `https://codeku.izzxd.my.id/code/fz7ezj` | `Authentication/password lock respected without bypass (locked_http_401).` | `rejected_access_restricted` |
| `CAND-0251-CKTHV` | `codeku.theresav.eu` | `https://codeku.theresav.eu/snippet/1xO4LSgk` | `Authentication/password lock respected without bypass (locked_password).` | `rejected_access_restricted` |
| `CAND-0264-CKTHV` | `codeku.theresav.eu` | `https://codeku.theresav.eu/snippet/Tz5RVKDp` | `Authentication/password lock respected without bypass (locked_password).` | `rejected_access_restricted` |
| `CAND-0315-CKTHV` | `codeku.theresav.eu` | `https://codeku.theresav.eu/snippet/Pu2lzJ9i` | `Authentication/password lock respected without bypass (locked_password).` | `rejected_access_restricted` |

## 3. Policy, Abuse, Security & License Rejections

| Candidate ID | Source Site | Title | Security / Policy Flags | Reason |
| :--- | :--- | :--- | :--- | :--- |
| `CAND-0050-CKIZZ` | `codeku.izzxd.my.id` | FakeKTP | `filesystem_write, abuse_or_policy_violation` | Flagged by security/policy gate (OTP spammer, NSFW/gore, fake identity generator, or abusive automation). |
| `CAND-0077-CKIZZ` | `codeku.izzxd.my.id` | Musicfyrik Scraper | `filesystem_write, redacted_secret:google_api_key` | Contains hardcoded third-party secret/API key (redacted in staging); excluded from production. |
| `CAND-0080-CKIZZ` | `codeku.izzxd.my.id` | FloX Tools (All Utilities) | `abuse_or_policy_violation` | Flagged by security/policy gate (OTP spammer, NSFW/gore, fake identity generator, or abusive automation). |
| `CAND-0097-CKIZZ` | `codeku.izzxd.my.id` | Fake KTP Generator | `filesystem_write, abuse_or_policy_violation` | Flagged by security/policy gate (OTP spammer, NSFW/gore, fake identity generator, or abusive automation). |
| `CAND-0155-CKIZZ` | `codeku.izzxd.my.id` | YouTube Search + Downloader | `redacted_secret:google_api_key` | Contains hardcoded third-party secret/API key (redacted in staging); excluded from production. |
| `CAND-0179-GHERZ` | `gist.github.com/herzonly` | ytdl.js | `unspecified_public_snippet` | Upstream p.savenow.to now enforces mandatory commercial API key (HTTP 403 api_key_required) |
| `CAND-0191-GHERZ` | `gist.github.com/herzonly` | wormgpt.js | `headless_browser_dependency, abuse_or_policy_violation` | Flagged by security/policy gate (OTP spammer, NSFW/gore, fake identity generator, or abusive automation). |
| `CAND-0192-GHERZ` | `gist.github.com/herzonly` | plug-hackai.js | `abuse_or_policy_violation` | Flagged by security/policy gate (OTP spammer, NSFW/gore, fake identity generator, or abusive automation). |
| `CAND-0199-GHERZ` | `gist.github.com/herzonly` | hackai.js | `redacted_secret:google_api_key, abuse_or_policy_violation` | Flagged by security/policy gate (OTP spammer, NSFW/gore, fake identity generator, or abusive automation). |
| `CAND-0200-GHERZ` | `gist.github.com/herzonly` | ddownr.js | `unspecified_public_snippet` | Upstream p.savenow.to now enforces mandatory commercial API key (HTTP 403 api_key_required) |
| `CAND-0216-CKTHV` | `codeku.theresav.eu` | Code Snippet (snippet-mw7j699s.js) | `shell_or_subprocess_execution, abuse_or_policy_violation` | Flagged by security/policy gate (OTP spammer, NSFW/gore, fake identity generator, or abusive automation). |
| `CAND-0217-CKTHV` | `codeku.theresav.eu` | Code Snippet (snippet-mw7j69di.js) | `shell_or_subprocess_execution, abuse_or_policy_violation` | Flagged by security/policy gate (OTP spammer, NSFW/gore, fake identity generator, or abusive automation). |
| `CAND-0219-CKTHV` | `codeku.theresav.eu` | MioHentai Video Scraper & Downloader | `abuse_or_policy_violation` | Flagged by security/policy gate (OTP spammer, NSFW/gore, fake identity generator, or abusive automation). |
| `CAND-0225-CKTHV` | `codeku.theresav.eu` | XHamster Video Scraper & HLS Stream Downloader (xhamster.js) | `shell_or_subprocess_execution, abuse_or_policy_violation` | Flagged by security/policy gate (OTP spammer, NSFW/gore, fake identity generator, or abusive automation). |
| `CAND-0226-CKTHV` | `codeku.theresav.eu` | NekoPoi Search & Video Stream Downloader (WP REST + Cheerio) | `shell_or_subprocess_execution, abuse_or_policy_violation` | Flagged by security/policy gate (OTP spammer, NSFW/gore, fake identity generator, or abusive automation). |
| `CAND-0228-CKTHV` | `codeku.theresav.eu` | Hentai.tv Search & Detail Scraper | `abuse_or_policy_violation` | Flagged by security/policy gate (OTP spammer, NSFW/gore, fake identity generator, or abusive automation). |
| `CAND-0244-CKTHV` | `codeku.theresav.eu` | Spam OTP & AM Prem | `abuse_or_spam_tool, abuse_or_policy_violation` | Flagged by security/policy gate (OTP spammer, NSFW/gore, fake identity generator, or abusive automation). |
| `CAND-0250-CKTHV` | `codeku.theresav.eu` | bypass bicolink | `dynamic_eval, headless_browser_dependency` | Unsafe dynamic code execution pattern (dynamic_eval, headless_browser_dependency); quarantined. |
| `CAND-0263-CKTHV` | `codeku.theresav.eu` | SEARCH MEDIA / tenor.com | `redacted_secret:google_api_key` | Contains hardcoded third-party secret/API key (redacted in staging); excluded from production. |
| `CAND-0282-CKTHV` | `codeku.theresav.eu` | Scrape Alight Motion | `restricted_no_redistribution` | Author explicitly restricts redistribution; excluded from production. |
| `CAND-0283-CKTHV` | `codeku.theresav.eu` | Scrape Amprem | `restricted_no_redistribution` | Author explicitly restricts redistribution; excluded from production. |
| `CAND-0326-CKTHV` | `codeku.theresav.eu` | PORNHUB | `abuse_or_policy_violation` | Flagged by security/policy gate (OTP spammer, NSFW/gore, fake identity generator, or abusive automation). |
| `CAND-0355-HAIDR` | `snippet.haidarxd.my.id` | Nekopoi temen aku colay | `shell_or_subprocess_execution, abuse_or_policy_violation` | Flagged by security/policy gate (OTP spammer, NSFW/gore, fake identity generator, or abusive automation). |
| `CAND-0369-HAIDR` | `snippet.haidarxd.my.id` | ChordTela Scraper | `dynamic_eval, headless_browser_dependency, filesystem_write` | Unsafe dynamic code execution pattern (dynamic_eval, headless_browser_dependency, filesystem_write); quarantined. |
| `CAND-0373-HAIDR` | `snippet.haidarxd.my.id` | FastDL Scraper | `dynamic_eval, filesystem_write` | Unsafe dynamic code execution pattern (dynamic_eval, filesystem_write); quarantined. |
| `CAND-0378-HAIDR` | `snippet.haidarxd.my.id` | SeeGore Streaming | `abuse_or_policy_violation` | Flagged by security/policy gate (OTP spammer, NSFW/gore, fake identity generator, or abusive automation). |
| `CAND-0387-PBOMN` | `pastebin.com/u/OmnifyLabs` | Alight Motion Suite | `filesystem_write, redacted_secret:google_api_key` | Contains hardcoded third-party secret/API key (redacted in staging); excluded from production. |
| `CAND-0438-JHXFC` | `code.jhx.my.id` | tracemoe.js | `unspecified_public_snippet` | Disables TLS certificate verification (rejectUnauthorized: false); original implementation rejected. |
| `CAND-0469-CDXKU` | `codexku.vercel.app` | Flox spam otp | `abuse_or_spam_tool, abuse_or_policy_violation` | Flagged by security/policy gate (OTP spammer, NSFW/gore, fake identity generator, or abusive automation). |
| `CAND-0483-DONZX` | `donzfolderx.vercel.app` | xDonzAm Website.zip :: app.js | `redacted_secret:google_api_key` | Contains hardcoded third-party secret/API key (redacted in staging); excluded from production. |
| `CAND-0486-ZANE` | `github.com/zanegiluyy-maker/Scraper-By-Zane` | aio | `redacted_secret:google_api_key` | Contains hardcoded third-party secret/API key (redacted in staging); excluded from production. |

## 4. Failed Live Benchmark Upstreams (Excluded or Demoted)

| Provider ID | Capability | Failure Domain | HTTP / Error Note | Decision |
| :--- | :--- | :--- | :--- | :--- |
| `tiktok.oembed` | `dl.tiktok` | `tiktok.com` | `{"version":"1.0","type":"video","width":"325","height":"578","html":"<iframe height=\"578\` | Excluded from primary tiers |
| `youtube.piped_kavin` | `search.youtube` | `pipedapi.kavin.rocks` | `status=525` | Excluded from primary tiers |
| `instagram.instaloadr` | `dl.instagram` | `instaloadr.com` | `{"detail":"Couldn't resolve that link. It may be private or expired."}` | Excluded from primary tiers |
| `twitter.vxtwitter_api` | `dl.twitter` | `vxtwitter.com` | `Unexpected token '<', "<!DOCTYPE "... is not valid JSON` | Excluded from primary tiers |
| `twitter.fxtwitter_api` | `dl.twitter` | `fxtwitter.com` | `{"code":404,"message":"NOT_FOUND","tweet":{"type":"tombstone","provider":"twitter","reason` | Excluded from primary tiers |
| `twitter.syndication_twimg` | `dl.twitter` | `twimg.com` | `{"__typename":"TweetTombstone","tombstone":{"text":{"entities":[{"from_index":26,"ref":{"_` | Excluded from primary tiers |
| `spotify.fabdl` | `dl.spotify` | `fabdl.com` | `{     "error": {         "code": 403,         "message": "invalid origin"     } }` | Excluded from primary tiers |
| `soundcloud.oembed` | `dl.soundcloud` | `soundcloud.com` | `Unexpected end of JSON input` | Excluded from primary tiers |
| `soundcloud.apiv2_dynamic_client` | `dl.soundcloud` | `api-v2.soundcloud.com` | `{}` | Excluded from primary tiers |
| `tempmail.1secmail` | `tool.tempmail` | `1secmail.com` | `fetch failed` | Excluded from primary tiers |
| `shortlink.isgd` | `util.shortlink` | `is.gd` | `Unexpected token '<', "<!DOCTYPE "... is not valid JSON` | Excluded from primary tiers |
| `shortlink.cleanuri` | `util.shortlink` | `cleanuri.com` | `Timeout after 8500ms` | Excluded from primary tiers |
| `anime.jikan_mal` | `search.anime` | `api.jikan.moe` | `fetch failed` | Excluded from primary tiers |
| `manga.mangadex_api` | `search.manga` | `api.mangadex.org` | `Unexpected token 'B', "Bot challe"... is not valid JSON` | Excluded from primary tiers |
| `manga.jikan_manga` | `search.manga` | `api.jikan.moe` | `fetch failed` | Excluded from primary tiers |
| `twitter.vxtwitter_real` | `dl.twitter` | `vxtwitter.com` | `<!DOCTYPE html><html lang="en-US"><head><title>Just a moment...</title><meta htt` | Excluded from primary tiers |
| `shortlink.tinyurl` | `util.shortlink` | `tinyurl.com` | `Error` | Excluded from primary tiers |
| `youtube.vidssave` | `dl.ytmp4 / dl.ytmp3` | `api.vidssave.com` | `resources=0 body={"msg":"failed","status":0,"status_code":"analyze_failed"}` | Excluded from primary tiers |
| `spotify.fabdl_with_origin` | `dl.spotify` | `fabdl.com` | `{     "error": {         "code": 403,         "message": "invalid origin"     } ` | Excluded from primary tiers |
| `tiktok.oembed_fixed_check` | `dl.tiktok` | `tiktok.com` | `invalid` | Excluded from primary tiers |
| `gsmarena.mobile_site` | `search.gsmarena` | `gsmarena.com` | `status=200 makers=false` | Excluded from primary tiers |
| `youtube.savenow_ajax` | `dl.ytmp3 / dl.ytmp4` | `savenow.to` | `{"docs_url":"https://video-download-api.com/api/docs","error_code":"api_key_required","mes` | Excluded from primary tiers |
| `youtube.invidious_nadeko` | `search.youtube / dl.ytmp4` | `inv.nadeko.net` | `status=403` | Excluded from primary tiers |
