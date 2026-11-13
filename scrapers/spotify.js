import axios from 'axios';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export async function scrapeSpotify(queryOrUrl) {
  if (!queryOrUrl) throw new Error('Parameter query atau URL wajib diisi');

  let trackTitle = queryOrUrl.trim();
  let coverUrl = '';

  // Jika input adalah link open.spotify.com
  if (queryOrUrl.includes('spotify.com/track/')) {
    try {
      const oembed = await axios.get(`https://open.spotify.com/oembed?url=${encodeURIComponent(queryOrUrl.trim())}`, { timeout: 8000 });
      trackTitle = oembed.data?.title || trackTitle;
      coverUrl = oembed.data?.thumbnail_url || '';
    } catch {}
  }

  // Jika belum dapat cover atau pencarian judul, coba via iTunes API
  if (!coverUrl) {
    try {
      const itunes = await axios.get(`https://itunes.apple.com/search?term=${encodeURIComponent(trackTitle)}&entity=song&limit=1`, { timeout: 8000 });
      const first = itunes.data?.results?.[0];
      if (first) {
        trackTitle = `${first.trackName} - ${first.artistName}`;
        coverUrl = first.artworkUrl100?.replace('100x100bb', '600x600bb') || '';
      }
    } catch {}
  }

  // Ambil stream MP3 audio via yt-dlp search
  try {
    const { stdout } = await execFileAsync(
      'yt-dlp',
      ['ytsearch1:' + trackTitle, '-j', '--no-warnings', '--no-playlist'],
      { timeout: 25000, maxBuffer: 10 * 1024 * 1024 }
    );

    const lines = stdout.trim().split('\n');
    let json = null;
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        json = JSON.parse(lines[i]);
        break;
      } catch {}
    }

    if (!json) throw new Error('Gagal mengekstrak audio dari YouTube music provider');

    let audioStream = null;
    if (Array.isArray(json.formats)) {
      const audios = json.formats
        .filter(f => f.vcodec === 'none' && f.acodec !== 'none' && f.url)
        .sort((a, b) => (b.abr || 0) - (a.abr || 0));
      audioStream = audios[0]?.url || json.url || null;
    }

    return {
      status: true,
      title: json.title || trackTitle,
      artist: json.uploader || json.channel || '',
      duration: json.duration || 0,
      thumbnail: coverUrl || json.thumbnail || null,
      audio_url: audioStream
    };
  } catch (err) {
    throw new Error(`Spotify Audio Scraper Error: ${err.message}`);
  }
}
