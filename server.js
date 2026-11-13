import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3095;
const CREATOR = 'Zora';

app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Middleware tracking waktu respons
app.use((req, res, next) => {
  req._startTime = Date.now();
  next();
});

// Helper response wrapper (kompatibel penuh dengan Jere API & Neoxr bot parser)
const sendSuccess = (req, res, result) => {
  const latency = `${Date.now() - (req._startTime || Date.now())}ms`;
  return res.json({
    status: true,
    creator: CREATOR,
    latency,
    result,
    data: result // Fallback alias untuk bot yang membaca json.data
  });
};

const sendError = (req, res, error, code = 400) => {
  const latency = `${Date.now() - (req._startTime || Date.now())}ms`;
  return res.status(code).json({
    status: false,
    creator: CREATOR,
    latency,
    error: error.message || error,
    message: error.message || error
  });
};

// Health check & Server Stats
app.get('/health', (req, res) => {
  res.json({
    status: true,
    creator: CREATOR,
    uptime: `${Math.floor(process.uptime())}s`,
    node_version: process.version,
    memory: process.memoryUsage()
  });
});

// ==========================================
// 1. DOWNLOADER ENDPOINTS
// ==========================================

// AIO All-In-One Auto Detector
app.all(['/api/downloader/aio', '/api/downloader/aiov2'], async (req, res) => {
  try {
    const url = req.query.url || req.body?.url;
    const data = await scrapeAIO(url);
    sendSuccess(req, res, data);
  } catch (err) {
    sendError(req, res, err);
  }
});

// TikTok (Dual Engine: TikWM + yt-dlp)
app.all(['/api/downloader/tiktok', '/api/downloader/tt'], async (req, res) => {
  try {
    const url = req.query.url || req.body?.url;
    const data = await scrapeTikTok(url);
    sendSuccess(req, res, data);
  } catch (err) {
    sendError(req, res, err);
  }
});

// YouTube (Dual Engine: Savetube VIP CDN Decryption + yt-dlp)
app.all(['/api/downloader/youtube', '/api/downloader/yt', '/api/downloader/ytmp4', '/api/downloader/ytmp3'], async (req, res) => {
  try {
    const url = req.query.url || req.body?.url;
    const data = await scrapeYouTube(url);
    sendSuccess(req, res, data);
  } catch (err) {
    sendError(req, res, err);
  }
});

// Instagram (Dual Engine: ReelsVideo + yt-dlp)
app.all(['/api/downloader/instagram', '/api/downloader/ig', '/api/downloader/reelsvideo'], async (req, res) => {
  try {
    const url = req.query.url || req.body?.url;
    const data = await scrapeInstagram(url);
    sendSuccess(req, res, data);
  } catch (err) {
    sendError(req, res, err);
  }
});

// Facebook (Dual Engine: FDown + yt-dlp)
app.all(['/api/downloader/facebook', '/api/downloader/fb'], async (req, res) => {
  try {
    const url = req.query.url || req.body?.url;
    const data = await scrapeFacebook(url);
    sendSuccess(req, res, data);
  } catch (err) {
    sendError(req, res, err);
  }
});

// Twitter / X (Dual Engine: X2Twitter + yt-dlp)
app.all(['/api/downloader/twitter', '/api/downloader/x'], async (req, res) => {
  try {
    const url = req.query.url || req.body?.url;
    const data = await scrapeTwitter(url);
    sendSuccess(req, res, data);
  } catch (err) {
    sendError(req, res, err);
  }
});

// Spotify & Music Downloader (oEmbed + iTunes + yt-dlp)
app.all(['/api/downloader/spotify', '/api/downloader/spotidownloader'], async (req, res) => {
  try {
    const query = req.query.url || req.query.q || req.body?.url || req.body?.q;
    const data = await scrapeSpotify(query);
    sendSuccess(req, res, data);
  } catch (err) {
    sendError(req, res, err);
  }
});

// Pinterest Downloader
app.all(['/api/downloader/pinterest', '/api/downloader/pin'], async (req, res) => {
  try {
    const url = req.query.url || req.body?.url;
    const data = await scrapePinterest(url);
    sendSuccess(req, res, data);
  } catch (err) {
    sendError(req, res, err);
  }
});

