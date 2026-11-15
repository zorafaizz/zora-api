import express from 'express';
import cors from 'cors';
import path from 'path';
import axios from 'axios';
import { fileURLToPath } from 'url';

// Core & Middlewares
import { logger } from './src/core/logger.js';
import { closeDb, pool } from './src/core/db.js';
import { configuredEmailAuth } from './src/modules/email-auth/index.js';
import { closeRedis } from './src/core/redis.js';
import { getOrSetCache } from './src/core/cache.js';
import { getProviderHealthSnapshot } from './src/core/resilience.js';
import { requestIdMiddleware } from './src/middleware/request-id.js';
import { legacyCompatMiddleware } from './src/middleware/legacy-compat.js';
import { rateLimiterMiddleware } from './src/middleware/rate-limiter.js';
import { authMiddleware } from './src/middleware/auth.js';
import { quotaGuardMiddleware } from './src/middleware/quota-guard.js';

// Documentation & OpenAPI
import { generateOpenAPISpec, renderScalarHtml } from './src/modules/docs/openapi.js';

// Account, Keys & Billing Services
import { createOrFindAccount, reactivateFreeBenefit, getAccountById } from './src/modules/account/account.service.js';
import { createApiKey, listApiKeys, revokeApiKey } from './src/modules/api-keys/api-keys.service.js';
import { getWallet, getLedgerHistory } from './src/modules/billing/ledger.service.js';
import { createTopupInvoice, handlePaymentWebhook } from './src/modules/billing/billing.service.js';
import { ENDPOINT_REGISTRY } from './src/registry/endpoints.js';

// Existing Scrapers
import { scrapeAIO } from './scrapers/aio.js';
import { scrapeTikTok } from './scrapers/tiktok.js';
import { scrapeMediafire } from './scrapers/mediafire.js';
import { scrapeFacebook } from './scrapers/facebook.js';
import { scrapeYouTube } from './scrapers/youtube.js';
import { scrapeTwitter } from './scrapers/twitter.js';
import { scrapeInstagram } from './scrapers/instagram.js';
import { scrapeSpotify } from './scrapers/spotify.js';
import { scrapePinterest } from './scrapers/pinterest.js';
import { enhanceHD, enhanceUHD } from './scrapers/upscaler.js';
import { askAI } from './scrapers/ai.js';
import { getGempa, getGempaTerkini } from './scrapers/bmkg.js';
import { getJadwalSholat, getLyrics, shortenUrl, githubStalk, ipLookup } from './scrapers/tools.js';
import { findAlightMotionPreset } from './library/tools/alight_motion.js';
import { solveCloudflareWAF, solveTurnstileToken } from './library/solvers/cloudflare.js';

// New Audited Scrapers
import { searchSoundCloud } from './src/scrapers/soundcloud.js';
import { scrapeSfile } from './src/scrapers/sfile.js';
import { searchDevice } from './src/scrapers/gsmarena.js';
import { searchAnime } from './src/scrapers/anime.js';
import { createTempEmail, getTempInbox } from './src/scrapers/tempmail.js';
import { scrapePixeldrain } from './src/scrapers/pixeldrain.js';
import { searchManga } from './src/scrapers/manga.js';
import { searchWikipedia } from './src/scrapers/wikipedia.js';
import { searchPinterest } from './src/scrapers/pinterest-search.js';
import { searchAppleMusic } from './src/scrapers/applemusic.js';
import { searchSteam } from './src/scrapers/steam.js';
import { searchSticker } from './src/scrapers/sticker.js';
import { searchSoundboard } from './src/scrapers/soundboard.js';
import { stalkNpm } from './src/scrapers/npm-stalk.js';
import { translateText, dnsLookup, screenshotWeb } from './src/scrapers/network-tools.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3095;
const CREATOR = 'KanjutGede';

app.use('/api/v1/auth', configuredEmailAuth(pool).router);

app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

