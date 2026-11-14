import axios from 'axios';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { executeMultiProvider } from '../src/core/resilience.js';
import { ValidationError } from '../src/core/errors.js';
import { validateSSRF } from '../src/core/security.js';

const execFileAsync = promisify(execFile);

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

// Provider 1 (Tier 1): Pinterest Pin HTML / PWS JSON Extractor (Supports Video & Original HD Image)
async function providerPinterestPageJson(url, { signal, timeoutMs }) {
  const res = await axios.get(url, {
    headers: {
      'User-Agent': BROWSER_UA,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9'
    },
    maxRedirects: 5,
    timeout: timeoutMs,
    signal
  });

  const html = String(res.data || '');

  // Check __PWS_DATA__ or initial redux/relay state for direct mp4 / orig image
  const videoMatch = html.match(/https:\/\/v1\.pinimg\.com\/videos\/[^\s"'\\]+\.mp4/);
  const origImgMatch =
    html.match(/https:\/\/i\.pinimg\.com\/originals\/[^\s"'\\]+\.(?:jpg|jpeg|png|webp|gif)/i) ||
    html.match(/https:\/\/i\.pinimg\.com\/736x\/[^\s"'\\]+\.(?:jpg|jpeg|png|webp)/i);

  const titleMatch =
    html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i) ||
    html.match(/<title>([^<]+)<\/title>/i);
  const thumbMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i);
  const authorMatch = html.match(/"full_name":"([^"]+)"/);

  const mediaUrl = videoMatch?.[0] || origImgMatch?.[0] || thumbMatch?.[1] || null;
  if (!mediaUrl) {
    throw new Error('Media Pinterest tidak ditemukan dari halaman Pin');
  }

  return {
    status: true,
    engine: 'Pinterest Direct JSON/OG (Tier-1)',
    title: (titleMatch?.[1] || 'Pinterest Media').replace(/\s*\|\s*Pinterest$/i, '').trim(),
    uploader: authorMatch?.[1] || '',
    thumbnail: thumbMatch?.[1] || origImgMatch?.[0] || mediaUrl,
    media_url: mediaUrl,
    is_video: Boolean(videoMatch)
  };
}

// Provider 2 (Tier 2): Pinterest Official oEmbed Endpoint (Benchmarked 276ms p50)
async function providerPinterestOembed(url, { signal, timeoutMs }) {
  let resolvedUrl = url;
  if (/pin\.it\//i.test(url)) {
    const headRes = await axios.get(url, {
      headers: { 'User-Agent': BROWSER_UA },
      maxRedirects: 5,
      timeout: Math.min(5000, timeoutMs),
      signal
    });
    resolvedUrl = headRes.request?.res?.responseUrl || url;
  }

  const res = await axios.get('https://www.pinterest.com/oembed.json', {
    params: { url: resolvedUrl },
    headers: { 'User-Agent': BROWSER_UA, Accept: 'application/json' },
    timeout: timeoutMs,
    signal
  });

  const d = res.data;
  if (!d?.thumbnail_url) {
    throw new Error('Pinterest oEmbed tidak mengembalikan media');
  }

  const hdImage = d.thumbnail_url.replace(/\/\d+x\//, '/originals/');
  return {
    status: true,
    engine: 'Pinterest oEmbed (Tier-2)',
    title: d.title || 'Pinterest Media',
    uploader: d.author_name || '',
    thumbnail: d.thumbnail_url,
    media_url: hdImage || d.thumbnail_url,
    is_video: false
  };
}

// Provider 3 (Tier 3): yt-dlp Subprocess Backup (Existing retained)
async function providerPinterestYtDlp(url, { timeoutMs }) {
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

  if (!json) throw new Error('Gagal mem-parsing data Pinterest via yt-dlp');

  return {
    status: true,
    engine: 'yt-dlp (Tier-3 Backup)',
    title: json.title || 'Pinterest Media',
    uploader: json.uploader || '',
    thumbnail: json.thumbnail || null,
    media_url: json.url || json.formats?.[0]?.url || null,
    is_video: json.ext === 'mp4' || Boolean(json.vcodec && json.vcodec !== 'none')
  };
}

export async function scrapePinterest(url) {
  if (!url || typeof url !== 'string' || !url.trim()) {
    throw new ValidationError('Parameter URL wajib diisi');
  }

  const safeUrl = await validateSSRF(url.trim());

  const { data } = await executeMultiProvider(
    'dl.pinterest',
    [
      {
        id: 'pinterest_page_json',
        failureDomain: 'pinterest.com-html',
        tier: 1,
        timeoutMs: 8500,
        allowTransientRetry: true,
        fn: (ctx) => providerPinterestPageJson(safeUrl, ctx)
      },
      {
        id: 'pinterest_oembed',
        failureDomain: 'pinterest.com-oembed',
        tier: 2,
        timeoutMs: 8000,
        fn: (ctx) => providerPinterestOembed(safeUrl, ctx)
      },
      {
        id: 'pinterest_ytdlp',
        failureDomain: 'local-ytdlp-pinterest',
        tier: 3,
        timeoutMs: 16000,
        fn: (ctx) => providerPinterestYtDlp(safeUrl, ctx)
      }
    ],
    {
      totalDeadlineMs: 24000,
      retryBudget: 1,
      validateResult: (r) => Boolean(r && r.media_url)
    }
  );

  return data;
}
