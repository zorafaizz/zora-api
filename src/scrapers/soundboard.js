import axios from 'axios';
import * as cheerio from 'cheerio';
import { executeMultiProvider } from '../core/resilience.js';
import { ValidationError } from '../core/errors.js';

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

// Provider 1 (Tier 1): MyInstants Soundboard MP3 Extractor (Benchmarked 627ms p50)
async function myInstantsSearch(query, { signal, timeoutMs }) {
  const res = await axios.get('https://www.myinstants.com/en/search/', {
    params: { name: query.trim() },
    headers: { 'User-Agent': BROWSER_UA, Accept: 'text/html' },
    timeout: timeoutMs,
    signal
  });

  const $ = cheerio.load(res.data);
  const results = [];

  $('.instant').each((_, el) => {
    const node = $(el);
    const titleEl = node.find('.instant-link');
    const title = titleEl.text().trim();
    const href = titleEl.attr('href');
    const onclick = node.find('button.small-button').attr('onclick') || '';
    const mp3Match = onclick.match(/play\('([^']+\.mp3)'/);

    if (title && mp3Match?.[1]) {
      const mp3Path = mp3Match[1];
      results.push({
        title,
        mp3_url: mp3Path.startsWith('http') ? mp3Path : `https://www.myinstants.com${mp3Path}`,
        page_url: href ? `https://www.myinstants.com${href}` : null
      });
    }
  });

  if (results.length === 0) {
    throw new Error('Efek suara / meme audio tidak ditemukan di MyInstants');
  }

  return {
    status: true,
    engine: 'MyInstants Soundboard (Tier-1)',
    query,
    total: results.length,
    results: results.slice(0, 20)
  };
}

// Provider 2 (Tier 2): Internet Archive Audio Effects Search Fallback
async function archiveAudioFallback(query, { signal, timeoutMs }) {
  const res = await axios.get('https://archive.org/advancedsearch.php', {
    params: {
      q: `(${query.trim()}) AND mediatype:(audio)`,
      fl: ['identifier', 'title', 'creator'],
      rows: 10,
      page: 1,
      output: 'json'
    },
    headers: { 'User-Agent': BROWSER_UA, Accept: 'application/json' },
    timeout: timeoutMs,
    signal
  });

  const docs = res.data?.response?.docs || [];
  if (docs.length === 0) {
    throw new Error('Audio tidak ditemukan di arsip publik');
  }

  const results = docs.map((d) => ({
    title: d.title || d.identifier,
    mp3_url: `https://archive.org/download/${encodeURIComponent(d.identifier)}`,
    page_url: `https://archive.org/details/${encodeURIComponent(d.identifier)}`
  }));

  return {
    status: true,
    engine: 'Internet Archive Audio (Tier-2)',
    query,
    total: results.length,
    results
  };
}

export async function searchSoundboard(query) {
  if (!query || typeof query !== 'string' || !query.trim()) {
    throw new ValidationError('Parameter query wajib diisi');
  }

  const { data } = await executeMultiProvider(
    'search.soundboard',
    [
      {
        id: 'soundboard_myinstants',
        failureDomain: 'myinstants.com',
        tier: 1,
        timeoutMs: 8500,
        allowTransientRetry: true,
        fn: (ctx) => myInstantsSearch(query.trim(), ctx)
      },
      {
        id: 'soundboard_archive_org',
        failureDomain: 'archive.org',
        tier: 2,
        timeoutMs: 8500,
        fn: (ctx) => archiveAudioFallback(query.trim(), ctx)
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
