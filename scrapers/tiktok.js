import axios from 'axios';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { executeMultiProvider } from '../src/core/resilience.js';
import { ValidationError } from '../src/core/errors.js';
import { validateSSRF } from '../src/core/security.js';

const execFileAsync = promisify(execFile);

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

// Provider 1 (Tier 1): ttdl.zone.id JSON API (Benchmarked 215ms p50)
async function providerTtdlZone(url, { signal, timeoutMs }) {
  const res = await axios.get('https://ttdl.zone.id/api/tiktok', {
    params: { url: url.trim() },
    headers: {
      'User-Agent': BROWSER_UA,
      Accept: 'application/json'
    },
    timeout: timeoutMs,
    signal
  });

  const payload = res.data;
  const d = payload?.data;
  if (!payload?.success || !d) {
    throw new Error(payload?.message || 'ttdl.zone.id gagal mengekstrak media TikTok');
  }

  const images = Array.isArray(d.images) ? d.images : [];
  const isSlide = images.length > 0;
  const videoUrl = !isSlide
    ? d.video?.download_nowm || d.video?.stream || d.video?.download_wm || null
    : null;

  if (!isSlide && !videoUrl) {
    throw new Error('ttdl.zone.id tidak mengembalikan stream video');
  }

  return {
    engine: 'ttdl.zone.id (Tier-1)',
    type: isSlide ? 'slide' : 'video',
    title: d.title || d.description || '',
    author: {
      nickname: d.author?.nickname || d.author?.name || '',
      username: d.author?.unique_id || d.author?.username || '',
      avatar: d.author?.avatar || ''
    },
    stats: {
      views: d.stats?.views ?? d.stats?.play_count ?? 0,
      likes: d.stats?.likes ?? d.stats?.digg_count ?? 0,
      comments: d.stats?.comments ?? d.stats?.comment_count ?? 0,
      shares: d.stats?.shares ?? d.stats?.share_count ?? 0
    },
    duration: d.duration || d.video?.duration || 0,
    video: videoUrl,
    audio: d.music?.download || d.music?.play_url || null,
    images
  };
}

// Provider 2 (Tier 1): TikWM API (Fast, HD, Multi-slide — Benchmarked 830ms p50)
async function providerTikWM(url, { signal, timeoutMs }) {
  const res = await axios.post(
    'https://www.tikwm.com/api/',
    new URLSearchParams({ url: url.trim(), count: 12, cursor: 0, web: 1, hd: 1 }),
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'User-Agent': BROWSER_UA,
        Accept: 'application/json, text/javascript, */*; q=0.01'
      },
      timeout: timeoutMs,
      signal
    }
  );

  const json = res.data;
  if (json?.code !== 0 || !json?.data) {
    throw new Error(json?.msg || 'TikWM gagal mengekstrak data');
  }

  const d = json.data;
  const isSlide = Array.isArray(d.images) && d.images.length > 0;
  const videoUrl = !isSlide ? d.hdplay || d.play || d.wmplay || null : null;

  return {
    engine: 'TikWM (Tier-1)',
    type: isSlide ? 'slide' : 'video',
    title: d.title || '',
    author: {
      nickname: d.author?.nickname || '',
      username: d.author?.unique_id || '',
      avatar: d.author?.avatar || ''
    },
    stats: {
      views: d.play_count || 0,
      likes: d.digg_count || 0,
      comments: d.comment_count || 0,
      shares: d.share_count || 0
    },
    duration: d.duration || 0,
    video: videoUrl,
    audio: d.music || d.music_info?.play_url || null,
    images: isSlide ? d.images : []
  };
}