app.get('/explorer', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'explorer.html'));
});
app.get('/signin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'signin.html'));
});
app.get('/explorer.html', (req, res) => {
  res.redirect(308, '/explorer');
});
app.get('/signin.html', (req, res) => {
  res.redirect(308, '/signin');
});
app.use(express.static(path.join(__dirname, 'public')));

// 1. Injeksi Request ID & Legacy Envelope Wrapper
app.use(requestIdMiddleware);
app.use(legacyCompatMiddleware);

// 2. OpenAPI JSON Spec & Interactive Scalar Docs
app.get('/api/v1/openapi.json', (req, res) => {
  res.json(generateOpenAPISpec());
});
app.get(['/docs', '/api/v1/docs'], (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(renderScalarHtml('/api/v1/openapi.json'));
});

// 3. Health check & Server Stats (Public, No Rate Limit / No Quota)
app.get(['/health', '/api/v1/health'], (req, res) => {
  res.json({
    status: true,
    creator: CREATOR,
    uptime: `${Math.floor(process.uptime())}s`,
    node_version: process.version,
    memory: process.memoryUsage(),
    cluster: 'Asia/Jakarta',
    total_endpoints: ENDPOINT_REGISTRY.length,
    provider_health: getProviderHealthSnapshot()
  });
});

// 4. Rate Limiting via Redis Token Bucket
app.use(rateLimiterMiddleware());

// ==========================================
// BILLING WEBHOOK (Public with HMAC Signature)
// ==========================================
app.post('/api/v1/billing/webhook', async (req, res) => {
  try {
    const result = await handlePaymentWebhook(req.headers, req.body);
    res.json(result);
  } catch (err) {
    res.sendError(err, err.statusCode || 400);
  }
});

// ==========================================
// BACKWARD COMPATIBLE AUTH FALLBACK
// ==========================================
// Jika bot lama belum memasang header Authorization, gunakan fallback default account
app.use(async (req, res, next) => {
  const hasAuth = req.headers.authorization || req.headers['x-api-key'] || req.query?.apikey;
  if (!hasAuth && !req.path.startsWith('/api/v1/')) {
    try {
      const defaultBotAccount = await createOrFindAccount('bot-legacy@itsfaiz.my.id');
      req.account = defaultBotAccount;
      req.apiKey = { id: 'legacy-bot-key', keyType: 'live', scopes: ['*'] };
    } catch (_) {}
  }
  next();
});

// 5. Autentikasi API Key & Session Guard
app.use(authMiddleware);

// 6. Quota Enforcement & Credit Reservation Guard
app.use(quotaGuardMiddleware());

// ==========================================
// COMMERCIAL PLATFORM ROUTES (/api/v1/...)
// ==========================================

// Account info
app.get('/api/v1/account', async (req, res) => {
  try {
    const account = await getAccountById(req.account.id);
    const wallet = await getWallet(req.account.id);
    res.sendSuccess({ account, wallet });
  } catch (err) {
    res.sendError(err);
  }
});

// Explicit Reactivation of Frozen Free Benefit
app.post('/api/v1/account/reactivate', async (req, res) => {
  try {
    const reactivated = await reactivateFreeBenefit(req.account.id);
    res.sendSuccess(reactivated);
  } catch (err) {
    res.sendError(err);
  }
});

// API Key Management
app.get('/api/v1/keys', async (req, res) => {
  try {
    const keys = await listApiKeys(req.account.id);
    res.sendSuccess(keys);
  } catch (err) {
    res.sendError(err);
  }
});

app.post('/api/v1/keys', async (req, res) => {
  try {
    const { type, label, ip_allowlist, scopes } = req.body;
    const newKey = await createApiKey(
      req.account.id,
      type || 'live',
      label || 'Default Key',
      ip_allowlist || [],
      scopes || ['*']
    );
    res.sendSuccess(newKey);
  } catch (err) {
    res.sendError(err);
  }
});

app.delete('/api/v1/keys/:id', async (req, res) => {
  try {
    const revoked = await revokeApiKey(req.params.id, req.account.id);
    res.sendSuccess(revoked);
  } catch (err) {
    res.sendError(err);
  }
});