// MediaFire Direct Downloader
app.all('/api/downloader/mediafire', async (req, res) => {
  try {
    const url = req.query.url || req.body?.url;
    const data = await scrapeMediafire(url);
    sendSuccess(req, res, data);
  } catch (err) {
    sendError(req, res, err);
  }
});

// ==========================================
// 2. ARTIFICIAL INTELLIGENCE (AI)
// ==========================================

// AI Chat (Multi-Model: OpenAI -> Mistral -> Qwen)
app.all(['/api/ai/chat', '/api/ai/aichat', '/api/ai/chatai', '/api/ai/chatcompletion'], async (req, res) => {
  try {
    const prompt = req.query.prompt || req.body?.prompt;
    const system = req.query.system || req.body?.system || undefined;
    const model = req.query.model || req.body?.model || 'openai';
    const data = await askAI(prompt, system, model);
    sendSuccess(req, res, data);
  } catch (err) {
    sendError(req, res, err);
  }
});

// ==========================================
// 3. TOOLS, ENHANCER & SCRAPERS
// ==========================================

// Image Enhancer HD (Remini / CLAHE)
app.all('/api/tools/hd', async (req, res) => {
  try {
    const url = req.query.url || req.body?.url;
    const data = await enhanceHD(url);
    sendSuccess(req, res, data);
  } catch (err) {
    sendError(req, res, err);
  }
});

// Image Enhancer Ultra HD (2x/4x Super-Resolution)
app.all('/api/tools/uhd', async (req, res) => {
  try {
    const url = req.query.url || req.body?.url;
    const scale = req.query.scale || req.body?.scale || 2;
    const data = await enhanceUHD(url, scale);
    sendSuccess(req, res, data);
  } catch (err) {
    sendError(req, res, err);
  }
});

// BMKG Gempa Terkini & Auto
app.get(['/api/tools/gempa', '/api/search/bmkg'], async (req, res) => {
  try {
    const data = await getGempa();
    sendSuccess(req, res, data);
  } catch (err) {
    sendError(req, res, err);
  }
});

app.get('/api/tools/gempa/terkini', async (req, res) => {
  try {
    const data = await getGempaTerkini();
    sendSuccess(req, res, data);
  } catch (err) {
    sendError(req, res, err);
  }
});

// Jadwal Sholat Kemenag
app.all(['/api/tools/jadwalsholat', '/api/search/jadwalsholat'], async (req, res) => {
  try {
    const kota = req.query.kota || req.body?.kota || 'jakarta';
    const data = await getJadwalSholat(kota);
    sendSuccess(req, res, data);
  } catch (err) {
    sendError(req, res, err);
  }
});

// Lirik Lagu
app.all(['/api/tools/lirik', '/api/search/lirik'], async (req, res) => {
  try {
    const artist = req.query.artist || req.body?.artist;
    const title = req.query.title || req.body?.title;
    const data = await getLyrics(artist, title);
    sendSuccess(req, res, data);
  } catch (err) {
    sendError(req, res, err);
  }
});

// Shortlink
app.all('/api/tools/shortlink', async (req, res) => {
  try {
    const url = req.query.url || req.body?.url;
    const data = await shortenUrl(url);
    sendSuccess(req, res, data);
  } catch (err) {
    sendError(req, res, err);
  }
});

// GitHub Stalk
app.all(['/api/tools/github', '/api/stalker/stalkgithub'], async (req, res) => {
  try {
    const username = req.query.username || req.body?.username;
    const data = await githubStalk(username);
    sendSuccess(req, res, data);
  } catch (err) {
    sendError(req, res, err);
  }
});

// IP Lookup
app.all('/api/tools/iplookup', async (req, res) => {
  try {
    const ip = req.query.ip || req.body?.ip || req.ip;
    const data = await ipLookup(ip);
    sendSuccess(req, res, data);
  } catch (err) {
    sendError(req, res, err);
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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[ZORA-API] Server berjalan di port ${PORT} (http://127.0.0.1:${PORT})`);
});