// Provider 3 (Tier 2): LoveTik AJAX Resolver
async function providerLoveTik(url, { signal, timeoutMs }) {
  const res = await axios.post(
    'https://lovetik.com/api/ajax/search',
    new URLSearchParams({ query: url.trim() }),
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        Origin: 'https://lovetik.com',
        Referer: 'https://lovetik.com/',
        'User-Agent': BROWSER_UA
      },
      timeout: timeoutMs,
      signal
    }
  );

  const d = res.data;
  if (!d || d.status !== 'ok') {
    throw new Error(d?.mess || 'LoveTik gagal memproses URL');
  }

  const links = Array.isArray(d.links) ? d.links : [];
  const noWm = links.find((l) => /no\s*watermark|hd/i.test(l.t || l.type || '')) || links[0];
  const mp3 = links.find((l) => /mp3|audio/i.test(l.t || l.type || ''));
  const images = Array.isArray(d.images) ? d.images : [];
  const isSlide = images.length > 0;

  if (!isSlide && !noWm?.a) {
    throw new Error('LoveTik tidak menemukan link unduhan');
  }

  return {
    engine: 'LoveTik (Tier-2)',
    type: isSlide ? 'slide' : 'video',
    title: d.desc || '',
    author: {
      nickname: d.author_name || '',
      username: (d.author || '').replace(/^@/, ''),
      avatar: d.author_a || ''
    },
    stats: { views: 0, likes: 0, comments: 0, shares: 0 },
    duration: 0,
    video: !isSlide ? noWm.a : null,
    audio: mp3?.a || null,
    images
  };
}

// Provider 4 (Tier 3): yt-dlp Subprocess Backup (Existing fallback retained)
async function providerYtDlp(url, { timeoutMs }) {
  const { stdout } = await execFileAsync(
    'yt-dlp',
    ['-j', '--no-warnings', '--no-playlist', url.trim()],
    { timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024 }
  );

  const lines = stdout.trim().split('\n');
  let json = null;
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      json = JSON.parse(lines[i]);
      break;
    } catch {}
  }

  if (!json) throw new Error('yt-dlp gagal mem-parsing JSON TikTok');

  return {
    engine: 'yt-dlp (Tier-3 Backup)',
    type: 'video',
    title: json.title || '',
    author: {
      nickname: json.uploader || '',
      username: json.uploader_id || '',
      avatar: ''
    },
    stats: {
      views: json.view_count || 0,
      likes: json.like_count || 0,
      comments: json.comment_count || 0,
      shares: 0
    },
    duration: json.duration || 0,
    video: json.url || null,
    audio: null,
    images: []
  };
}

export async function scrapeTikTok(url) {
  if (!url || typeof url !== 'string' || !url.trim()) {
    throw new ValidationError('Parameter URL wajib diisi');
  }

  const safeUrl = await validateSSRF(url.trim());

  const { data } = await executeMultiProvider(
    'dl.tiktok',
    [
      {
        id: 'tiktok_ttdl_zone',
        failureDomain: 'ttdl.zone.id',
        tier: 1,
        timeoutMs: 8500,
        allowTransientRetry: true,
        fn: (ctx) => providerTtdlZone(safeUrl, ctx)
      },
      {
        id: 'tiktok_tikwm',
        failureDomain: 'tikwm.com',
        tier: 1,
        timeoutMs: 10000,
        allowTransientRetry: true,
        fn: (ctx) => providerTikWM(safeUrl, ctx)
      },
      {
        id: 'tiktok_lovetik',
        failureDomain: 'lovetik.com',
        tier: 2,
        timeoutMs: 9000,
        fn: (ctx) => providerLoveTik(safeUrl, ctx)
      },
      {
        id: 'tiktok_ytdlp',
        failureDomain: 'local-ytdlp-tiktok',
        tier: 3,
        timeoutMs: 16000,
        fn: (ctx) => providerYtDlp(safeUrl, ctx)
      }
    ],
    {
      totalDeadlineMs: 25000,
      retryBudget: 1,
      validateResult: (r) => Boolean(r && (r.video || (Array.isArray(r.images) && r.images.length > 0)))
    }
  );

  return data;
}