// Billing & Wallet
app.get('/api/v1/billing/wallet', async (req, res) => {
  try {
    const wallet = await getWallet(req.account.id);
    res.sendSuccess(wallet);
  } catch (err) {
    res.sendError(err);
  }
});

app.get('/api/v1/billing/pricing', (req, res) => {
  const pricingList = ENDPOINT_REGISTRY.map(ep => ({
    id: ep.id,
    category: ep.category,
    path: ep.path,
    billing_type: ep.billing_policy.type,
    credits: ep.billing_policy.default_credits,
    resource_class: ep.resource_class,
    title: ep.metadata.title
  }));
  res.sendSuccess(pricingList);
});

app.get('/api/v1/billing/ledger', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit || '50', 10);
    const offset = parseInt(req.query.offset || '0', 10);
    const history = await getLedgerHistory(req.account.id, limit, offset);
    res.sendSuccess(history);
  } catch (err) {
    res.sendError(err);
  }
});

app.post('/api/v1/billing/topup', async (req, res) => {
  try {
    const { amount_idr } = req.body;
    const invoice = await createTopupInvoice(req.account.id, amount_idr);
    res.sendSuccess(invoice);
  } catch (err) {
    res.sendError(err, err.statusCode || 400);
  }
});

// ==========================================
// 1. DOWNLOADER ENDPOINTS
// ==========================================

// AIO All-In-One Auto Detector
app.all(['/api/downloader/aio', '/api/downloader/aiov2', '/api/v1/downloader/aio'], async (req, res) => {
  try {
    const url = req.query.url || req.body?.url;
    const data = await scrapeAIO(url);
    res.sendSuccess(data);
  } catch (err) {
    res.sendError(err);
  }
});

// TikTok (Dual Engine: TikWM + yt-dlp)
app.all(['/api/downloader/tiktok', '/api/downloader/tt', '/api/v1/downloader/tiktok'], async (req, res) => {
  try {
    const url = req.query.url || req.body?.url;
    const data = await getOrSetCache(`tiktok:${url}`, 600, () => scrapeTikTok(url));
    res.sendSuccess(data);
  } catch (err) {
    res.sendError(err);
  }
});

// YouTube (Dual Engine: Savetube VIP CDN Decryption + yt-dlp)
app.all(['/api/downloader/youtube', '/api/downloader/yt', '/api/downloader/ytmp4', '/api/downloader/ytmp3', '/api/v1/downloader/youtube'], async (req, res) => {
  try {
    const url = req.query.url || req.body?.url;
    const data = await getOrSetCache(`youtube:${url}`, 900, () => scrapeYouTube(url));
    res.sendSuccess(data);
  } catch (err) {
    res.sendError(err);
  }
});

// Instagram (Dual Engine: ReelsVideo + yt-dlp)
app.all(['/api/downloader/instagram', '/api/downloader/ig', '/api/downloader/reelsvideo', '/api/v1/downloader/instagram'], async (req, res) => {
  try {
    const url = req.query.url || req.body?.url;
    const data = await getOrSetCache(`instagram:${url}`, 900, () => scrapeInstagram(url));
    res.sendSuccess(data);
  } catch (err) {
    res.sendError(err);
  }
});

// Facebook (Dual Engine: FDown + yt-dlp)
app.all(['/api/downloader/facebook', '/api/downloader/fb', '/api/v1/downloader/facebook'], async (req, res) => {
  try {
    const url = req.query.url || req.body?.url;
    const data = await getOrSetCache(`facebook:${url}`, 900, () => scrapeFacebook(url));
    res.sendSuccess(data);
  } catch (err) {
    res.sendError(err);
  }
});

// Twitter / X (Dual Engine: X2Twitter + yt-dlp)
app.all(['/api/downloader/twitter', '/api/downloader/x', '/api/v1/downloader/twitter'], async (req, res) => {
  try {
    const url = req.query.url || req.body?.url;
    const data = await getOrSetCache(`twitter:${url}`, 900, () => scrapeTwitter(url));
    res.sendSuccess(data);
  } catch (err) {
    res.sendError(err);
  }
});

