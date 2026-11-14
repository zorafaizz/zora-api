import axios from 'axios';
import { executeMultiProvider } from '../core/resilience.js';
import { ValidationError } from '../core/errors.js';
import { validateSSRF } from '../core/security.js';

const STATIC_MOBI_CLIENT_ID = 'KKzJxmw11tYpCs6T24P4uUYhqmjalG6M';
const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

let cachedDynamicClientId = null;
let cachedClientIdExpiresAt = 0;

async function getDynamicSoundCloudClientId(signal, timeoutMs = 8000) {
  if (cachedDynamicClientId && Date.now() < cachedClientIdExpiresAt) {
    return cachedDynamicClientId;
  }

  const homeRes = await axios.get('https://soundcloud.com', {
    headers: { 'User-Agent': BROWSER_UA },
    timeout: Math.min(5000, timeoutMs),
    signal
  });
  const html = String(homeRes.data || '');
  const scriptUrls = [...html.matchAll(/src="(https:\/\/a-v2\.sndcdn\.com\/assets\/[^"]+\.js)"/g)].map(
    (m) => m[1]
  );

  for (const scriptUrl of scriptUrls.slice(-4).reverse()) {
    const jsRes = await axios.get(scriptUrl, {
      headers: { 'User-Agent': BROWSER_UA },
      timeout: Math.min(5000, timeoutMs),
      signal
    });
    const body = String(jsRes.data || '');
    const m = body.match(/client_id\s*:\s*"([A-Za-z0-9]{32})"/);
    if (m?.[1]) {
      cachedDynamicClientId = m[1];
      cachedClientIdExpiresAt = Date.now() + 30 * 60 * 1000;
      return cachedDynamicClientId;
    }
  }

  throw new Error('Gagal mengekstrak dynamic client_id SoundCloud');
}

function mapSoundCloudTrack(track) {
  return {
    id: track.id,
    title: track.title,
    artist: track.user?.username || null,
    duration_seconds: Math.floor((track.duration || 0) / 1000),
    url: track.permalink_url,
    artwork: track.artwork_url ? track.artwork_url.replace('-large', '-t500x500') : null,
    genre: track.genre || null,
    plays: track.playback_count || 0,
    likes: track.likes_count || 0
  };
}

// Search Provider 1 (Tier 1): SoundCloud API v2 with Dynamic Client ID (Benchmarked 1485ms p50)
async function searchViaApiV2(query, { signal, timeoutMs }) {
  const clientId = await getDynamicSoundCloudClientId(signal, timeoutMs);
  const res = await axios.get('https://api-v2.soundcloud.com/search/tracks', {
    params: { q: query.trim(), client_id: clientId, limit: 15 },
    headers: { 'User-Agent': BROWSER_UA, Accept: 'application/json' },
    timeout: timeoutMs,
    signal
  });

  const items = Array.isArray(res.data?.collection) ? res.data.collection : [];
  if (items.length === 0) throw new Error('Tidak ada lagu ditemukan di SoundCloud API v2');

  const results = items.map(mapSoundCloudTrack);
  return {
    status: true,
    engine: 'SoundCloud API v2 Dynamic (Tier-1)',
    query,
    total: results.length,
    results
  };
}

// Search Provider 2 (Tier 2): SoundCloud Mobi API (Existing retained)
async function searchViaApiMobi(query, { signal, timeoutMs }) {
  const res = await axios.get('https://api-mobi.soundcloud.com/search', {
    params: { q: query.trim(), client_id: STATIC_MOBI_CLIENT_ID, limit: 15 },
    headers: { 'User-Agent': BROWSER_UA, Accept: 'application/json' },
    timeout: timeoutMs,
    signal
  });

  const items = Array.isArray(res.data?.collection) ? res.data.collection : [];
  if (items.length === 0) throw new Error('Tidak ada hasil di SoundCloud Mobi');

  const results = items.map(mapSoundCloudTrack);
  return {
    status: true,
    engine: 'SoundCloud Mobi API (Tier-2)',
    query,
    total: results.length,
    results
  };
}

