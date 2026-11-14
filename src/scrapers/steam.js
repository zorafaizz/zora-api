import axios from 'axios';
import { executeMultiProvider } from '../core/resilience.js';
import { ValidationError } from '../core/errors.js';

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

// Provider 1 (Tier 1): Steam Official Storesearch API (Benchmarked 447ms p50)
async function steamStoreSearch(query, { signal, timeoutMs }) {
  const res = await axios.get('https://store.steampowered.com/api/storesearch/', {
    params: { term: query.trim(), l: 'english', cc: 'ID' },
    headers: { 'User-Agent': BROWSER_UA, Accept: 'application/json' },
    timeout: timeoutMs,
    signal
  });

  const items = Array.isArray(res.data?.items) ? res.data.items : [];
  if (items.length === 0) throw new Error('Game tidak ditemukan di Steam Store');

  const results = items.map((g) => {
    const finalPriceIdr = g.price ? Math.round(g.price.final / 100) : 0;
    const initialPriceIdr = g.price ? Math.round(g.price.initial / 100) : 0;
    const discountPct =
      initialPriceIdr > finalPriceIdr && initialPriceIdr > 0
        ? Math.round(((initialPriceIdr - finalPriceIdr) / initialPriceIdr) * 100)
        : 0;

    return {
      app_id: g.id,
      name: g.name,
      currency: g.price?.currency || 'IDR',
      price_final: finalPriceIdr,
      price_initial: initialPriceIdr,
      discount_percent: discountPct,
      is_free: !g.price || finalPriceIdr === 0,
      metascore: g.metascore ? Number(g.metascore) : null,
      platforms: g.platforms || { windows: true, mac: false, linux: false },
      thumbnail: g.tiny_image || `https://cdn.akamai.steamstatic.com/steam/apps/${g.id}/header.jpg`,
      store_url: `https://store.steampowered.com/app/${g.id}/`
    };
  });

  return {
    status: true,
    engine: 'Steam Storesearch API (Tier-1)',
    query,
    total: results.length,
    results
  };
}

// Provider 2 (Tier 2): CheapShark Public PC Game Index Fallback
async function cheapSharkFallback(query, { signal, timeoutMs }) {
  const res = await axios.get('https://www.cheapshark.com/api/1.0/games', {
    params: { title: query.trim(), limit: 15 },
    headers: { 'User-Agent': BROWSER_UA, Accept: 'application/json' },
    timeout: timeoutMs,
    signal
  });

  const items = Array.isArray(res.data) ? res.data : [];
  if (items.length === 0) throw new Error('Game tidak ditemukan di CheapShark');

  const results = items.map((g) => ({
    app_id: g.steamAppID ? Number(g.steamAppID) : Number(g.gameID),
    name: g.external,
    currency: 'USD',
    price_final: Number(g.cheapest || 0),
    price_initial: Number(g.cheapest || 0),
    discount_percent: 0,
    is_free: Number(g.cheapest || 0) === 0,
    metascore: null,
    platforms: { windows: true, mac: false, linux: false },
    thumbnail: g.thumb || null,
    store_url: g.steamAppID
      ? `https://store.steampowered.com/app/${g.steamAppID}/`
      : `https://www.cheapshark.com/redirect?dealID=${encodeURIComponent(g.cheapestDealID || '')}`
  }));

  return {
    status: true,
    engine: 'CheapShark PC Game Index (Tier-2)',
    query,
    total: results.length,
    results
  };
}

export async function searchSteam(query) {
  if (!query || typeof query !== 'string' || !query.trim()) {
    throw new ValidationError('Parameter query wajib diisi');
  }

  const { data } = await executeMultiProvider(
    'search.steam',
    [
      {
        id: 'steam_storesearch',
        failureDomain: 'store.steampowered.com',
        tier: 1,
        timeoutMs: 8000,
        allowTransientRetry: true,
        fn: (ctx) => steamStoreSearch(query.trim(), ctx)
      },
      {
        id: 'steam_cheapshark',
        failureDomain: 'cheapshark.com',
        tier: 2,
        timeoutMs: 8000,
        fn: (ctx) => cheapSharkFallback(query.trim(), ctx)
      }
    ],
    {
      totalDeadlineMs: 15000,
      retryBudget: 1,
      validateResult: (r) => Boolean(r && Array.isArray(r.results) && r.results.length > 0)
    }
  );

  return data;
}
