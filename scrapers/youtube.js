import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export async function scrapeYouTube(url) {
  if (!url) throw new Error('Parameter URL wajib diisi');

  try {
    const { stdout } = await execFileAsync(
      'yt-dlp',
      ['-j', '--no-warnings', '--no-playlist', url.trim()],
      { timeout: 25000, maxBuffer: 10 * 1024 * 1024 }
    );

    // yt-dlp outputs warning lines before JSON, filter to find JSON line
    const lines = stdout.trim().split('\n');
    let json = null;
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        json = JSON.parse(lines[i]);
        break;
      } catch {}
    }

    if (!json) throw new Error('Gagal mem-parsing data video YouTube');

    // Extract best mp4 with audio and best audio
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
      status: true,
      title: json.title,
      uploader: json.uploader || json.channel || '',
      duration: json.duration || 0,
      views: json.view_count || 0,
      thumbnail: json.thumbnail || null,
      video_url: bestVideo || json.url || null,
      audio_url: bestAudio || null
    };
  } catch (err) {
    throw new Error(`YouTube Scraper Error: ${err.message}`);
  }
}
