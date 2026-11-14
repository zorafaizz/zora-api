import axios from 'axios';
import { executeMultiProvider } from '../core/resilience.js';
import { ValidationError } from '../core/errors.js';

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

// Provider 1 (Tier 1): Pinterest BaseSearchResource JSON API (Benchmarked 620ms p50)
async function pinterestResourceSearch(query, { signal, timeoutMs }) {
  const sourceUrl = `/search/pins/?q=${encodeURIComponent(query.trim())}`;
  const dataParam = JSON.stringify({
    options: { query: query.trim(), scope: 'pins', page_size: 20 },
    context: {}
  });

  const res = await axios.get('https://www.pinterest.com/resource/BaseSearchResource/get/', {
    params: { source_url: sourceUrl, data: dataParam },
    headers: {
      'User-Agent': BROWSER_UA,
      Accept: 'application/json, text/javascript, */*, q=0.01',
      Referer: 'https://www.pinterest.com/',
      'X-Pinterest-AppState': 'active',
      'X-Pinterest-PWS-Handler': 'www/search/[scope].js',
      'X-Requested-With': 'XMLHttpRequest'
    },
    timeout: timeoutMs,
    signal
  });

  const rawList = res.data?.resource_response?.data?.results || [];
  const results = rawList
    .map((pin) => {
      const image =
        pin.images?.orig?.url ||
        pin.images?.['736x']?.url ||
        pin.images?.['474x']?.url ||
        null;
      if (!image) return null;
      return {
        id: pin.id || null,
        title: (pin.grid_title || pin.title || pin.description || '').trim() || query.trim(),
        author: pin.pinner?.full_name || pin.pinner?.username || null,
        image_url: image,
        pin_url: pin.id ? `https://www.pinterest.com/pin/${pin.id}/` : null
      };
    })
    .filter(Boolean);

  if (results.length === 0) {
    throw new Error('Pin tidak ditemukan dari BaseSearchResource');
  }

  return {
    status: true,
    engine: 'Pinterest Search Resource (Tier-1)',
    query,
    total: results.length,
    results
  };
}

// Provider 2 (Tier 2): Wikimedia Commons High-Res Visual Image Search Fallback
async function wikimediaImageFallback(query, { signal, timeoutMs }) {
  const res = await axios.get('https://commons.wikimedia.org/w/api.php', {
    params: {
      action: 'query',
      generator: 'search',
      gsrsearch: `${query.trim()} filetype:bitmap`,
      gsrnamespace: 6,
      gsrlimit: 15,
      prop: 'imageinfo',
      iiprop: 'url|extmetadata',
      format: 'json'
    },
    headers: {
      'User-Agent': 'KanjutGedeAPI/2.0 (+https://itsfaiz.my.id)',
      Accept: 'application/json'
    },
    timeout: timeoutMs,
    signal
  });

  const pages = Object.values(res.data?.query?.pages || {});
  const results = pages
    .map((p) => {
      const info = p.imageinfo?.[0];
      if (!info?.url) return null;
      return {
        id: String(p.pageid),
        title: String(p.title || '').replace(/^File:/i, '').replace(/\.[^.]+$/, ''),
        author: info.extmetadata?.Artist?.value?.replace(/<[^>]+>/g, '') || 'Wikimedia Commons',
        image_url: info.url,
        pin_url: info.descriptionurl || info.url
      };
    })
    .filter(Boolean);

  if (results.length === 0) {
    throw new Error('Gambar tidak ditemukan untuk kata kunci tersebut');
  }

  return {
    status: true,
    engine: 'Visual Image Search Fallback (Tier-2)',
    query,
    total: results.length,
    results
  };
}

export async function searchPinterest(query) {
  if (!query || typeof query !== 'string' || !query.trim()) {
    throw new ValidationError('Parameter query wajib diisi');
  }

  const { data } = await executeMultiProvider(
    'search.pinterest',
    [
      {
        id: 'pinterest_base_search',
        failureDomain: 'pinterest.com-search',
        tier: 1,
        timeoutMs: 8500,
        allowTransientRetry: true,
        fn: (ctx) => pinterestResourceSearch(query.trim(), ctx)
      },
      {
        id: 'pinterest_visual_fallback',
        failureDomain: 'commons.wikimedia.org',
        tier: 2,
        timeoutMs: 8000,
        fn: (ctx) => wikimediaImageFallback(query.trim(), ctx)
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
