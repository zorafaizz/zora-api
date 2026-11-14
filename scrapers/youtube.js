import axios from 'axios';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { executeMultiProvider } from '../src/core/resilience.js';
import { ValidationError } from '../src/core/errors.js';
import { validateSSRF } from '../src/core/security.js';

const execFileAsync = promisify(execFile);

const SAVETUBE_HEADERS = {
  'Content-Type': 'application/json',
  Origin: 'https://yt.savetube.me',
  'User-Agent': 'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36'
};
const METADATA_DECRYPTION_KEY = Buffer.from('C5D58EF67A7584E4A29F6C35BBC4EB12', 'hex');

export function extractYouTubeId(url) {
  if (!url) return null;
  const match = String(url).match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|v\/))([a-zA-Z0-9_-]{11})/i
  );
  return match ? match[1] : null;
}

// Provider 1 (Tier 1): Savetube VIP CDN Resolver (Existing retained & deadline-bound)
async function providerSavetube(url, { signal, timeoutMs }) {
  const videoId = extractYouTubeId(url);
  if (!videoId) throw new Error('ID YouTube tidak valid');

  const stepTimeout = Math.max(2500, Math.floor(timeoutMs / 2));
  const cdnRes = await axios.get('https://media.savetube.vip/api/random-cdn', {
    headers: SAVETUBE_HEADERS,
    timeout: stepTimeout,
    signal
  });

  const cdn = cdnRes.data?.cdn;
  if (!cdn) throw new Error('Savetube CDN tidak tersedia');

  const infoRes = await axios.post(
    `https://${cdn}/v2/info`,
    { url: `https://www.youtube.com/watch?v=${videoId}` },
    { headers: SAVETUBE_HEADERS, timeout: stepTimeout, signal }
  );

  if (!infoRes.data?.data) throw new Error('Savetube gagal mengenkripsi metadata');

  const encrypted = Buffer.from(infoRes.data.data, 'base64');
  const decipher = crypto.createDecipheriv(
    'aes-128-cbc',
    METADATA_DECRYPTION_KEY,
    encrypted.subarray(0, 16)
  );
  const decrypted = Buffer.concat([decipher.update(encrypted.subarray(16)), decipher.final()]);
  const metadata = JSON.parse(decrypted.toString('utf8'));

  if (!metadata?.key) throw new Error('Key Savetube tidak ditemukan');

  const [videoRes, audioRes] = await Promise.allSettled([
    axios.post(
      `https://${cdn}/download`,
      { id: videoId, downloadType: 'video', quality: '720', key: metadata.key },
      { headers: SAVETUBE_HEADERS, timeout: stepTimeout, signal }
    ),
    axios.post(
      `https://${cdn}/download`,
      { id: videoId, downloadType: 'audio', quality: '128kbps', key: metadata.key },
      { headers: SAVETUBE_HEADERS, timeout: stepTimeout, signal }
    )
  ]);

  const videoUrl = videoRes.status === 'fulfilled' ? videoRes.value.data?.data?.downloadUrl : null;
  const audioUrl = audioRes.status === 'fulfilled' ? audioRes.value.data?.data?.downloadUrl : null;

  if (!videoUrl && !audioUrl) {
    throw new Error('Savetube tidak menghasilkan link stream');
  }

  return {
    engine: 'Savetube VIP CDN (Tier-1)',
    video_id: videoId,
    title: metadata.title || 'YouTube Media',
    uploader: metadata.author || '',
    duration: metadata.durationSeconds || 0,
    thumbnail: metadata.thumbnail || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    video_url: videoUrl,
    audio_url: audioUrl
  };
}

// Provider 2 (Tier 2): Invidious Public API Instance (inv.nadeko.net)
async function providerInvidious(url, { signal, timeoutMs }) {
  const videoId = extractYouTubeId(url);
  if (!videoId) throw new Error('ID YouTube tidak valid');

  const res = await axios.get(`https://inv.nadeko.net/api/v1/videos/${videoId}`, {
    headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
    timeout: timeoutMs,
    signal
  });

  const d = res.data;
  if (!d?.title) throw new Error('Invidious gagal mengambil data video');

  const formatStreams = Array.isArray(d.formatStreams) ? d.formatStreams : [];
  const adaptiveFormats = Array.isArray(d.adaptiveFormats) ? d.adaptiveFormats : [];
  const bestVideo = formatStreams[0]?.url || null;
  const bestAudio = adaptiveFormats.find((f) => String(f.type || '').startsWith('audio/'))?.url || null;

  if (!bestVideo && !bestAudio) {
    throw new Error('Invidious tidak menyediakan direct stream');
  }

  return {
    engine: 'Invidious Public API (Tier-2)',
    video_id: videoId,
    title: d.title,
    uploader: d.author || '',
    duration: d.lengthSeconds || 0,
    views: d.viewCount || 0,
    thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    video_url: bestVideo,
    audio_url: bestAudio
  };
}