// Spotify & Music Downloader (oEmbed + iTunes + yt-dlp)
app.all(['/api/downloader/spotify', '/api/downloader/spotidownloader', '/api/v1/downloader/spotify'], async (req, res) => {
  try {
    const queryParam = req.query.url || req.query.q || req.body?.url || req.body?.q;
    const data = await getOrSetCache(`spotify:${queryParam}`, 3600, () => scrapeSpotify(queryParam));
    res.sendSuccess(data);
  } catch (err) {
    res.sendError(err);
  }
});

// SoundCloud Downloader (NEW)
app.all(['/api/downloader/soundcloud', '/api/v1/downloader/soundcloud'], async (req, res) => {
  try {
    const queryParam = req.query.q || req.query.url || req.body?.q || req.body?.url;
    const data = await getOrSetCache(`soundcloud:${queryParam}`, 3600, () => searchSoundCloud(queryParam));
    res.sendSuccess(data);
  } catch (err) {
    res.sendError(err);
  }
});

// Sfile.mobi Direct Downloader (NEW)
app.all(['/api/downloader/sfile', '/api/v1/downloader/sfile'], async (req, res) => {
  try {
    const url = req.query.url || req.body?.url;
    const data = await scrapeSfile(url);
    res.sendSuccess(data);
  } catch (err) {
    res.sendError(err);
  }
});

// Pinterest Downloader
app.all(['/api/downloader/pinterest', '/api/downloader/pin', '/api/v1/downloader/pinterest'], async (req, res) => {
  try {
    const url = req.query.url || req.body?.url;
    const data = await getOrSetCache(`pinterest:${url}`, 1800, () => scrapePinterest(url));
    res.sendSuccess(data);
  } catch (err) {
    res.sendError(err);
  }
});

// MediaFire Direct Downloader
app.all(['/api/downloader/mediafire', '/api/v1/downloader/mediafire'], async (req, res) => {
  try {
    const url = req.query.url || req.body?.url;
    const data = await getOrSetCache(`mediafire:${url}`, 900, () => scrapeMediafire(url));
    res.sendSuccess(data);
  } catch (err) {
    res.sendError(err);
  }
});

// Pixeldrain Direct Downloader (NEW)
app.all(['/api/downloader/pixeldrain', '/api/v1/downloader/pixeldrain'], async (req, res) => {
  try {
    const url = req.query.url || req.body?.url;
    const data = await getOrSetCache(`pixeldrain:${url}`, 900, () => scrapePixeldrain(url));
    res.sendSuccess(data);
  } catch (err) {
    res.sendError(err);
  }
});

// ==========================================
// 2. ARTIFICIAL INTELLIGENCE (AI)
// ==========================================

// AI Chat (Multi-Model: OpenAI -> Mistral -> Qwen)
app.all(['/api/ai/chat', '/api/ai/aichat', '/api/ai/chatai', '/api/ai/chatcompletion', '/api/v1/ai/chat'], async (req, res) => {
  try {
    const prompt = req.query.prompt || req.body?.prompt;
    const system = req.query.system || req.body?.system || undefined;
    const model = req.query.model || req.body?.model || 'openai';
    const data = await askAI(prompt, system, model);
    res.sendSuccess(data);
  } catch (err) {
    res.sendError(err);
  }
});

// ==========================================
// 3. TOOLS, ENHANCER & SCRAPERS
// ==========================================

// GSMArena Phone Specs (NEW)
app.all(['/api/search/gsmarena', '/api/v1/search/gsmarena'], async (req, res) => {
  try {
    const queryParam = req.query.q || req.body?.q;
    const data = await getOrSetCache(`gsmarena:${queryParam}`, 604800, () => searchDevice(queryParam));
    res.sendSuccess(data);
  } catch (err) {
    res.sendError(err);
  }
});

