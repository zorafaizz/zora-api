import axios from 'axios';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { executeMultiProvider } from '../src/core/resilience.js';
import { ValidationError } from '../src/core/errors.js';

const execFileAsync = promisify(execFile);

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

function extractSpotifyTrackId(input) {
  const m = String(input).match(/spotify\.com\/(?:intl-[a-z]+\/)?track\/([A-Za-z0-9]+)/i);
  return m ? m[1] : null;
}

// Provider 1 (Tier 1): Spotify Embed __NEXT_DATA__ + iTunes AAC Preview Enricher (Benchmarked 385ms / 115ms)
async function providerSpotifyEmbed(queryOrUrl, { signal, timeoutMs }) {
  const trackId = extractSpotifyTrackId(queryOrUrl);
  if (!trackId) {
    throw new Error('Input bukan URL Spotify track langsung');
  }

  const embedRes = await axios.get(`https://open.spotify.com/embed/track/${trackId}`, {
    headers: { 'User-Agent': BROWSER_UA, Accept: 'text/html' },
    timeout: timeoutMs,
    signal
  });

  const html = String(embedRes.data || '');
  const nextMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!nextMatch) throw new Error('Spotify Embed JSON tidak ditemukan');

  const parsed = JSON.parse(nextMatch[1]);
  const entity = parsed?.props?.pageProps?.state?.data?.entity;
  if (!entity) throw new Error('Entity Spotify Embed kosong');

  const title = entity.name || entity.title || '';
  const artist = Array.isArray(entity.artists)
    ? entity.artists.map((a) => a.name).join(', ')
    : entity.subtitle || '';
  const durationSec = Math.round((entity.duration || 0) / 1000);
  const cover =
    entity.visualIdentity?.image?.[0]?.url ||
    entity.coverArt?.sources?.[0]?.url ||
    null;
  let audioUrl = entity.audioPreview?.url || null;

  if (!audioUrl && title) {
    const itunes = await axios.get('https://itunes.apple.com/search', {
      params: { term: `${title} ${artist}`.trim(), entity: 'song', limit: 1 },
      timeout: Math.min(5000, timeoutMs),
      signal
    });
    audioUrl = itunes.data?.results?.[0]?.previewUrl || null;
  }

  if (!audioUrl) throw new Error('Preview stream tidak tersedia di Spotify Embed');

  return {
    status: true,
    engine: 'Spotify Embed + Apple CDN (Tier-1)',
    title,
    artist,
    duration: durationSec,
    thumbnail: cover,
    audio_url: audioUrl
  };
}

// Provider 2 (Tier 1): FabDL Spotify MP3 Converter API
async function providerFabdlSpotify(queryOrUrl, { signal, timeoutMs }) {
  const trackId = extractSpotifyTrackId(queryOrUrl);
  if (!trackId) throw new Error('FabDL membutuhkan URL Spotify track');

  const trackUrl = `https://open.spotify.com/track/${trackId}`;
  const headers = {
    'User-Agent': BROWSER_UA,
    Accept: 'application/json',
    Origin: 'https://fabdl.com',
    Referer: 'https://fabdl.com/'
  };

  const infoRes = await axios.get(`https://api.fabdl.com/spotify/get?url=${encodeURIComponent(trackUrl)}`, {
    headers,
    timeout: timeoutMs,
    signal
  });

  const info = infoRes.data?.result;
  if (!info?.id || !info?.gid) {
    throw new Error('FabDL gagal mengambil metadata Spotify');
  }

  const convRes = await axios.get(
    `https://api.fabdl.com/spotify/mp3-convert-task/${info.gid}/${info.id}`,
    { headers, timeout: timeoutMs, signal }
  );
  const dlPath = convRes.data?.result?.download_url;
  if (!dlPath) throw new Error('FabDL belum menghasilkan link MP3');

  return {
    status: true,
    engine: 'FabDL MP3 Resolver (Tier-1)',
    title: info.name || 'Spotify Track',
    artist: info.artists || '',
    duration: Math.round((info.duration_ms || 0) / 1000),
    thumbnail: info.image || null,
    audio_url: dlPath.startsWith('http') ? dlPath : `https://api.fabdl.com${dlPath}`
  };
}

