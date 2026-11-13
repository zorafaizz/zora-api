import axios from 'axios';
import * as cheerio from 'cheerio';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

// ENGINE 1: FDown Web Scraper
async function engineFDown(url) {
  const res = await axios.post(
    'https://fdown.net/download.php',
    new URLSearchParams({ URLz: url.trim() }),
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
      },
      timeout: 12000
    }
  );

  const $ = cheerio.load(res.data);
  const sdLink = $('#sdlink').attr('href');
  const hdLink = $('#hdlink').attr('href');
  const title = $('.lib-item-title').text().trim() || 'Facebook Video';
  const desc = $('.lib-desc').text().trim();

  if (!sdLink && !hdLink) {
    throw new Error('FDown: Video tidak ditemukan atau bersifat privat');
  }

  return {
    engine: 'FDown (Primary)',
    title,
    description: desc,
    video_hd: hdLink || null,
    video_sd: sdLink || null
  };
}

// ENGINE 2: yt-dlp Subprocess Fallback
async function engineYtDlpFb(url) {
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

  if (!json) throw new Error('yt-dlp gagal mem-parsing JSON Facebook');

  return {
    engine: 'yt-dlp (Backup)',
    title: json.title || 'Facebook Video',
    description: json.description || '',
    video_hd: json.url || null,
    video_sd: null
  };
}

export async function scrapeFacebook(url) {
  if (!url) throw new Error('Parameter URL wajib diisi');

  let lastErr = null;
  try {
    return await engineFDown(url);
  } catch (err) {
    lastErr = err;
    console.warn(`[Facebook] Engine 1 gagal (${err.message}), mencoba Engine 2 (yt-dlp)...`);
  }

  try {
    return await engineYtDlpFb(url);
  } catch (err) {
    throw new Error(`Semua engine Facebook gagal: ${lastErr?.message} | ${err.message}`);
  }
}