// Provider 3 (Tier 2): yt-dlp Core Subprocess (Existing retained)
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

  if (!json) throw new Error('yt-dlp gagal mem-parsing data video YouTube');

  let bestVideo = null;
  let bestAudio = null;

  if (Array.isArray(json.formats)) {
    const combined = json.formats
      .filter((f) => f.vcodec !== 'none' && f.acodec !== 'none' && f.ext === 'mp4')
      .sort((a, b) => (b.height || 0) - (a.height || 0));
    bestVideo = combined[0]?.url || null;

    const audioOnly = json.formats
      .filter((f) => f.vcodec === 'none' && f.acodec !== 'none')
      .sort((a, b) => (b.abr || 0) - (a.abr || 0));
    bestAudio = audioOnly[0]?.url || null;
  }

  return {
    engine: 'yt-dlp Core (Tier-2)',
    video_id: json.id || extractYouTubeId(url),
    title: json.title,
    uploader: json.uploader || json.channel || '',
    duration: json.duration || 0,
    views: json.view_count || 0,
    thumbnail: json.thumbnail || null,
    video_url: bestVideo || json.url || null,
    audio_url: bestAudio || null
  };
}

// Provider 4 (Tier 3): YouTube Watch + oEmbed Resilient Metadata Resolver (Benchmarked 127ms p50)
async function providerYouTubeOembedFallback(url, { signal, timeoutMs }) {
  const videoId = extractYouTubeId(url);
  if (!videoId) throw new Error('ID YouTube tidak valid');

  const canonicalUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const res = await axios.get('https://www.youtube.com/oembed', {
    params: { url: canonicalUrl, format: 'json' },
    timeout: timeoutMs,
    signal
  });

  const d = res.data;
  if (!d?.title) throw new Error('YouTube oEmbed gagal membaca metadata');

  return {
    engine: 'YouTube Official oEmbed (Tier-3 Metadata Fallback)',
    video_id: videoId,
    title: d.title,
    uploader: d.author_name || '',
    duration: 0,
    thumbnail: d.thumbnail_url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    video_url: `https://www.youtube.com/embed/${videoId}`,
    audio_url: null
  };
}

export async function scrapeYouTube(url) {
  if (!url || typeof url !== 'string' || !url.trim()) {
    throw new ValidationError('Parameter URL wajib diisi');
  }

  const safeUrl = await validateSSRF(url.trim());

  const { data } = await executeMultiProvider(
    'dl.youtube',
    [
      {
        id: 'youtube_savetube',
        failureDomain: 'savetube.vip',
        tier: 1,
        timeoutMs: 11000,
        allowTransientRetry: true,
        fn: (ctx) => providerSavetube(safeUrl, ctx)
      },
      {
        id: 'youtube_invidious',
        failureDomain: 'inv.nadeko.net',
        tier: 2,
        timeoutMs: 8500,
        fn: (ctx) => providerInvidious(safeUrl, ctx)
      },
      {
        id: 'youtube_ytdlp',
        failureDomain: 'local-ytdlp-youtube',
        tier: 2,
        timeoutMs: 18000,
        fn: (ctx) => providerYtDlp(safeUrl, ctx)
      },
      {
        id: 'youtube_oembed_fallback',
        failureDomain: 'youtube.com-oembed',
        tier: 3,
        timeoutMs: 6000,
        fn: (ctx) => providerYouTubeOembedFallback(safeUrl, ctx)
      }
    ],
    {
      totalDeadlineMs: 26000,
      retryBudget: 1,
      validateResult: (r) => Boolean(r && r.title && (r.video_url || r.audio_url))
    }
  );

  return data;
}
