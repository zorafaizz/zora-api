import axios from 'axios';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { executeMultiProvider } from '../src/core/resilience.js';
import { ValidationError } from '../src/core/errors.js';
import { validateSSRF } from '../src/core/security.js';

const execFileAsync = promisify(execFile);

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

function extractTweetId(url) {
  const m = String(url).match(/(?:twitter\.com|x\.com)\/(?:[^/]+\/status|i\/web\/status)\/(\d+)/i);
  return m ? m[1] : null;
}

function computeSyndicationToken(tweetId) {
  return ((Number(tweetId) / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, '');
}

// Provider 1 (Tier 1): Twitter Official Syndication CDN (Benchmarked 199ms p50)
async function providerTwimgSyndication(url, { signal, timeoutMs }) {
  const tweetId = extractTweetId(url);
  if (!tweetId) throw new Error('Tweet ID tidak ditemukan pada URL');

  const token = computeSyndicationToken(tweetId);
  const res = await axios.get('https://cdn.syndication.twimg.com/tweet-result', {
    params: { id: tweetId, lang: 'en', token },
    headers: { 'User-Agent': BROWSER_UA, Accept: 'application/json' },
    timeout: timeoutMs,
    signal
  });

  const d = res.data;
  if (!d || d.__typename === 'TweetTombstone') {
    throw new Error('Tweet tidak ditemukan atau telah dihapus');
  }

  const downloads = [];
  let thumbnail = d.photos?.[0]?.url || '';
  let durationSec = 0;

  if (Array.isArray(d.mediaDetails)) {
    for (const media of d.mediaDetails) {
      if (!thumbnail && media.media_url_https) thumbnail = media.media_url_https;
      if (media.video_info?.variants) {
        durationSec = Math.round((media.video_info.duration_millis || 0) / 1000);
        const mp4s = media.video_info.variants
          .filter((v) => v.content_type === 'video/mp4' && v.url)
          .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
        for (const v of mp4s) {
          const resMatch = v.url.match(/\/(\d+x\d+)\//);
          downloads.push({
            quality: resMatch ? resMatch[1] : `${Math.round((v.bitrate || 0) / 1000)}kbps`,
            type: 'video',
            url: v.url
          });
        }
      } else if (media.media_url_https) {
        downloads.push({
          quality: 'Original Image',
          type: 'image',
          url: media.media_url_https
        });
      }
    }
  }

  if (downloads.length === 0 && Array.isArray(d.photos)) {
    for (const p of d.photos) {
      if (p.url) downloads.push({ quality: 'Original Image', type: 'image', url: p.url });
    }
  }

  if (downloads.length === 0) {
    throw new Error('Tweet tidak memiliki lampiran video/gambar di Syndication');
  }

  return {
    engine: 'Twitter Syndication CDN (Tier-1)',
    id: d.id_str || tweetId,
    text: d.text || '',
    author: {
      name: d.user?.name || '',
      username: d.user?.screen_name || '',
      avatar: d.user?.profile_image_url_https || ''
    },
    thumbnail,
    duration: durationSec ? `${durationSec}s` : '',
    downloads
  };
}

// Provider 2 (Tier 1): FxTwitter Public API (Benchmarked 431ms p50)
async function providerFxTwitter(url, { signal, timeoutMs }) {
  const tweetId = extractTweetId(url);
  if (!tweetId) throw new Error('Tweet ID tidak ditemukan pada URL');

  const res = await axios.get(`https://api.fxtwitter.com/status/${tweetId}`, {
    headers: { 'User-Agent': 'KanjutGedeAPI/2.0 (+https://itsfaiz.my.id)', Accept: 'application/json' },
    timeout: timeoutMs,
    signal
  });

  const tweet = res.data?.tweet;
  if (!tweet) throw new Error(res.data?.message || 'FxTwitter gagal mengekstrak tweet');

  const downloads = [];
  let thumbnail = '';
  let durationSec = 0;

  if (Array.isArray(tweet.media?.videos)) {
    for (const v of tweet.media.videos) {
      if (!thumbnail && v.thumbnail_url) thumbnail = v.thumbnail_url;
      if (v.duration) durationSec = Math.round(v.duration);
      if (Array.isArray(v.variants)) {
        const sorted = v.variants
          .filter((x) => x.content_type === 'video/mp4' && x.url)
          .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
        for (const variant of sorted) {
          downloads.push({
            quality: variant.bitrate ? `${Math.round(variant.bitrate / 1000)}kbps` : 'HD',
            type: 'video',
            url: variant.url
          });
        }
      }
      if (downloads.length === 0 && v.url) {
        downloads.push({ quality: `${v.width || 'HD'}x${v.height || ''}`, type: 'video', url: v.url });
      }
    }
  }

  if (Array.isArray(tweet.media?.photos)) {
    for (const p of tweet.media.photos) {
      if (!thumbnail && p.url) thumbnail = p.url;
      if (p.url) downloads.push({ quality: 'Original Image', type: 'image', url: p.url });
    }
  }

  if (downloads.length === 0) {
    throw new Error('FxTwitter tidak menemukan media unduhan pada tweet ini');
  }

  return {
    engine: 'FxTwitter API (Tier-1)',
    id: tweet.id || tweetId,
    text: tweet.text || '',
    author: {
      name: tweet.author?.name || '',
      username: tweet.author?.screen_name || '',
      avatar: tweet.author?.avatar_url || ''
    },
    thumbnail,
    duration: durationSec ? `${durationSec}s` : '',
    downloads
  };
}

function generateCfToken() {
  return [
    '0',
    crypto.randomBytes(16).toString('hex'),
    crypto.randomBytes(32).toString('base64url'),
    crypto.randomBytes(64).toString('base64url'),
    crypto.randomBytes(32).toString('hex')
  ].join('.');
}

// Provider 3 (Tier 2): X2Twitter Scraper (Existing retained)
async function providerX2Twitter(url, { signal, timeoutMs }) {
  const cfToken = generateCfToken();
  const sessionToken = crypto.randomBytes(16).toString('hex');

  const res = await axios.post(
    'https://x2twitter.com/api/ajaxSearch',
    new URLSearchParams({ q: url, lang: 'id', cftoken: cfToken }),
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
        Origin: 'https://x2twitter.com',
        Referer: 'https://x2twitter.com/id',
        'User-Agent': BROWSER_UA,
        Cookie: `_session=${sessionToken}; lang=id`
      },
      timeout: timeoutMs,
      signal
    }
  );

  if (res.data?.status !== 'ok' || !res.data?.data) {
    throw new Error('X2Twitter gagal memproses URL');
  }

  const html = res.data.data;
  const thumbnail = (html.match(/<img\s+src="([^"]+)"/) || [])[1] || '';
  const duration = (html.match(/<p>(\d+:\d+)<\/p>/) || [])[1] || '';

  const videoMatches = [
    ...html.matchAll(/href="([^"]+)"[^>]*class="btn[^"]*"[^>]*>Download MP4\s*\(([^)]+)\)/gi)
  ];
  const downloads = videoMatches.map((m) => ({
    quality: m[2].trim(),
    type: 'video',
    url: m[1]
  }));

  if (downloads.length === 0) {
    const rawMatch = html.match(/href="([^"]+)"[^>]*class="btn/i);
    if (rawMatch) downloads.push({ quality: 'Default', type: 'video', url: rawMatch[1] });
  }

  if (downloads.length === 0) throw new Error('Link media Twitter tidak ditemukan di X2Twitter');

  return {
    engine: 'X2Twitter (Tier-2)',
    thumbnail,
    duration,
    downloads
  };
}

