import axios from 'axios';
import crypto from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const SAVETUBE_HEADERS = {
  'Content-Type': 'application/json',
  Origin: 'https://yt.savetube.me',
  'User-Agent': 'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36'
};
const METADATA_DECRYPTION_KEY = Buffer.from('C5D58EF67A7584E4A29F6C35BBC4EB12', 'hex');

function extractYouTubeId(url) {
  if (!url) return null;
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|v\/))([a-zA-Z0-9_-]{11})/i);
  return match ? match[1] : null;
}

// ENGINE 1: Savetube VIP CDN Resolver (Decrypted Fast Stream)
async function engineSavetube(url) {
  const videoId = extractYouTubeId(url);
  if (!videoId) throw new Error('ID YouTube tidak valid');

  const cdnRes = await axios.get('https://media.savetube.vip/api/random-cdn', {
    headers: SAVETUBE_HEADERS,
    timeout: 6000
  });

  const cdn = cdnRes.data?.cdn;
  if (!cdn) throw new Error('Savetube CDN tidak tersedia');

  const infoRes = await axios.post(
    `https://${cdn}/v2/info`,
    { url: `https://www.youtube.com/watch?v=${videoId}` },
    { headers: SAVETUBE_HEADERS, timeout: 8000 }
  );

  const encrypted = Buffer.from(infoRes.data.data, 'base64');
  const decipher = crypto.createDecipheriv('aes-128-cbc', METADATA_DECRYPTION_KEY, encrypted.subarray(0, 16));
  const decrypted = Buffer.concat([decipher.update(encrypted.subarray(16)), decipher.final()]);
  const metadata = JSON.parse(decrypted.toString('utf8'));

  if (!metadata?.key) throw new Error('Key Savetube tidak ditemukan');

  // Ambil link video 720p dan link audio mp3 secara paralel
  const [videoRes, audioRes] = await Promise.allSettled([
    axios.post(`https://${cdn}/download`, { id: videoId, downloadType: 'video', quality: '720', key: metadata.key }, { headers: SAVETUBE_HEADERS, timeout: 8000 }),
    axios.post(`https://${cdn}/download`, { id: videoId, downloadType: 'audio', quality: '128kbps', key: metadata.key }, { headers: SAVETUBE_HEADERS, timeout: 8000 })
  ]);

  const videoUrl = videoRes.status === 'fulfilled' ? videoRes.value.data?.data?.downloadUrl : null;
  const audioUrl = audioRes.status === 'fulfilled' ? audioRes.value.data?.data?.downloadUrl : null;

  return {
    engine: 'Savetube VIP CDN (Primary)',
    title: metadata.title || 'YouTube Media',
    uploader: metadata.author || '',
    duration: metadata.durationSeconds || 0,
    thumbnail: metadata.thumbnail || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    video_url: videoUrl,
    audio_url: audioUrl
  };
}

// ENGINE 2: yt-dlp Subprocess Fallback
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

  if (!json) throw new Error('yt-dlp gagal mem-parsing data video YouTube');

  let bestVideo = null;
  let bestAudio = null;

  if (Array.isArray(json.formats)) {
    const combined = json.formats
      .filter(f => f.vcodec !== 'none' && f.acodec !== 'none' && f.ext === 'mp4')
      .sort((a, b) => (b.height || 0) - (a.height || 0));
    bestVideo = combined[0]?.url || null;

    const audioOnly = json.formats
      .filter(f => f.vcodec === 'none' && f.acodec !== 'none')
      .sort((a, b) => (b.abr || 0) - (a.abr || 0));
    bestAudio = audioOnly[0]?.url || null;
  }

  return {
    engine: 'yt-dlp Core (Backup)',
    title: json.title,
    uploader: json.uploader || json.channel || '',
    duration: json.duration || 0,
    views: json.view_count || 0,
    thumbnail: json.thumbnail || null,
    video_url: bestVideo || json.url || null,
    audio_url: bestAudio || null
  };
}

export async function scrapeYouTube(url) {
  if (!url) throw new Error('Parameter URL wajib diisi');

  let lastErr = null;
  // Coba Engine 1 (Savetube VIP CDN)
  try {
    return await engineSavetube(url);
  } catch (err) {
    lastErr = err;
    console.warn(`[YouTube] Engine 1 Savetube gagal (${err.message}), beralih ke Engine 2 (yt-dlp)...`);
  }

  // Coba Engine 2 (yt-dlp)
  try {
    return await engineYtDlp(url);
  } catch (err) {
    throw new Error(`Semua engine YouTube gagal: ${lastErr?.message} | ${err.message}`);
  }
}
