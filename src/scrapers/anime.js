import axios from 'axios';
import * as cheerio from 'cheerio';
import { executeMultiProvider } from '../core/resilience.js';
import { ValidationError } from '../core/errors.js';

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

// Provider 1 (Tier 1): AniList GraphQL Public API (Benchmarked 441ms p50)
async function animeAniList(query, { signal, timeoutMs }) {
  const gql = `
    query ($search: String) {
      Page(page: 1, perPage: 12) {
        media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
          id
          idMal
          title { romaji english native }
          format
          episodes
          status
          averageScore
          seasonYear
          genres
          description(asHtml: false)
          siteUrl
          coverImage { extraLarge large }
        }
      }
    }
  `;

  const res = await axios.post(
    'https://graphql.anilist.co',
    { query: gql, variables: { search: query.trim() } },
    {
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'User-Agent': BROWSER_UA },
      timeout: timeoutMs,
      signal
    }
  );

  const media = res.data?.data?.Page?.media || [];
  if (media.length === 0) throw new Error('Anime tidak ditemukan di AniList');

  const results = media.map((m) => ({
    id: m.id,
    mal_id: m.idMal || null,
    title: m.title?.romaji || m.title?.english || m.title?.native || '',
    title_english: m.title?.english || null,
    url: m.siteUrl,
    thumbnail: m.coverImage?.extraLarge || m.coverImage?.large || null,
    type: m.format || 'TV',
    episodes: m.episodes || null,
    status: m.status || null,
    score: m.averageScore ? Number((m.averageScore / 10).toFixed(2)) : null,
    released: m.seasonYear ? String(m.seasonYear) : null,
    genre: Array.isArray(m.genres) ? m.genres : [],
    synopsis: m.description ? m.description.replace(/<[^>]+>/g, '').trim() : null
  }));

  return {
    status: true,
    engine: 'AniList GraphQL (Tier-1)',
    query,
    total: results.length,
    anime: results
  };
}

// Provider 2 (Tier 1): Kitsu JSON:API Edge (Benchmarked 1111ms p50)
async function animeKitsu(query, { signal, timeoutMs }) {
  const res = await axios.get('https://kitsu.io/api/edge/anime', {
    params: { 'filter[text]': query.trim(), 'page[limit]': 12 },
    headers: { Accept: 'application/vnd.api+json', 'User-Agent': BROWSER_UA },
    timeout: timeoutMs,
    signal
  });

  const data = Array.isArray(res.data?.data) ? res.data.data : [];
  if (data.length === 0) throw new Error('Anime tidak ditemukan di Kitsu');

  const results = data.map((item) => {
    const a = item.attributes || {};
    return {
      id: item.id,
      mal_id: null,
      title: a.canonicalTitle || a.titles?.en_jp || a.titles?.en || '',
      title_english: a.titles?.en || null,
      url: `https://kitsu.io/anime/${a.slug || item.id}`,
      thumbnail: a.posterImage?.large || a.posterImage?.original || null,
      type: a.subtype || 'TV',
      episodes: a.episodeCount || null,
      status: a.status || null,
      score: a.averageRating ? Number((Number(a.averageRating) / 10).toFixed(2)) : null,
      released: a.startDate ? a.startDate.slice(0, 4) : null,
      genre: [],
      synopsis: a.synopsis || null
    };
  });

  return {
    status: true,
    engine: 'Kitsu Edge API (Tier-1)',
    query,
    total: results.length,
    anime: results
  };
}

// Provider 3 (Tier 2): Kusonime WordPress Scraper (Existing retained — Benchmarked 573ms p50)
async function animeKusonime(query, { signal, timeoutMs }) {
  const url = `https://kusonime.com/?s=${encodeURIComponent(query.trim())}`;
  const res = await axios.get(url, {
    headers: { 'User-Agent': BROWSER_UA },
    timeout: timeoutMs,
    signal
  });

  const $ = cheerio.load(res.data);
  const results = [];

  $('.venz > ul > .kover').each((_, el) => {
    const item = $(el);
    const title = item.find('.content h2 a').text().trim();
    const link = item.find('.content h2 a').attr('href');
    const thumb = item.find('.thumb img').attr('src') || item.find('.thumb img').attr('data-src');
    const released = item.find('.content p:has(i.fa-clock-o)').text().replace('Released on', '').trim();
    const genre = item
      .find('.content p:has(i.fa-tag) a')
      .map((__, g) => $(g).text().trim())
      .get();

    if (title && link) {
      results.push({
        title,
        url: link,
        thumbnail: thumb || null,
        released,
        genre
      });
    }
  });

  if (results.length === 0) throw new Error('Anime tidak ditemukan di Kusonime');

  return {
    status: true,
    engine: 'Kusonime ID (Tier-2)',
    query,
    total: results.length,
    anime: results
  };
}

export async function searchAnime(query) {
  if (!query || typeof query !== 'string' || !query.trim()) {
    throw new ValidationError('Parameter query wajib diisi');
  }

  const { data } = await executeMultiProvider(
    'search.anime',
    [
      {
        id: 'anime_anilist',
        failureDomain: 'graphql.anilist.co',
        tier: 1,
        timeoutMs: 8000,
        allowTransientRetry: true,
        fn: (ctx) => animeAniList(query.trim(), ctx)
      },
      {
        id: 'anime_kusonime',
        failureDomain: 'kusonime.com',
        tier: 1,
        timeoutMs: 8500,
        fn: (ctx) => animeKusonime(query.trim(), ctx)
      },
      {
        id: 'anime_kitsu',
        failureDomain: 'kitsu.io',
        tier: 2,
        timeoutMs: 9000,
        fn: (ctx) => animeKitsu(query.trim(), ctx)
      }
    ],
    {
      totalDeadlineMs: 18000,
      retryBudget: 1,
      validateResult: (r) => Boolean(r && Array.isArray(r.anime) && r.anime.length > 0)
    }
  );

  return data;
}
