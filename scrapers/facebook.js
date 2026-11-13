import axios from 'axios';
import * as cheerio from 'cheerio';

export async function scrapeFacebook(url) {
  if (!url) throw new Error('Parameter URL wajib diisi');

  try {
    const res = await axios.post(
      'https://fdown.net/download.php',
      new URLSearchParams({ URLz: url.trim() }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
        },
        timeout: 15000
      }
    );

    const $ = cheerio.load(res.data);
    const sdLink = $('#sdlink').attr('href');
    const hdLink = $('#hdlink').attr('href');
    const title = $('.lib-item-title').text().trim() || 'Facebook Video';
    const desc = $('.lib-desc').text().trim();

    if (!sdLink && !hdLink) {
      throw new Error('Video tidak ditemukan atau bersifat privat');
    }

    return {
      status: true,
      title,
      description: desc,
      video_hd: hdLink || null,
      video_sd: sdLink || null
    };
  } catch (err) {
    throw new Error(`Facebook Scraper Error: ${err.message}`);
  }
}
