import axios from 'axios';
import * as cheerio from 'cheerio';
import { withDeadline } from '../core/resilience.js';

const BASE_URL = 'https://www.gsmarena.com';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9'
};

export async function searchDevice(query) {
  if (!query) throw new Error('Parameter query wajib diisi');

  return await withDeadline(async () => {
    const url = `${BASE_URL}/results.php3?sQuickSearch=yes&sName=${encodeURIComponent(query.trim())}`;
    const res = await axios.get(url, { headers: HEADERS, timeout: 12000 });
    const $ = cheerio.load(res.data);

    const results = [];
    $('.makers ul li').each((_, el) => {
      const a = $(el).find('a');
      const href = a.attr('href');
      const name = a.find('span').html()?.replace(/<br>/g, ' ') || a.text().trim();
      const img = a.find('img').attr('src');
      const desc = a.attr('title') || '';

      if (href && name) {
        results.push({
          name: name.trim(),
          id: href.replace('.php', ''),
          url: `${BASE_URL}/${href}`,
          thumbnail: img || null,
          description: desc
        });
      }
    });

    return {
      status: true,
      query,
      total: results.length,
      devices: results
    };
  }, 15000, 'gsmarena-search');
}
