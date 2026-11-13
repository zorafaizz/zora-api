import axios from 'axios';
import crypto from 'crypto';
import * as cheerio from 'cheerio';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);
const PATH_REGEX = /instagram\.com\/(p|reel|reels)\/([a-zA-Z0-9_-]+)/i;

function extractShortcode(url) {
  if (!url) return null;
  const match = url.match(PATH_REGEX);
  return match ? match[2] : null;
}

// ENGINE 1: ReelsVideo Scraper (dengan MD5 signature)
async function engineReelsVideo(url) {
  const ts = Math.floor(Date.now() / 1000);
  const tt = crypto.createHash('md5').update(ts + 'X-Fc-Pp-Ty-eZ').digest('hex');

  const body = new URLSearchParams();
  body.append('id', url.trim());
  body.append('locale', 'en');
  body.append('tt', tt);
  body.append('ts', ts);

  const res = await axios.post('https://reelsvideo.io/', body, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'hx-request': 'true',
      'hx-target': 'target',
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      Origin: 'https://reelsvideo.io',
      Referer: 'https://reelsvideo.io/'
    },
    timeout: 10000
  });

  const $ = cheerio.load(res.data);
  const videoLinks = [];
  $('a').each((i, el) => {
    const href = $(el).attr('href');
    if (href && (href.includes('.mp4') || href.includes('fbcdn.net') || href.includes('cdninstagram.com'))) {
      videoLinks.push(href);
    }
  });

  if (videoLinks.length === 0) throw new Error('ReelsVideo tidak menemukan link video');

  return {
    engine: 'ReelsVideo (Primary)',
    url: videoLinks[0],
    urls: videoLinks,
    type: 'video'
  };
}

// ENGINE 2: yt-dlp Subprocess Fallback
async function engineYtDlpInstagram(url) {
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

  if (!json) throw new Error('yt-dlp gagal mem-parsing data Instagram');

  return {
    engine: 'yt-dlp (Backup)',
    title: json.title || 'Instagram Media',
    uploader: json.uploader || '',
    thumbnail: json.thumbnail || null,
    url: json.url || json.formats?.[0]?.url || null,
    urls: [json.url || json.formats?.[0]?.url || ''],
    type: json.ext === 'mp4' ? 'video' : 'image'
  };
}

export async function scrapeInstagram(url) {
  if (!url) throw new Error('Parameter URL wajib diisi');

  let lastErr = null;
  try {
    return await engineReelsVideo(url);
  } catch (err) {
    lastErr = err;
    console.warn(`[Instagram] Engine 1 gagal (${err.message}), mencoba Engine 2 (yt-dlp)...`);
  }

  try {
    return await engineYtDlpInstagram(url);
  } catch (err) {
    throw new Error(`Semua engine Instagram gagal: ${lastErr?.message} | ${err.message}`);
  }
}
