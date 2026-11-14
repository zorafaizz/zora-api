# KanjutGede API — Complete Endpoint Inventory & Compatibility Contract

**Document Version:** 1.0.0  
**Repository:** `/home/zorafaiz/api-service`  
**Base Domain:** `api.itsfaiz.my.id`  
**Authoritative Plan:** `PLAN.md` (Section 1)

---

## 1. Universal Legacy Compatibility Contract

Untuk menjamin **100% backward compatibility** terhadap bot WhatsApp (ZoraMD, Luluu AI, Neoxr parser, Jere parser, dll), semua endpoint yang telah ada WAJIB mempertahankan:
1. **URL & Aliases yang sama:** Rute lama (seperti `/api/downloader/tiktok`, `/api/downloader/tt`) tetap aktif.
2. **HTTP Method Permissive:** Mendukung `GET` (via query string) dan `POST` (via JSON body atau x-www-form-urlencoded).
3. **Legacy Envelope Schema:**
   ```json
   {
     "status": true,
     "creator": "KanjutGede",
     "latency": "45ms",
     "result": { ... },
     "data": { ... }
   }
   ```
4. **New API v1 Architecture:** Seluruh endpoint baru atau versi standar diakses di `/api/v1/...` dengan header standar:
   - `X-Request-ID`: UUIDv4
   - `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
   - `X-Quota-Daily-Remaining`, `X-Credit-Remaining`

---

## 2. Mounted Route Inventory (Active in `server.js`)

| Endpoint ID | Kategori | Method | Path & Aliases | Parameter | Upstream / Engine | Resource Class | Cache Policy | Billing Policy |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `sys.health` | System | GET | `/health` | - | Local Node process | Minimal | No Cache | Free / No Quota |
| `dl.aio` | Downloader | ALL | `/api/downloader/aio`<br>`/api/downloader/aiov2`<br>`/api/v1/downloader/aio` | `url` | Multi-engine (TikTok, YT, FB, X, Spotify, Pin, MF) | Medium | No Cache | Eligible Free / 1 Credit |
| `dl.tiktok` | Downloader | ALL | `/api/downloader/tiktok`<br>`/api/downloader/tt`<br>`/api/v1/downloader/tiktok` | `url` | TikWM API (Primary) + yt-dlp fallback | Medium | 10 Min URL | Eligible Free / 1 Credit |
| `dl.youtube` | Downloader | ALL | `/api/downloader/youtube`<br>`/api/downloader/yt`<br>`/api/downloader/ytmp4`<br>`/api/downloader/ytmp3`<br>`/api/v1/downloader/youtube` | `url` | Savetube AES Decryption + yt-dlp fallback | High | 15 Min URL | Eligible Free / 1 Credit |
| `dl.instagram`| Downloader | ALL | `/api/downloader/instagram`<br>`/api/downloader/ig`<br>`/api/downloader/reelsvideo`<br>`/api/v1/downloader/instagram` | `url` | ReelsVideo AJAX MD5 + yt-dlp fallback | Medium | 15 Min URL | Eligible Free / 1 Credit |
| `dl.facebook` | Downloader | ALL | `/api/downloader/facebook`<br>`/api/downloader/fb`<br>`/api/v1/downloader/facebook` | `url` | FDown Cheerio AJAX + yt-dlp fallback | Medium | 15 Min URL | Eligible Free / 1 Credit |
| `dl.twitter` | Downloader | ALL | `/api/downloader/twitter`<br>`/api/downloader/x`<br>`/api/v1/downloader/twitter` | `url` | X2Twitter AJAX + yt-dlp fallback | Medium | 15 Min URL | Eligible Free / 1 Credit |
| `dl.spotify` | Downloader | ALL | `/api/downloader/spotify`<br>`/api/downloader/spotidownloader`<br>`/api/v1/downloader/spotify` | `url` / `q` | Spotify oEmbed + iTunes Search + yt-dlp audio | Medium | 1 Jam Metadata | Eligible Free / 1 Credit |
| `dl.pinterest`| Downloader | ALL | `/api/downloader/pinterest`<br>`/api/downloader/pin`<br>`/api/v1/downloader/pinterest` | `url` | Direct Pin Scraper + yt-dlp | Low | 30 Min URL | Eligible Free / 1 Credit |
| `dl.mediafire`| Downloader | ALL | `/api/downloader/mediafire`<br>`/api/v1/downloader/mediafire` | `url` | MediaFire Direct HTML Cheerio Parser | Low | 15 Min URL | Eligible Free / 1 Credit |
| `ai.chat` | AI & LLM | ALL | `/api/ai/chat`<br>`/api/ai/aichat`<br>`/api/ai/chatai`<br>`/api/ai/chatcompletion`<br>`/api/v1/ai/chat` | `prompt`, `system`, `model` | Pollinations (OpenAI, Mistral, Qwen) | Medium | No Cache | Eligible Free / 2 Credits |
| `media.hd` | Image & Media| ALL | `/api/tools/hd`<br>`/api/v1/tools/hd` | `url` | Sharp C++ CLAHE & Unsharp Mask | Heavy CPU | 1 Hari Hash | Paid Only (2 Credits) |
| `media.uhd` | Image & Media| ALL | `/api/tools/uhd`<br>`/api/v1/tools/uhd` | `url`, `scale` | Sharp Lanczos3 Super-Resolution | Heavy CPU/RAM | 1 Hari Hash | Paid Only (4 Credits) |
| `info.gempa` | Info & Data | GET | `/api/tools/gempa`<br>`/api/search/bmkg`<br>`/api/v1/tools/gempa` | - | BMKG Autogempa Realtime | Minimal | 5 Menit TTL | Eligible Free / 1 Credit |
| `info.gempa.terkini` | Info & Data | GET | `/api/tools/gempa/terkini`<br>`/api/v1/tools/gempa/terkini` | - | BMKG Gempaterkini List | Minimal | 5 Menit TTL | Eligible Free / 1 Credit |
| `info.sholat` | Info & Data | ALL | `/api/tools/jadwalsholat`<br>`/api/search/jadwalsholat`<br>`/api/v1/tools/jadwalsholat` | `kota` | MyQuran Kemenag API | Minimal | 24 Jam TTL | Eligible Free / 1 Credit |
| `util.lirik` | Search & Disc| ALL | `/api/tools/lirik`<br>`/api/search/lirik`<br>`/api/v1/search/lirik` | `artist`, `title` | Lyrics.ovh API | Minimal | 7 Hari TTL | Eligible Free / 1 Credit |
| `util.shortlink` | Utilities | ALL | `/api/tools/shortlink`<br>`/api/v1/tools/shortlink` | `url` | TinyURL API | Minimal | 30 Hari TTL | Eligible Free / 1 Credit |
| `stalk.github`| Profiles | ALL | `/api/tools/github`<br>`/api/stalker/stalkgithub`<br>`/api/v1/stalker/github` | `username` | GitHub Public REST API | Low | 1 Jam TTL | Eligible Free / 1 Credit |
| `util.iplookup` | Utilities | ALL | `/api/tools/iplookup`<br>`/api/v1/tools/iplookup` | `ip` | IP-API / IPInfo | Minimal | 1 Hari TTL | Eligible Free / 1 Credit |
| `tool.presetam` | Utilities | ALL | `/api/tools/presetam`<br>`/api/tools/findpresetam`<br>`/api/v1/tools/presetam` | `url` | TikTok/Shorts Metadata + Deep Regex | Medium | 1 Jam TTL | Eligible Free / 1 Credit |
| `solve.waf` | Solvers | ALL | `/api/solver/waf`<br>`/api/v1/solver/waf` | `url` | Local FlareSolverr v3.5.2 (Port 8191) | Heavy I/O | No Cache | Paid Only (5 Credits) |
| `solve.turnstile` | Solvers | ALL | `/api/solver/turnstile`<br>`/api/v1/solver/turnstile` | `url`, `sitekey` | Local FlareSolverr v3.5.2 (Port 8191) | Heavy I/O | No Cache | Paid Only (5 Credits) |
| `solve.bridge`| Solvers | ALL | `/v1`<br>`/api/solver/flaresolverr` | Body / Query | Local FlareSolverr v3.5.2 Bridge | Heavy I/O | No Cache | Paid Only (5 Credits) |

---

## 3. Unexposed Raw Scrapers Inventory (`library/raw/`)

| File Raw | Fitur | Kategori | Upstream / Metode | Status Audit & Action Plan |
| :--- | :--- | :--- | :--- | :--- |
| `downloader/terabox-ourin1.js` | TeraBox Downloader | Downloader | FlowVideoPlayer scraper + CSRF | **Audit Approved:** Perlu SSRF guard & size cap 200MB. Mount ke `/api/v1/downloader/terabox`. |
| `downloader/soundcloud-ourin1.js`| SoundCloud Downloader | Downloader | SoundCloud Mobile API | **Audit Approved:** Mount ke `/api/v1/downloader/soundcloud`. |
| `downloader/sfile-ourin1.js` | Sfile.mobi Direct Link | Downloader | Cheerio DOM traversal multi-step | **Audit Approved:** Mount ke `/api/v1/downloader/sfile`. |
| `search/gsmarena-ourin1.js` | Phone Specs & Catalog | Search | GSMArena API / Cheerio | **Audit Approved:** Butuh caching 7 hari. Mount ke `/api/v1/search/gsmarena`. |
| `search/anime-ourin1.js` | Kusonime Anime Search | Search | Kusonime HTML scraper | **Audit Approved:** Butuh caching 1 hari. Mount ke `/api/v1/search/anime`. |
| `tools/tempmail-ourin1.js` | Disposable Email & OTP | Temp Mail | Temp-mail.io API | **Audit Approved:** Disable cache demi privasi. Mount ke `/api/v1/tools/tempmail`. |
| `tools/uploader-jere1.js` | Image / File Uploader | Storage | Catbox, Telegra.ph, Pomf | **Audit Approved:** Validasi magic bytes & size limit 10MB. Mount ke `/api/v1/tools/upload`. |
| `tools/removebg-ourin1.js` | Background Remover | Media | Pixelcut API | **Audit Approved:** Fallback ke Sharp threshold mask jika upstream offline. Mount ke `/api/v1/tools/removebg`. |

---

## 4. New Platform & Commercial Routes (`/api/v1/...`)

| Endpoint ID | Method | Path | Deskripsi |
| :--- | :--- | :--- | :--- |
| `auth.session` | GET/POST | `/api/v1/auth/session` | Get current user session info |
| `auth.login` | POST | `/api/v1/auth/login` | Email / Google OAuth session exchange |
| `auth.logout` | POST | `/api/v1/auth/logout` | Revoke session cookie |
| `keys.list` | GET | `/api/v1/keys` | List API Keys for authenticated user |
| `keys.create` | POST | `/api/v1/keys` | Create new Zora Live/Test API Key |
| `keys.revoke` | DELETE | `/api/v1/keys/:id` | Revoke specific API Key |
| `billing.wallet`| GET | `/api/v1/billing/wallet` | Check balance, daily quota, & frozen status |
| `billing.pricing`| GET | `/api/v1/billing/pricing` | Endpoint price list & cost breakdown |
| `billing.ledger` | GET | `/api/v1/billing/ledger` | Transaction & credit ledger history |
| `billing.topup` | POST | `/api/v1/billing/topup` | Sandbox intent test or production NOT_CONFIGURED |
| `billing.webhook`| POST | `/api/v1/billing/webhook`| Idempotent payment webhook listener (Sandbox verified) |
| `abuse.reactivate`| POST| `/api/v1/account/reactivate`| Explicit reactivation for frozen free allowance |
| `docs.openapi` | GET | `/api/v1/openapi.json` | OpenAPI 3.1 machine-readable specification |
| `docs.ui` | GET | `/docs` | Interactive Scalar API Documentation |
