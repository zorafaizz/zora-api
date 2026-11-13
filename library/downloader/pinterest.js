import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export async function scrapePinterest(url) {
  if (!url) throw new Error('Parameter URL wajib diisi');

  try {
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

    if (!json) throw new Error('Gagal mem-parsing data Pinterest');

    return {
      status: true,
      title: json.title || 'Pinterest Media',
      uploader: json.uploader || '',
      thumbnail: json.thumbnail || null,
      media_url: json.url || json.formats?.[0]?.url || null,
      is_video: json.ext === 'mp4' || Boolean(json.vcodec && json.vcodec !== 'none')
    };
  } catch (err) {
    throw new Error(`Pinterest Scraper Error: ${err.message}`);
  }
}