// Provider 4 (Tier 3): yt-dlp Subprocess Backup (Existing retained)
async function providerYtDlpTwitter(url, { timeoutMs }) {
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

  if (!json) throw new Error('yt-dlp gagal mem-parsing JSON Twitter');

  const downloads = [];
  if (Array.isArray(json.formats)) {
    const vids = json.formats
      .filter((f) => f.vcodec !== 'none' && f.url)
      .sort((a, b) => (b.height || 0) - (a.height || 0));
    for (const v of vids.slice(0, 3)) {
      downloads.push({
        quality: `${v.height || 'HD'}p`,
        type: 'video',
        url: v.url
      });
    }
  }

  if (downloads.length === 0 && json.url) {
    downloads.push({ quality: 'Default', type: 'video', url: json.url });
  }

  if (downloads.length === 0) throw new Error('yt-dlp tidak menemukan stream Twitter');

  return {
    engine: 'yt-dlp (Tier-3 Backup)',
    thumbnail: json.thumbnail || '',
    duration: json.duration ? `${json.duration}s` : '',
    downloads
  };
}

export async function scrapeTwitter(url) {
  if (!url || typeof url !== 'string' || !url.trim()) {
    throw new ValidationError('Parameter URL wajib diisi');
  }

  const safeUrl = await validateSSRF(url.trim());

  const { data } = await executeMultiProvider(
    'dl.twitter',
    [
      {
        id: 'twitter_twimg_syndication',
        failureDomain: 'syndication.twimg.com',
        tier: 1,
        timeoutMs: 8000,
        allowTransientRetry: true,
        fn: (ctx) => providerTwimgSyndication(safeUrl, ctx)
      },
      {
        id: 'twitter_fxtwitter',
        failureDomain: 'fxtwitter.com',
        tier: 1,
        timeoutMs: 8500,
        allowTransientRetry: true,
        fn: (ctx) => providerFxTwitter(safeUrl, ctx)
      },
      {
        id: 'twitter_x2twitter',
        failureDomain: 'x2twitter.com',
        tier: 2,
        timeoutMs: 10000,
        fn: (ctx) => providerX2Twitter(safeUrl, ctx)
      },
      {
        id: 'twitter_ytdlp',
        failureDomain: 'local-ytdlp-twitter',
        tier: 3,
        timeoutMs: 16000,
        fn: (ctx) => providerYtDlpTwitter(safeUrl, ctx)
      }
    ],
    {
      totalDeadlineMs: 25000,
      retryBudget: 1,
      validateResult: (r) => Boolean(r && Array.isArray(r.downloads) && r.downloads.length > 0)
    }
  );

  return data;
}
