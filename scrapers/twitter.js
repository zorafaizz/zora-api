import axios from 'axios';
import crypto from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

// Helper token generator untuk x2twitter
function generateCfToken() {
  return [
    '0',
    crypto.randomBytes(16).toString('hex'),
    crypto.randomBytes(32).toString('base64url'),
    crypto.randomBytes(64).toString('base64url'),
    crypto.randomBytes(32).toString('hex')
  ].join('.');
}

// ENGINE 1: X2Twitter Scraper
async function engineX2Twitter(url) {
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
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Cookie: `_session=${sessionToken}; lang=id`
      },
      timeout: 12000
    }
  );

  if (res.data.status !== 'ok' || !res.data.data) {
    throw new Error('X2Twitter gagal memproses URL');
  }

  const html = res.data.data;
  const thumbnail = (html.match(/<img\s+src="([^"]+)"/) || [])[1] || '';
  const duration = (html.match(/<p>(\d+:\d+)<\/p>/) || [])[1] || '';
  
  const videoMatches = [...html.matchAll(/href="([^"]+)"[^>]*class="btn[^"]*"[^>]*>Download MP4\s*\(([^)]+)\)/gi)];
  const downloads = videoMatches.map(m => ({
    quality: m[2].trim(),
    url: m[1]
  }));

  if (downloads.length === 0) {
    // cari fallback url link download
    const rawMatch = html.match(/href="([^"]+)"[^>]*class="btn/i);
    if (rawMatch) downloads.push({ quality: 'Default', url: rawMatch[1] });
  }

  if (downloads.length === 0) throw new Error('Link video Twitter tidak ditemukan di X2Twitter');

  return {
    engine: 'X2Twitter (Primary)',
    thumbnail,
    duration,
    downloads
  };
}

// ENGINE 2: yt-dlp Subprocess Fallback
async function engineYtDlpTwitter(url) {
  const { stdout } = await execFileAsync(
    'yt-dlp',
    ['-j', '--no-warnings', '--no-playlist', url.trim()],
    { timeout: 20000, maxBuffer: 10 * 1024 * 1024 }
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
      .filter(f => f.vcodec !== 'none' && f.url)
      .sort((a, b) => (b.height || 0) - (a.height || 0));
    for (const v of vids.slice(0, 3)) {
      downloads.push({
        quality: `${v.height || 'HD'}p`,
        url: v.url
      });
    }
  }

  if (downloads.length === 0 && json.url) {
    downloads.push({ quality: 'Default', url: json.url });
  }

  return {
    engine: 'yt-dlp (Backup)',
    thumbnail: json.thumbnail || '',
    duration: json.duration ? `${json.duration}s` : '',
    downloads
  };
}

export async function scrapeTwitter(url) {
  if (!url) throw new Error('Parameter URL wajib diisi');

  let lastErr = null;
  try {
    return await engineX2Twitter(url);
  } catch (err) {
    lastErr = err;
    console.warn(`[Twitter] Engine 1 gagal (${err.message}), mencoba Engine 2 (yt-dlp)...`);
  }

  try {
    return await engineYtDlpTwitter(url);
  } catch (err) {
    throw new Error(`Semua engine Twitter gagal: ${lastErr?.message} | ${err.message}`);
  }
}
