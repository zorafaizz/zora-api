import axios from 'axios';
import { executeMultiProvider } from '../core/resilience.js';
import { ValidationError } from '../core/errors.js';
import { validateSSRF } from '../core/security.js';

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

export function extractPixeldrainInfo(url) {
  const m = String(url).match(/pixeldrain\.com\/(u|l)\/([A-Za-z0-9_-]+)/i);
  if (!m) return null;
  return { type: m[1].toLowerCase() === 'l' ? 'list' : 'file', id: m[2] };
}

function formatBytes(bytes) {
  const n = Number(bytes || 0);
  if (!n) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const idx = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  return `${(n / Math.pow(1024, idx)).toFixed(2)} ${units[idx]}`;
}

// Provider 1 (Tier 1): Pixeldrain Official Public Info API (Benchmarked 608ms p50)
async function pixeldrainRestApi(url, { signal, timeoutMs }) {
  const parsed = extractPixeldrainInfo(url);
  if (!parsed) throw new ValidationError('Format URL Pixeldrain tidak valid (gunakan pixeldrain.com/u/<id> atau /l/<id>)');

  if (parsed.type === 'list') {
    const res = await axios.get(`https://pixeldrain.com/api/list/${parsed.id}`, {
      headers: { 'User-Agent': BROWSER_UA, Accept: 'application/json' },
      timeout: timeoutMs,
      signal
    });
    const d = res.data;
    if (!d?.success && !Array.isArray(d?.files)) {
      throw new Error(d?.message || 'List Pixeldrain tidak ditemukan');
    }
    const files = (d.files || []).map((f) => ({
      id: f.id,
      name: f.name,
      size_bytes: f.size || 0,
      size_formatted: formatBytes(f.size),
      mime_type: f.mime_type || 'application/octet-stream',
      download_url: `https://pixeldrain.com/api/file/${f.id}?download`
    }));

    return {
      status: true,
      engine: 'Pixeldrain API v1 (Tier-1)',
      type: 'list',
      id: parsed.id,
      title: d.title || 'Pixeldrain Album',
      file_count: files.length,
      download_url: files[0]?.download_url || null,
      files
    };
  }

  const res = await axios.get(`https://pixeldrain.com/api/file/${parsed.id}/info`, {
    headers: { 'User-Agent': BROWSER_UA, Accept: 'application/json' },
    timeout: timeoutMs,
    signal
  });

  const d = res.data;
  if (!d?.id && !d?.name) {
    throw new Error(d?.message || 'File Pixeldrain tidak ditemukan');
  }

  return {
    status: true,
    engine: 'Pixeldrain API v1 (Tier-1)',
    type: 'file',
    id: d.id || parsed.id,
    name: d.name,
    size_bytes: d.size || 0,
    size_formatted: formatBytes(d.size),
    mime_type: d.mime_type || 'application/octet-stream',
    views: d.views || 0,
    downloads: d.downloads || 0,
    date_upload: d.date_upload || null,
    sha256_sum: d.sha256_sum || null,
    thumbnail_url: `https://pixeldrain.com/api/file/${parsed.id}/thumbnail`,
    download_url: `https://pixeldrain.com/api/file/${parsed.id}?download`
  };
}

// Provider 2 (Tier 2): Pixeldrain Viewer HTML Metadata Parser Fallback
async function pixeldrainHtmlFallback(url, { signal, timeoutMs }) {
  const parsed = extractPixeldrainInfo(url);
  if (!parsed) throw new ValidationError('Format URL Pixeldrain tidak valid');

  const res = await axios.get(`https://pixeldrain.com/${parsed.type === 'list' ? 'l' : 'u'}/${parsed.id}`, {
    headers: { 'User-Agent': BROWSER_UA, Accept: 'text/html' },
    timeout: timeoutMs,
    signal
  });

  const html = String(res.data || '');
  const titleMatch =
    html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i) ||
    html.match(/<title>([^<]+)<\/title>/i);

  if (!titleMatch) throw new Error('Halaman Pixeldrain tidak valid');

  return {
    status: true,
    engine: 'Pixeldrain HTML Viewer (Tier-2)',
    type: parsed.type,
    id: parsed.id,
    name: titleMatch[1].replace(/\s*-\s*pixeldrain$/i, '').trim(),
    download_url: `https://pixeldrain.com/api/file/${parsed.id}?download`
  };
}

export async function scrapePixeldrain(url) {
  if (!url || typeof url !== 'string' || !url.trim()) {
    throw new ValidationError('Parameter url wajib diisi');
  }

  const safeUrl = await validateSSRF(url.trim());
  if (!extractPixeldrainInfo(safeUrl)) {
    throw new ValidationError('Format URL Pixeldrain tidak valid (gunakan pixeldrain.com/u/<id> atau /l/<id>)');
  }

  const { data } = await executeMultiProvider(
    'dl.pixeldrain',
    [
      {
        id: 'pixeldrain_rest_api',
        failureDomain: 'pixeldrain.com-api',
        tier: 1,
        timeoutMs: 8500,
        allowTransientRetry: true,
        fn: (ctx) => pixeldrainRestApi(safeUrl, ctx)
      },
      {
        id: 'pixeldrain_html_viewer',
        failureDomain: 'pixeldrain.com-web',
        tier: 2,
        timeoutMs: 8000,
        fn: (ctx) => pixeldrainHtmlFallback(safeUrl, ctx)
      }
    ],
    {
      totalDeadlineMs: 16000,
      retryBudget: 1,
      validateResult: (r) => Boolean(r && r.download_url)
    }
  );

  return data;
}
