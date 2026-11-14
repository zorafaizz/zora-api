import axios from 'axios';
import { executeMultiProvider } from '../core/resilience.js';
import { ValidationError } from '../core/errors.js';

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

// Provider 1 (Tier 1): AniList GraphQL Manga Search (Benchmarked 525ms p50)
async function mangaAniList(query, { signal, timeoutMs }) {
  const gql = `
    query ($search: String) {
      Page(page: 1, perPage: 12) {
        media(search: $search, type: MANGA, sort: SEARCH_MATCH) {
          id
          idMal
          title { romaji english native }
          format
          chapters
          volumes
          status
          averageScore
          startDate { year }
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
  if (media.length === 0) throw new Error('Manga tidak ditemukan di AniList');

  const results = media.map((m) => ({
    id: m.id,
    mal_id: m.idMal || null,
    title: m.title?.romaji || m.title?.english || m.title?.native || '',
    title_english: m.title?.english || null,
    format: m.format || 'MANGA',
    chapters: m.chapters || null,
    volumes: m.volumes || null,
    status: m.status || null,
    score: m.averageScore ? Number((m.averageScore / 10).toFixed(2)) : null,
    year: m.startDate?.year || null,
    genres: Array.isArray(m.genres) ? m.genres : [],
    synopsis: m.description ? m.description.replace(/<[^>]+>/g, '').trim() : null,
    thumbnail: m.coverImage?.extraLarge || m.coverImage?.large || null,
    url: m.siteUrl
  }));

  return {
    status: true,
    engine: 'AniList GraphQL Manga (Tier-1)',
    query,
    total: results.length,
    results
  };
}

// Provider 2 (Tier 1): Kitsu Edge Manga API (Benchmarked 591ms p50)
async function mangaKitsu(query, { signal, timeoutMs }) {
  const res = await axios.get('https://kitsu.io/api/edge/manga', {
    params: { 'filter[text]': query.trim(), 'page[limit]': 12 },
    headers: { Accept: 'application/vnd.api+json', 'User-Agent': BROWSER_UA },
    timeout: timeoutMs,
    signal
  });

  const list = Array.isArray(res.data?.data) ? res.data.data : [];
  if (list.length === 0) throw new Error('Manga tidak ditemukan di Kitsu');

  const results = list.map((item) => {
    const a = item.attributes || {};
    return {
      id: item.id,
      mal_id: null,
      title: a.canonicalTitle || a.titles?.en_jp || a.titles?.en || '',
      title_english: a.titles?.en || null,
      format: (a.subtype || 'manga').toUpperCase(),
      chapters: a.chapterCount || null,
      volumes: a.volumeCount || null,
      status: a.status || null,
      score: a.averageRating ? Number((Number(a.averageRating) / 10).toFixed(2)) : null,
      year: a.startDate ? Number(a.startDate.slice(0, 4)) : null,
      genres: [],
      synopsis: a.synopsis || null,
      thumbnail: a.posterImage?.large || a.posterImage?.original || null,
      url: `https://kitsu.io/manga/${a.slug || item.id}`
    };
  });

  return {
    status: true,
    engine: 'Kitsu Edge Manga (Tier-1)',
    query,
    total: results.length,
    results
  };
}

export async function searchManga(query) {
  if (!query || typeof query !== 'string' || !query.trim()) {
    throw new ValidationError('Parameter query wajib diisi');
  }

  const { data } = await executeMultiProvider(
    'search.manga',
    [
      {
        id: 'manga_anilist',
        failureDomain: 'graphql.anilist.co',
        tier: 1,
        timeoutMs: 8000,
        allowTransientRetry: true,
        fn: (ctx) => mangaAniList(query.trim(), ctx)
      },
      {
        id: 'manga_kitsu',
        failureDomain: 'kitsu.io',
        tier: 1,
        timeoutMs: 8500,
        allowTransientRetry: true,
        fn: (ctx) => mangaKitsu(query.trim(), ctx)
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