// Kusonime Anime Search (NEW)
app.all(['/api/search/anime', '/api/v1/search/anime'], async (req, res) => {
  try {
    const queryParam = req.query.q || req.body?.q;
    const data = await getOrSetCache(`anime:${queryParam}`, 86400, () => searchAnime(queryParam));
    res.sendSuccess(data);
  } catch (err) {
    res.sendError(err);
  }
});

// Disposable TempMail (NEW)
app.get(['/api/tools/tempmail', '/api/v1/tools/tempmail'], async (req, res) => {
  try {
    const data = await createTempEmail();
    res.sendSuccess(data);
  } catch (err) {
    res.sendError(err);
  }
});

app.get(['/api/tools/tempmail/inbox', '/api/v1/tools/tempmail/inbox'], async (req, res) => {
  try {
    const email = req.query.email;
    const data = await getTempInbox(email);
    res.sendSuccess(data);
  } catch (err) {
    res.sendError(err);
  }
});

// Image Enhancer HD (Sharp CLAHE)
app.all(['/api/tools/hd', '/api/v1/tools/hd'], async (req, res) => {
  try {
    const url = req.query.url || req.body?.url;
    const data = await getOrSetCache(`hd:${url}`, 86400, () => enhanceHD(url));
    res.sendSuccess(data);
  } catch (err) {
    res.sendError(err);
  }
});

// Image Enhancer Ultra HD (Sharp Lanczos3)
app.all(['/api/tools/uhd', '/api/v1/tools/uhd'], async (req, res) => {
  try {
    const url = req.query.url || req.body?.url;
    const scale = req.query.scale || req.body?.scale || 2;
    const data = await getOrSetCache(`uhd:${scale}:${url}`, 86400, () => enhanceUHD(url, scale));
    res.sendSuccess(data);
  } catch (err) {
    res.sendError(err);
  }
});

// BMKG Gempa Terkini & Auto
app.get(['/api/tools/gempa', '/api/search/bmkg', '/api/v1/tools/gempa'], async (req, res) => {
  try {
    const data = await getOrSetCache('bmkg:autogempa', 300, () => getGempa());
    res.sendSuccess(data);
  } catch (err) {
    res.sendError(err);
  }
});

app.get(['/api/tools/gempa/terkini', '/api/v1/tools/gempa/terkini'], async (req, res) => {
  try {
    const data = await getOrSetCache('bmkg:terkini', 300, () => getGempaTerkini());
    res.sendSuccess(data);
  } catch (err) {
    res.sendError(err);
  }
});

// Jadwal Sholat Kemenag
app.all(['/api/tools/jadwalsholat', '/api/search/jadwalsholat', '/api/v1/tools/jadwalsholat'], async (req, res) => {
  try {
    const kota = req.query.kota || req.body?.kota || 'jakarta';
    const data = await getOrSetCache(`sholat:${kota}`, 86400, () => getJadwalSholat(kota));
    res.sendSuccess(data);
  } catch (err) {
    res.sendError(err);
  }
});

// Lirik Lagu
app.all(['/api/tools/lirik', '/api/search/lirik', '/api/v1/search/lirik'], async (req, res) => {
  try {
    const artist = req.query.artist || req.body?.artist;
    const title = req.query.title || req.body?.title;
    const data = await getOrSetCache(`lirik:${artist}:${title}`, 604800, () => getLyrics(artist, title));
    res.sendSuccess(data);
  } catch (err) {
    res.sendError(err);
  }
});

// Shortlink
app.all(['/api/tools/shortlink', '/api/v1/tools/shortlink'], async (req, res) => {
  try {
    const url = req.query.url || req.body?.url;
    const data = await shortenUrl(url);
    res.sendSuccess(data);
  } catch (err) {
    res.sendError(err);
  }
});

// GitHub Stalk
app.all(['/api/tools/github', '/api/stalker/stalkgithub', '/api/v1/stalker/github'], async (req, res) => {
  try {
    const username = req.query.username || req.body?.username;
    const data = await getOrSetCache(`github:${username}`, 3600, () => githubStalk(username));
    res.sendSuccess(data);
  } catch (err) {
    res.sendError(err);
  }
});

