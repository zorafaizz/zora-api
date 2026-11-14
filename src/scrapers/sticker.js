import axios from 'axios';
import * as cheerio from 'cheerio';
import { executeMultiProvider } from '../core/resilience.js';
import { ValidationError } from '../core/errors.js';

const STICKERLY_UA = 'androidapp.stickerly/2.18.0 (Android 14; SDK 34; arm64-v8a)';
const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

// Provider 1 (Tier 1): Sticker.ly v4 SmartSearch Public API (Benchmarked 442ms p50)
async function stickerlySmartSearch(query, { signal, timeoutMs }) {
  const res = await axios.post(
    'https://api.sticker.ly/v4/stickerPack/smartSearch',
    {
      keyword: query.trim(),
      enabledKeywordSearch: true,
      filter: {
        extendSearchResult: false,
        sortBy: 'RECOMMENDED',
        languages: ['ALL'],
        minStickerCount: 5,
        searchBy: 'ALL',
        stickerType: 'ALL'
      }
    },
    {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': STICKERLY_UA,
        'x-duuid': 'kanjutgede-public-client'
      },
      timeout: timeoutMs,
      signal
    }
  );

  const packs = res.data?.result?.stickerPacks || [];
  if (packs.length === 0) throw new Error('Sticker pack tidak ditemukan di Sticker.ly');

  const results = packs.slice(0, 15).map((pack) => {
    const prefix = pack.resourceUrlPrefix || '';
    const files = Array.isArray(pack.resourceFiles) ? pack.resourceFiles : [];
    return {
      pack_id: pack.packId,
      name: pack.name,
      author: pack.authorName || '',
      animated: Boolean(pack.isAnimated),
      sticker_count: files.length || pack.resourceFiles?.length || 0,
      tray_icon: pack.trayIconFile ? `${prefix}${pack.trayIconFile}` : null,
      share_url: pack.shareUrl || `https://sticker.ly/s/${pack.packId}`,
      stickers: files.slice(0, 10).map((f) => `${prefix}${f}`)
    };
  });

  return {
    status: true,
    engine: 'Sticker.ly SmartSearch v4 (Tier-1)',
    query,
    total: results.length,
    results
  };
}

// Provider 2 (Tier 2): Tenor Public Web Sticker Search Fallback
async function tenorStickerFallback(query, { signal, timeoutMs }) {
  const url = `https://tenor.com/search/${encodeURIComponent(query.trim().replace(/\s+/g, '-'))}-stickers`;
  const res = await axios.get(url, {
    headers: { 'User-Agent': BROWSER_UA, Accept: 'text/html' },
    timeout: timeoutMs,
    signal
  });

  const $ = cheerio.load(res.data);
  const stickers = [];
  $('figure img, .Sticker img, img[src*="tenor.com"]').each((_, el) => {
    const src = $(el).attr('src');
    const alt = $(el).attr('alt') || query.trim();
    if (src && src.startsWith('https://media.tenor.com/')) {
      stickers.push({ title: alt, url: src });
    }
  });

  if (stickers.length === 0) {
    throw new Error('Sticker tidak ditemukan di Tenor Fallback');
  }

  return {
    status: true,
    engine: 'Tenor Stickers Web (Tier-2)',
    query,
    total: 1,
    results: [
      {
        pack_id: `tenor-${query.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        name: `${query.trim()} Stickers`,
        author: 'Tenor Community',
        animated: true,
        sticker_count: stickers.length,
        tray_icon: stickers[0].url,
        share_url: url,
        stickers: stickers.slice(0, 15).map((s) => s.url)
      }
    ]
  };
}

export async function searchSticker(query) {
  if (!query || typeof query !== 'string' || !query.trim()) {
    throw new ValidationError('Parameter query wajib diisi');
  }

  const { data } = await executeMultiProvider(
    'search.sticker',
    [
      {
        id: 'sticker_stickerly_v4',
        failureDomain: 'api.sticker.ly',
        tier: 1,
        timeoutMs: 8500,
        allowTransientRetry: true,
        fn: (ctx) => stickerlySmartSearch(query.trim(), ctx)
      },
      {
        id: 'sticker_tenor_web',
        failureDomain: 'tenor.com',
        tier: 2,
        timeoutMs: 8500,
        fn: (ctx) => tenorStickerFallback(query.trim(), ctx)
      }
    ],
    {
      totalDeadlineMs: 16000,
      retryBudget: 1,
      validateResult: (r) => Boolean(r && Array.isArray(r.results) && r.results.length > 0)
    }
  );

  return data;
}
