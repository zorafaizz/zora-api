import axios from 'axios';
import { executeMultiProvider } from '../core/resilience.js';
import { ValidationError } from '../core/errors.js';

const WIKI_UA = 'KanjutGedeAPI/2.0 (https://itsfaiz.my.id; contact@itsfaiz.my.id)';

function normalizeLang(lang) {
  const clean = String(lang || 'id').trim().toLowerCase();
  return /^[a-z]{2,3}$/.test(clean) ? clean : 'id';
}

// Provider 1 (Tier 1): Wikipedia REST v1 Summary + MediaWiki Search Resolution (Benchmarked 175ms p50)
async function wikiRestSummary(query, lang, { signal, timeoutMs }) {
  const stepTimeout = Math.max(2500, Math.floor(timeoutMs / 2));
  const searchRes = await axios.get(`https://${lang}.wikipedia.org/w/api.php`, {
    params: {
      action: 'opensearch',
      search: query.trim(),
      limit: 5,
      namespace: 0,
      format: 'json'
    },
    headers: { 'User-Agent': WIKI_UA, Accept: 'application/json' },
    timeout: stepTimeout,
    signal
  });

  const titles = Array.isArray(searchRes.data?.[1]) ? searchRes.data[1] : [];
  const urls = Array.isArray(searchRes.data?.[3]) ? searchRes.data[3] : [];
  if (titles.length === 0) {
    throw new Error(`Artikel "${query}" tidak ditemukan di Wikipedia (${lang})`);
  }

  const topTitle = titles[0];
  const sumRes = await axios.get(
    `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(topTitle.replace(/\s+/g, '_'))}`,
    {
      headers: { 'User-Agent': WIKI_UA, Accept: 'application/json' },
      timeout: stepTimeout,
      signal
    }
  );

  const d = sumRes.data;
  return {
    status: true,
    engine: `Wikipedia REST v1 (${lang.toUpperCase()})`,
    lang,
    query,
    title: d.title || topTitle,
    description: d.description || null,
    extract: d.extract || '',
    thumbnail: d.thumbnail?.source || d.originalimage?.source || null,
    url: d.content_urls?.desktop?.page || urls[0] || `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(topTitle)}`,
    related: titles.slice(1).map((t, i) => ({
      title: t,
      url: urls[i + 1] || `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(t)}`
    }))
  };
}

// Provider 2 (Tier 2): MediaWiki Action Query Extracts (Fallback + English cross-fallback)
async function wikiActionQuery(query, lang, { signal, timeoutMs }) {
  const targetLang = lang === 'id' ? 'en' : lang;
  const res = await axios.get(`https://${targetLang}.wikipedia.org/w/api.php`, {
    params: {
      action: 'query',
      generator: 'search',
      gsrsearch: query.trim(),
      gsrlimit: 5,
      prop: 'extracts|pageimages|info',
      inprop: 'url',
      exintro: 1,
      explaintext: 1,
      piprop: 'thumbnail',
      pithumbsize: 500,
      format: 'json'
    },
    headers: { 'User-Agent': WIKI_UA, Accept: 'application/json' },
    timeout: timeoutMs,
    signal
  });

  const pagesObj = res.data?.query?.pages || {};
  const pages = Object.values(pagesObj).sort((a, b) => (a.index || 99) - (b.index || 99));
  if (pages.length === 0) throw new Error('Artikel tidak ditemukan di MediaWiki API');

  const top = pages[0];
  return {
    status: true,
    engine: `MediaWiki Action API (${targetLang.toUpperCase()})`,
    lang: targetLang,
    query,
    title: top.title,
    description: null,
    extract: (top.extract || '').trim(),
    thumbnail: top.thumbnail?.source || null,
    url: top.fullurl || `https://${targetLang}.wikipedia.org/?curid=${top.pageid}`,
    related: pages.slice(1).map((p) => ({
      title: p.title,
      url: p.fullurl || `https://${targetLang}.wikipedia.org/?curid=${p.pageid}`
    }))
  };
}

export async function searchWikipedia(query, lang = 'id') {
  if (!query || typeof query !== 'string' || !query.trim()) {
    throw new ValidationError('Parameter query wajib diisi');
  }

  const normalizedLang = normalizeLang(lang);

  const { data } = await executeMultiProvider(
    'search.wikipedia',
    [
      {
        id: 'wikipedia_rest_summary',
        failureDomain: `${normalizedLang}.wikipedia.org`,
        tier: 1,
        timeoutMs: 7500,
        allowTransientRetry: true,
        fn: (ctx) => wikiRestSummary(query.trim(), normalizedLang, ctx)
      },
      {
        id: 'wikipedia_mediawiki_fallback',
        failureDomain: 'en.wikipedia.org-action',
        tier: 2,
        timeoutMs: 8000,
        fn: (ctx) => wikiActionQuery(query.trim(), normalizedLang, ctx)
      }
    ],
    {
      totalDeadlineMs: 15000,
      retryBudget: 1,
      validateResult: (r) => Boolean(r && r.title && r.extract !== undefined)
    }
  );

  return data;
}
