/**
 * RAW EXTRACTED FROM NEOXR DECRYPTED WASM BUNDLE (@neoxr/wb)
 * Scraper.chatAI implementation
 */
import axios from 'axios';

export async function chatAI_neoxr(bid, key, msg) {
  try {
    const res = await axios.get(`http://api.brainshop.ai/get?bid=${bid}&key=${key}&uid=neoxr&msg=${encodeURIComponent(msg)}`, { timeout: 15000 });
    const data = res.data;
    if (data.cnt === undefined) return { creator: 'neoxr', status: false };
    return { creator: 'neoxr', status: true, msg: data.cnt };
  } catch (err) {
    return { creator: 'neoxr', status: false, error: err.message };
  }
}