// IP Lookup
app.all(['/api/tools/iplookup', '/api/v1/tools/iplookup'], async (req, res) => {
  try {
    const ip = req.query.ip || req.body?.ip || req.ip;
    const data = await getOrSetCache(`iplookup:${ip}`, 86400, () => ipLookup(ip));
    res.sendSuccess(data);
  } catch (err) {
    res.sendError(err);
  }
});

// Alight Motion Preset Finder
app.all(['/api/tools/presetam', '/api/tools/findpresetam', '/api/v1/tools/presetam'], async (req, res) => {
  try {
    const url = req.query.url || req.body?.url;
    const data = await getOrSetCache(`presetam:${url}`, 3600, () => findAlightMotionPreset(url));
    res.sendSuccess(data);
  } catch (err) {
    res.sendError(err);
  }
});

// Manga, Manhwa & Light Novel Search (NEW)
app.all(['/api/search/manga', '/api/v1/search/manga'], async (req, res) => {
  try {
    const q = req.query.q || req.body?.q;
    const data = await getOrSetCache(`manga:${q}`, 86400, () => searchManga(q));
    res.sendSuccess(data);
  } catch (err) {
    res.sendError(err);
  }
});

// Wikipedia Encyclopedia Summary (NEW)
app.all(['/api/search/wikipedia', '/api/v1/search/wikipedia'], async (req, res) => {
  try {
    const q = req.query.q || req.body?.q;
    const lang = req.query.lang || req.body?.lang || 'id';
    const data = await getOrSetCache(`wikipedia:${lang}:${q}`, 86400, () => searchWikipedia(q, lang));
    res.sendSuccess(data);
  } catch (err) {
    res.sendError(err);
  }
});

// Pinterest Visual Pin Search (NEW)
app.all(['/api/search/pinterest', '/api/v1/search/pinterest'], async (req, res) => {
  try {
    const q = req.query.q || req.body?.q;
    const data = await getOrSetCache(`pinterest_search:${q}`, 3600, () => searchPinterest(q));
    res.sendSuccess(data);
  } catch (err) {
    res.sendError(err);
  }
});

// Apple Music & iTunes Track Search (NEW)
app.all(['/api/search/applemusic', '/api/v1/search/applemusic'], async (req, res) => {
  try {
    const q = req.query.q || req.body?.q;
    const data = await getOrSetCache(`applemusic:${q}`, 3600, () => searchAppleMusic(q));
    res.sendSuccess(data);
  } catch (err) {
    res.sendError(err);
  }
});

// Steam Store Game & Price Search (NEW)
app.all(['/api/search/steam', '/api/v1/search/steam'], async (req, res) => {
  try {
    const q = req.query.q || req.body?.q;
    const data = await getOrSetCache(`steam:${q}`, 3600, () => searchSteam(q));
    res.sendSuccess(data);
  } catch (err) {
    res.sendError(err);
  }
});

// Sticker Pack Search (NEW)
app.all(['/api/search/sticker', '/api/v1/search/sticker'], async (req, res) => {
  try {
    const q = req.query.q || req.body?.q;
    const data = await getOrSetCache(`sticker:${q}`, 3600, () => searchSticker(q));
    res.sendSuccess(data);
  } catch (err) {
    res.sendError(err);
  }
});

// Meme Soundboard & SFX Search (NEW)
app.all(['/api/search/soundboard', '/api/v1/search/soundboard'], async (req, res) => {
  try {
    const q = req.query.q || req.body?.q;
    const data = await getOrSetCache(`soundboard:${q}`, 86400, () => searchSoundboard(q));
    res.sendSuccess(data);
  } catch (err) {
    res.sendError(err);
  }
});