// Provider 3 (Tier 1 for keyword queries / Tier 2 fallback): iTunes / Apple Music Search + M4A Preview (115ms p50)
async function providerItunesPreview(queryOrUrl, { signal, timeoutMs }) {
  let searchTerm = queryOrUrl.trim();
  let fallbackThumb = '';

  if (extractSpotifyTrackId(searchTerm)) {
    const oembed = await axios.get('https://open.spotify.com/oembed', {
      params: { url: searchTerm },
      timeout: Math.min(5000, timeoutMs),
      signal
    });
    searchTerm = oembed.data?.title || searchTerm;
    fallbackThumb = oembed.data?.thumbnail_url || '';
  }

  const res = await axios.get('https://itunes.apple.com/search', {
    params: { term: searchTerm, entity: 'song', limit: 1 },
    timeout: timeoutMs,
    signal
  });

  const track = res.data?.results?.[0];
  if (!track || !track.previewUrl) {
    throw new Error('Lagu tidak ditemukan di katalog iTunes/Apple Music');
  }

  return {
    status: true,
    engine: 'Apple Music / iTunes CDN (Tier-1)',
    title: track.trackName || searchTerm,
    artist: track.artistName || '',
    album: track.collectionName || '',
    duration: Math.round((track.trackTimeMillis || 0) / 1000),
    thumbnail:
      track.artworkUrl100?.replace('100x100bb', '600x600bb') || fallbackThumb || null,
    audio_url: track.previewUrl
  };
}

// Provider 4 (Tier 3): yt-dlp Search Backup (Existing retained)
async function providerYtDlpAudio(queryOrUrl, { timeoutMs }) {
  let trackTitle = queryOrUrl.trim();
  let coverUrl = '';

  if (queryOrUrl.includes('spotify.com/track/')) {
    try {
      const oembed = await axios.get(
        `https://open.spotify.com/oembed?url=${encodeURIComponent(queryOrUrl.trim())}`,
        { timeout: 5000 }
      );
      trackTitle = oembed.data?.title || trackTitle;
      coverUrl = oembed.data?.thumbnail_url || '';
    } catch {}
  }

  const { stdout } = await execFileAsync(
    'yt-dlp',
    ['ytsearch1:' + trackTitle, '-j', '--no-warnings', '--no-playlist'],
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

  if (!json) throw new Error('Gagal mengekstrak audio dari yt-dlp');

  let audioStream = null;
  if (Array.isArray(json.formats)) {
    const audios = json.formats
      .filter((f) => f.vcodec === 'none' && f.acodec !== 'none' && f.url)
      .sort((a, b) => (b.abr || 0) - (a.abr || 0));
    audioStream = audios[0]?.url || json.url || null;
  }

  if (!audioStream) throw new Error('Audio stream kosong dari yt-dlp');

  return {
    status: true,
    engine: 'yt-dlp Audio (Tier-3 Backup)',
    title: json.title || trackTitle,
    artist: json.uploader || json.channel || '',
    duration: json.duration || 0,
    thumbnail: coverUrl || json.thumbnail || null,
    audio_url: audioStream
  };
}

export async function scrapeSpotify(queryOrUrl) {
  if (!queryOrUrl || typeof queryOrUrl !== 'string' || !queryOrUrl.trim()) {
    throw new ValidationError('Parameter query atau URL wajib diisi');
  }

  const trimmed = queryOrUrl.trim();
  const isSpotifyUrl = Boolean(extractSpotifyTrackId(trimmed));

  const providers = [];
  if (isSpotifyUrl) {
    providers.push(
      {
        id: 'spotify_embed_json',
        failureDomain: 'open.spotify.com',
        tier: 1,
        timeoutMs: 8500,
        allowTransientRetry: true,
        fn: (ctx) => providerSpotifyEmbed(trimmed, ctx)
      },
      {
        id: 'spotify_fabdl',
        failureDomain: 'api.fabdl.com',
        tier: 1,
        timeoutMs: 9000,
        fn: (ctx) => providerFabdlSpotify(trimmed, ctx)
      }
    );
  }

  providers.push(
    {
      id: 'spotify_itunes_preview',
      failureDomain: 'itunes.apple.com',
      tier: isSpotifyUrl ? 2 : 1,
      timeoutMs: 8000,
      allowTransientRetry: true,
      fn: (ctx) => providerItunesPreview(trimmed, ctx)
    },
    {
      id: 'spotify_ytdlp',
      failureDomain: 'local-ytdlp-spotify',
      tier: 3,
      timeoutMs: 18000,
      fn: (ctx) => providerYtDlpAudio(trimmed, ctx)
    }
  );

  const { data } = await executeMultiProvider('dl.spotify', providers, {
    totalDeadlineMs: 25000,
    retryBudget: 1,
    validateResult: (r) => Boolean(r && r.audio_url)
  });

  return data;
}
