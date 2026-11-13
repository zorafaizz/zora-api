import axios from 'axios';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

// ENGINE 1: TikWM API (Fast, HD, Multi-slide)
async function engineTikWM(url) {
  const res = await axios.post(
    'https://www.tikwm.com/api/',
    new URLSearchParams({ url: url.trim(), count: 12, cursor: 0, web: 1, hd: 1 }),
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'application/json, text/javascript, */*; q=0.01'
      },
      timeout: 12000
    }
  );

  const json = res.data;
  if (json.code !== 0 || !json.data) {
    throw new Error(json.msg || 'TikWM gagal mengekstrak data');
  }

  const d = json.data;
  const isSlide = Array.isArray(d.images) && d.images.length > 0;

  return {
    engine: 'TikWM (Primary)',
    type: isSlide ? 'slide' : 'video',
    title: d.title || '',
    author: {
      nickname: d.author?.nickname || '',
      username: d.author?.unique_id || '',
      avatar: d.author?.avatar || ''
    },
    stats: {
      views: d.play_count || 0,
      likes: d.digg_count || 0,
      comments: d.comment_count || 0,
      shares: d.share_count || 0
    },
    duration: d.duration || 0,
    video: !isSlide ? (d.hdplay || d.play || d.wmplay) : null,
    audio: d.music || d.music_info?.play_url || null,
    images: isSlide ? d.images : []
  };
}

// ENGINE 2: yt-dlp Subprocess (Reliable Backup)
async function engineYtDlp(url) {
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

  if (!json) throw new Error('yt-dlp gagal mem-parsing JSON TikTok');

  return {
    engine: 'yt-dlp (Backup)',
    type: 'video',
    title: json.title || '',
    author: {
      nickname: json.uploader || '',
      username: json.uploader_id || '',
      avatar: ''
    },
    stats: {
      views: json.view_count || 0,
      likes: json.like_count || 0,
      comments: json.comment_count || 0,
      shares: 0
    },
    duration: json.duration || 0,
    video: json.url || null,
    audio: null,
    images: []
  };
}

// MAIN EXPORT WITH AUTO-FAILOVER
export async function scrapeTikTok(url) {
  if (!url) throw new Error('Parameter URL wajib diisi');

  let lastErr = null;
  // Coba Engine 1 (TikWM)
  try {
    return await engineTikWM(url);
  } catch (err) {
    lastErr = err;
    console.warn(`[TikTok] Engine 1 gagal (${err.message}), beralih ke Engine 2 (yt-dlp)...`);
  }

  // Coba Engine 2 (yt-dlp) jika Engine 1 gagal
  try {
    return await engineYtDlp(url);
  } catch (err) {
    throw new Error(`Semua engine TikTok gagal: ${lastErr?.message} | ${err.message}`);
  }
}
