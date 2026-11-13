import axios from 'axios';
import * as cheerio from 'cheerio';

export async function scrapeMediafire(url) {
  if (!url) throw new Error('Parameter URL wajib diisi');

  try {
    const res = await axios.get(url.trim(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
      },
      timeout: 15000
    });

    const $ = cheerio.load(res.data);
    const downloadButton = $('#downloadButton');
    const downloadUrl = downloadButton.attr('href');

    if (!downloadUrl) {
      throw new Error('Link download MediaFire tidak ditemukan');
    }

    const filename = $('.dl-btn-label').attr('title') || $('.promoDownloadName .fileName').text().trim() || 'unknown';
    const filesize = downloadButton.text().replace(/\s+/g, ' ').match(/\((.*?)\)/)?.[1] || 'unknown';
    const mimetype = $('.dl-info .filetype span').text().trim();

    return {
      status: true,
      filename,
      filesize,
      mimetype,
      download_url: downloadUrl
    };
  } catch (err) {
    throw new Error(`MediaFire Scraper Error: ${err.message}`);
  }
}