// NPM Package Stalker & Stats (NEW)
app.all(['/api/stalker/npm', '/api/tools/npm', '/api/v1/stalker/npm'], async (req, res) => {
  try {
    const pkg = req.query.pkg || req.query.name || req.body?.pkg || req.body?.name;
    const data = await getOrSetCache(`npm:${pkg}`, 3600, () => stalkNpm(pkg));
    res.sendSuccess(data);
  } catch (err) {
    res.sendError(err);
  }
});

// Multi-Engine Translator (NEW)
app.all(['/api/tools/translate', '/api/v1/tools/translate'], async (req, res) => {
  try {
    const text = req.query.text || req.query.q || req.body?.text || req.body?.q;
    const to = req.query.to || req.body?.to || 'id';
    const from = req.query.from || req.body?.from || 'auto';
    const data = await getOrSetCache(`translate:${from}:${to}:${text}`, 86400, () =>
      translateText(text, to, from)
    );
    res.sendSuccess(data);
  } catch (err) {
    res.sendError(err);
  }
});

// DNS over HTTPS (DoH) Lookup (NEW)
app.all(['/api/tools/dns', '/api/v1/tools/dns'], async (req, res) => {
  try {
    const domain = req.query.domain || req.body?.domain;
    const type = req.query.type || req.body?.type || 'A';
    const data = await getOrSetCache(`dns:${type}:${domain}`, 600, () => dnsLookup(domain, type));
    res.sendSuccess(data);
  } catch (err) {
    res.sendError(err);
  }
});

// Web Screenshot Capture (SSRF-Protected) (NEW)
app.all(['/api/tools/ssweb', '/api/v1/tools/ssweb'], async (req, res) => {
  try {
    const url = req.query.url || req.body?.url;
    const data = await getOrSetCache(`ssweb:${url}`, 1800, () => screenshotWeb(url));
    res.sendSuccess(data);
  } catch (err) {
    res.sendError(err);
  }
});

// Cloudflare WAF Solver
app.all(['/api/solver/waf', '/api/v1/solver/waf'], async (req, res) => {
  try {
    const targetUrl = req.query.url || req.body?.url;
    const data = await solveCloudflareWAF(targetUrl);
    res.sendSuccess(data);
  } catch (err) {
    res.sendError(err);
  }
});

// Cloudflare Turnstile Token Solver
app.all(['/api/solver/turnstile', '/api/v1/solver/turnstile'], async (req, res) => {
  try {
    const targetUrl = req.query.url || req.body?.url;
    const sitekey = req.query.sitekey || req.body?.sitekey;
    const data = await solveTurnstileToken(targetUrl, sitekey);
    res.sendSuccess(data);
  } catch (err) {
    res.sendError(err);
  }
});

// Native FlareSolverr Bridge
app.all(['/v1', '/api/solver/flaresolverr'], async (req, res) => {
  try {
    const payload = req.method === 'GET' ? req.query : req.body;
    const response = await axios.post('http://127.0.0.1:8191/v1', payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 60000
    });
    return res.json(response.data);
  } catch (err) {
    return res.status(500).json({
      status: 'error',
      message: err.response?.data?.message || err.message
    });
  }
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    status: false,
    creator: CREATOR,
    error: `Endpoint ${req.method} ${req.url} tidak ditemukan.`
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  logger.error({ error: err.message, stack: err.stack, path: req.path }, '[SERVER] Unhandled error');
  res.sendError(err, err.statusCode || 500);
});

export { app };

if (process.env.NODE_ENV !== 'test') {
  const server = app.listen(PORT, '0.0.0.0', () => {
    logger.info({ port: PORT, base: `http://127.0.0.1:${PORT}` }, `[KANJUTGEDE-API] Server berjalan di port ${PORT}`);
  });

  const gracefulShutdown = async (signal) => {
    logger.info({ signal }, '[SERVER] Received shutdown signal. Closing server & connections gracefully...');
    server.close(async () => {
      await closeDb().catch(() => {});
      await closeRedis().catch(() => {});
      logger.info('[SERVER] Clean shutdown completed. Exiting.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}
