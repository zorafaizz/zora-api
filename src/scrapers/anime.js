import axios from 'axios';
import * as cheerio from 'cheerio';
import { withDeadline } from '../core/resilience.js';

export async function searchAnime(query) {
  if (!query) throw new Error('Parameter query wajib diisi');

  return await withDeadline(async () => {
    const url = `https://kusonime.com/?s=${encodeURIComponent(query.trim())}`;
    const res = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 12000
    });

    const $ = cheerio.load(res.data);
    const results = [];

    $('.venz > ul > .kover').each((_, el) => {
      const item = $(el);
      const title = item.find('.content h2 a').text().trim();
      const link = item.find('.content h2 a').attr('href');
      const thumb = item.find('.thumb img').attr('src') || item.find('.thumb img').attr('data-src');
      const released = item.find('.content p:has(i.fa-clock-o)').text().replace('Released on', '').trim();
      const genre = item.find('.content p:has(i.fa-tag) a').map((_, g) => $(g).text().trim()).get();

      if (title && link) {
        results.push({
          title,
          url: link,
          thumbnail: thumb,
          released,
          genre
        });
      }
    });

    return {
      status: true,
      query,
      total: results.length,
      anime: results
    };
  }, 15000, 'anime-search');
}
