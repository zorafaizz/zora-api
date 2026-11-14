import axios from 'axios';
import { executeMultiProvider } from '../core/resilience.js';
import { ValidationError } from '../core/errors.js';

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

// Provider 1 (Tier 1): Apple iTunes Search Catalog API (Benchmarked 115ms p50)
async function itunesMusicCatalog(query, { signal, timeoutMs }) {
  const res = await axios.get('https://itunes.apple.com/search', {
    params: {
      term: query.trim(),
      entity: 'song',
      limit: 15,
      country: 'ID'
    },
    headers: { 'User-Agent': BROWSER_UA, Accept: 'application/json' },
    timeout: timeoutMs,
    signal
  });

  const tracks = Array.isArray(res.data?.results) ? res.data.results : [];
  if (tracks.length === 0) throw new Error('Lagu tidak ditemukan di Apple Music ID');

  const results = tracks.map((t) => ({
    track_id: t.trackId,
    title: t.trackName,
    artist: t.artistName,
    album: t.collectionName || null,
    genre: t.primaryGenreName || null,
    release_date: t.releaseDate || null,
    duration_seconds: Math.round((t.trackTimeMillis || 0) / 1000),
    artwork_url: t.artworkUrl100 ? t.artworkUrl100.replace('100x100bb', '600x600bb') : null,
    preview_url: t.previewUrl || null,
    apple_music_url: t.trackViewUrl || null
  }));

  return {
    status: true,
    engine: 'Apple Music / iTunes Catalog (Tier-1)',
    query,
    total: results.length,
    results
  };
}

// Provider 2 (Tier 2): Deezer Public Search API (Independent Music Catalog Fallback)
async function deezerMusicFallback(query, { signal, timeoutMs }) {
  const res = await axios.get('https://api.deezer.com/search', {
    params: { q: query.trim(), limit: 15 },
    headers: { 'User-Agent': BROWSER_UA, Accept: 'application/json' },
    timeout: timeoutMs,
    signal
  });

  const tracks = Array.isArray(res.data?.data) ? res.data.data : [];
  if (tracks.length === 0) throw new Error('Lagu tidak ditemukan di katalog alternatif');

  const results = tracks.map((t) => ({
    track_id: t.id,
    title: t.title,
    artist: t.artist?.name || '',
    album: t.album?.title || null,
    genre: null,
    release_date: null,
    duration_seconds: t.duration || 0,
    artwork_url: t.album?.cover_xl || t.album?.cover_big || null,
    preview_url: t.preview || null,
    apple_music_url: t.link || null
  }));

  return {
    status: true,
    engine: 'Deezer Public Catalog (Tier-2)',
    query,
    total: results.length,
    results
  };
}

export async function searchAppleMusic(query) {
  if (!query || typeof query !== 'string' || !query.trim()) {
    throw new ValidationError('Parameter query wajib diisi');
  }

  const { data } = await executeMultiProvider(
    'search.applemusic',
    [
      {
        id: 'applemusic_itunes',
        failureDomain: 'itunes.apple.com',
        tier: 1,
        timeoutMs: 7500,
        allowTransientRetry: true,
        fn: (ctx) => itunesMusicCatalog(query.trim(), ctx)
      },
      {
        id: 'applemusic_deezer_fallback',
        failureDomain: 'api.deezer.com',
        tier: 2,
        timeoutMs: 8000,
        fn: (ctx) => deezerMusicFallback(query.trim(), ctx)
      }
    ],
    {
      totalDeadlineMs: 15000,
      retryBudget: 1,
      validateResult: (r) => Boolean(r && Array.isArray(r.results) && r.results.length > 0)
    }
  );

  return data;
}
