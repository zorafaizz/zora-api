import axios from 'axios';
import * as cheerio from 'cheerio';
import { validateSSRF } from '../core/security.js';
import { withDeadline } from '../core/resilience.js';

export async function scrapeSfile(rawUrl) {
  if (!rawUrl) throw new Error('Parameter URL wajib diisi');
  const safeUrl = await validateSSRF(rawUrl);

  return await withDeadline(async () => {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K)',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    };

    const r1 = await axios.get(safeUrl, { headers, timeout: 10000 });
    const cookie = (r1.headers['set-cookie'] || []).map(v => v.split(';')[0]).join('; ');
    if (cookie) headers.cookie = cookie;

    let $ = cheerio.load(r1.data);
    const fileName = $('h1').first().text().trim() || null;
    const size = r1.data.match(/(\d+(?:\.\d+)?\s?(?:KB|MB|GB))/i)?.[1] || null;
    const author = r1.data.match(/uploaded by\s([^ <]+)/i)?.[1] || null;

    const pageUrl = $('meta[property="og:url"]').attr('content') || safeUrl;
    headers.referer = safeUrl;

    const r2 = await axios.get(pageUrl, { headers, timeout: 10000 });
    $ = cheerio.load(r2.data);
    const gateUrl = $('#download').attr('href');

    let downloadUrl = null;
    if (gateUrl) {
      headers.referer = pageUrl;
      const r3 = await axios.get(gateUrl, { headers, timeout: 10000 });
      const finalMatch = r3.data.match(/https:\\\/\\\/download\d+\.sfile\.(?:co|mobi)\\\/downloadfile\\\/\d+\\\/\d+\\\/[a-z0-9]+\\\/[^"'\\\s]+(\?[^"']+)?/i);
      downloadUrl = finalMatch ? finalMatch[0].replace(/\\\//g, '/') : null;
    }

    return {
      status: true,
      file_name: fileName,
      file_size: size,
      author,
      download_url: downloadUrl
    };
  }, 20000, 'sfile-scrape');
}