export async function searchSoundCloud(query) {
  if (!query || typeof query !== 'string' || !query.trim()) {
    throw new ValidationError('Parameter query wajib diisi');
  }

  const { data } = await executeMultiProvider(
    'search.soundcloud',
    [
      {
        id: 'soundcloud_v2_search',
        failureDomain: 'api-v2.soundcloud.com',
        tier: 1,
        timeoutMs: 9500,
        allowTransientRetry: true,
        fn: (ctx) => searchViaApiV2(query.trim(), ctx)
      },
      {
        id: 'soundcloud_mobi_search',
        failureDomain: 'api-mobi.soundcloud.com',
        tier: 2,
        timeoutMs: 8500,
        fn: (ctx) => searchViaApiMobi(query.trim(), ctx)
      }
    ],
    {
      totalDeadlineMs: 18000,
      retryBudget: 1,
      validateResult: (r) => Boolean(r && Array.isArray(r.results) && r.results.length > 0)
    }
  );

  return data;
}

// Downloader Provider 1 (Tier 1): SoundCloud API v2 Progressive/HLS Stream Resolver
async function downloadViaApiV2(url, { signal, timeoutMs }) {
  const clientId = await getDynamicSoundCloudClientId(signal, timeoutMs);
  const resolveRes = await axios.get('https://api-v2.soundcloud.com/resolve', {
    params: { url, client_id: clientId },
    headers: { 'User-Agent': BROWSER_UA, Accept: 'application/json' },
    timeout: timeoutMs,
    signal
  });

  const track = resolveRes.data;
  if (!track?.id) throw new Error('Track SoundCloud tidak ditemukan');

  const transcodings = track.media?.transcodings || [];
  const progressive =
    transcodings.find((t) => t.format?.protocol === 'progressive') || transcodings[0];

  let streamUrl = null;
  if (progressive?.url) {
    const streamRes = await axios.get(progressive.url, {
      params: { client_id: clientId },
      headers: { 'User-Agent': BROWSER_UA, Accept: 'application/json' },
      timeout: Math.min(5000, timeoutMs),
      signal
    });
    streamUrl = streamRes.data?.url || null;
  }

  if (!streamUrl) throw new Error('Stream audio SoundCloud tidak tersedia');

  return {
    status: true,
    engine: 'SoundCloud API v2 Stream (Tier-1)',
    id: track.id,
    title: track.title || '',
    artist: track.user?.username || '',
    duration_seconds: Math.floor((track.duration || 0) / 1000),
    thumbnail: track.artwork_url ? track.artwork_url.replace('-large', '-t500x500') : null,
    audio_url: streamUrl,
    permalink_url: track.permalink_url || url
  };
}

// Downloader Provider 2 (Tier 2): SoundCloud Official oEmbed Metadata Resolver (Benchmarked 362ms p50)
async function downloadViaOembed(url, { signal, timeoutMs }) {
  const res = await axios.get('https://soundcloud.com/oembed', {
    params: { format: 'json', url },
    headers: { 'User-Agent': BROWSER_UA, Accept: 'application/json' },
    timeout: timeoutMs,
    signal
  });

  const d = res.data;
  if (!d?.title) throw new Error('SoundCloud oEmbed gagal membaca track');

  return {
    status: true,
    engine: 'SoundCloud oEmbed (Tier-2 Metadata)',
    id: null,
    title: d.title,
    artist: d.author_name || '',
    duration_seconds: 0,
    thumbnail: d.thumbnail_url || null,
    audio_url: url,
    embed_html: d.html || null,
    permalink_url: url
  };
}

export async function scrapeSoundCloud(url) {
  if (!url || typeof url !== 'string' || !url.trim()) {
    throw new ValidationError('Parameter url wajib diisi');
  }

  const safeUrl = await validateSSRF(url.trim());

  const { data } = await executeMultiProvider(
    'dl.soundcloud',
    [
      {
        id: 'soundcloud_v2_dl',
        failureDomain: 'api-v2.soundcloud.com',
        tier: 1,
        timeoutMs: 10000,
        allowTransientRetry: true,
        fn: (ctx) => downloadViaApiV2(safeUrl, ctx)
      },
      {
        id: 'soundcloud_oembed_dl',
        failureDomain: 'soundcloud.com-oembed',
        tier: 2,
        timeoutMs: 6500,
        fn: (ctx) => downloadViaOembed(safeUrl, ctx)
      }
    ],
    {
      totalDeadlineMs: 18000,
      retryBudget: 1,
      validateResult: (r) => Boolean(r && r.title && r.audio_url)
    }
  );

  return data;
}
