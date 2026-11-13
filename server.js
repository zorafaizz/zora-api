import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

import { scrapeTikTok } from './scrapers/tiktok.js';
import { scrapeMediafire } from './scrapers/mediafire.js';
import { scrapeFacebook } from './scrapers/facebook.js';
import { scrapeYouTube } from './scrapers/youtube.js';
import { askAI } from './scrapers/ai.js';
import { getGempa, getGempaTerkini } from './scrapers/bmkg.js';
import { getJadwalSholat, githubStalk, ipLookup } from './scrapers/tools.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3095;
const CREATOR = 'Zora';

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Helper response wrapper
const sendSuccess = (res, result) => res.json({ status: true, creator: CREATOR, result });
const sendError = (res, error, code = 400) => res.status(code).json({ status: false, creator: CREATOR, error: error.message || error });

// Health check
app.get('/health', (req, res) => {
  res.json({ status: true, creator: CREATOR, uptime: `${Math.floor(process.uptime())}s`, memory: process.memoryUsage() });
});

// --- DOWNLOADER ENDPOINTS ---
app.all('/api/downloader/tiktok', async (req, res) => {
  try {
    const url = req.query.url || req.body?.url;
    const data = await scrapeTikTok(url);
    sendSuccess(res, data);
  } catch (err) {
    sendError(res, err);
  }
});

app.all('/api/downloader/mediafire', async (req, res) => {
  try {
    const url = req.query.url || req.body?.url;
    const data = await scrapeMediafire(url);
    sendSuccess(res, data);
  } catch (err) {
    sendError(res, err);
  }
});

app.all('/api/downloader/facebook', async (req, res) => {
  try {
    const url = req.query.url || req.body?.url;
    const data = await scrapeFacebook(url);
    sendSuccess(res, data);
  } catch (err) {
    sendError(res, err);
  }
});

app.all('/api/downloader/youtube', async (req, res) => {
  try {
    const url = req.query.url || req.body?.url;
    const data = await scrapeYouTube(url);
    sendSuccess(res, data);
  } catch (err) {
    sendError(res, err);
  }
});

// --- AI ENDPOINTS ---
app.all('/api/ai/chat', async (req, res) => {
  try {
    const prompt = req.query.prompt || req.body?.prompt;
    const system = req.query.system || req.body?.system || undefined;
    const data = await askAI(prompt, system);
    sendSuccess(res, data);
  } catch (err) {
    sendError(res, err);
  }
});

// --- TOOLS & SCRAPERS ---
app.get('/api/tools/gempa', async (req, res) => {
  try {
    const data = await getGempa();
    sendSuccess(res, data);
  } catch (err) {
    sendError(res, err);
  }
});

app.get('/api/tools/gempa/terkini', async (req, res) => {
  try {
    const data = await getGempaTerkini();
    sendSuccess(res, data);
  } catch (err) {
    sendError(res, err);
  }
});

app.all('/api/tools/jadwalsholat', async (req, res) => {
  try {
    const kota = req.query.kota || req.body.kota || 'jakarta';
    const data = await getJadwalSholat(kota);
    sendSuccess(res, data);
  } catch (err) {
    sendError(res, err);
  }
});

app.all('/api/tools/github', async (req, res) => {
  try {
    const username = req.query.username || req.body.username;
    const data = await githubStalk(username);
    sendSuccess(res, data);
  } catch (err) {
    sendError(res, err);
  }
});

app.all('/api/tools/iplookup', async (req, res) => {
  try {
    const ip = req.query.ip || req.body.ip || req.ip;
    const data = await ipLookup(ip);
    sendSuccess(res, data);
  } catch (err) {
    sendError(res, err);
  }
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ status: false, creator: CREATOR, error: `Endpoint ${req.method} ${req.url} tidak ditemukan.` });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[ZORA-API] Server berjalan di port ${PORT} (http://127.0.0.1:${PORT})`);
});
