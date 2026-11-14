import axios from 'axios';
import { withDeadline } from '../core/resilience.js';

const CLIENT_ID = 'KKzJxmw11tYpCs6T24P4uUYhqmjalG6M';

export async function searchSoundCloud(query) {
  if (!query) throw new Error('Parameter query wajib diisi');

  return await withDeadline(async () => {
    const res = await axios.get('https://api-mobi.soundcloud.com/search', {
      params: {
        q: query.trim(),
        client_id: CLIENT_ID,
        limit: 15
      },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 12000
    });

    const items = res.data?.collection || [];
    const results = items.map((track) => ({
      id: track.id,
      title: track.title,
      artist: track.user?.username || null,
      duration_seconds: Math.floor((track.duration || 0) / 1000),
      url: track.permalink_url,
      artwork: track.artwork_url,
      genre: track.genre || null,
      plays: track.playback_count || 0,
      likes: track.likes_count || 0
    }));

    return {
      status: true,
      query,
      total: results.length,
      results
    };
  }, 15000, 'soundcloud-search');
}
