/**
 * RAW EXTRACTED FROM NEOXR DECRYPTED WASM BUNDLE (@neoxr/wb)
 * Scraper.uploadImageV3 implementation
 */
import axios from 'axios';
import FormData from 'form-data';
import { fileTypeFromBuffer } from 'file-type';

export async function uploadImageV3_neoxr(bufferOrUrl) {
  try {
    let buffer = Buffer.isBuffer(bufferOrUrl) ? bufferOrUrl : null;
    if (!buffer && typeof bufferOrUrl === 'string' && bufferOrUrl.startsWith('http')) {
      const resp = await axios.get(bufferOrUrl, { responseType: 'arraybuffer' });
      buffer = Buffer.from(resp.data);
    }
    if (!buffer) throw new Error('Buffer gambar kosong');

    const type = await fileTypeFromBuffer(buffer);
    const ext = type?.ext || 'jpg';

    const form = new FormData();
    form.append('file', buffer, `image.${ext}`);

    const res = await axios.post('https://telegra.ph/upload', form, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Origin: 'https://telegra.ph',
        Referer: 'https://telegra.ph/',
        'x-requested-with': 'XMLHttpRequest',
        ...form.getHeaders()
      },
      timeout: 15000
    });

    const data = res.data;
    if (!data || data.length < 1 || !data[0].src) {
      return { creator: 'neoxr', status: false, msg: 'Gagal mengunggah ke telegra.ph' };
    }

    return {
      creator: 'neoxr',
      status: true,
      data: {
        url: `https://telegra.ph${data[0].src}`
      }
    };
  } catch (err) {
    return { creator: 'neoxr', status: false, msg: err.message };
  }
}
