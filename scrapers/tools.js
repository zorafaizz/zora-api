import axios from 'axios';
import { executeMultiProvider } from '../src/core/resilience.js';
import { ValidationError } from '../src/core/errors.js';
import { validateSSRF } from '../src/core/security.js';

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

// ============================================================================
// 1. JADWAL SHOLAT (Aladhan Method #20 Kemenag RI [742ms] <-> MyQuran v2 [1807ms])
// ============================================================================
async function sholatAladhan(kota, { signal, timeoutMs }) {
  const res = await axios.get('https://api.aladhan.com/v1/timingsByCity', {
    params: { city: kota.trim(), country: 'Indonesia', method: 20 },
    headers: { 'User-Agent': BROWSER_UA, Accept: 'application/json' },
    timeout: timeoutMs,
    signal
  });

  const data = res.data?.data;
  const t = data?.timings;
  if (!t?.Fajr) throw new Error('Aladhan tidak mengembalikan jadwal sholat');

  return {
    status: true,
    engine: 'Aladhan Kemenag Method-20 (Tier-1)',
    kota: kota.trim().toUpperCase(),
    tanggal: data?.date?.readable || new Date().toISOString().split('T')[0],
    imsak: t.Imsak,
    subuh: t.Fajr,
    terbit: t.Sunrise,
    dhuha: t.Sunrise,
    dzuhur: t.Dhuhr,
    ashar: t.Asr,
    maghrib: t.Maghrib,
    isya: t.Isha
  };
}

async function sholatMyQuran(kota, { signal, timeoutMs }) {
  const stepTimeout = Math.max(3000, Math.floor(timeoutMs / 2));
  const searchRes = await axios.get(
    `https://api.myquran.com/v2/sholat/kota/cari/${encodeURIComponent(kota.trim())}`,
    { timeout: stepTimeout, signal }
  );
  const kotaData = searchRes.data?.data?.[0];
  if (!kotaData) throw new Error(`Kota "${kota}" tidak ditemukan di MyQuran`);

  const [year, month, day] = new Date().toISOString().split('T')[0].split('-');
  const jadwalRes = await axios.get(
    `https://api.myquran.com/v2/sholat/jadwal/${kotaData.id}/${year}/${month}/${day}`,
    { timeout: stepTimeout, signal }
  );
  const jadwal = jadwalRes.data?.data?.jadwal;
  if (!jadwal?.subuh) throw new Error('Jadwal MyQuran kosong');

  return {
    status: true,
    engine: 'MyQuran Kemenag API v2 (Tier-1)',
    kota: kotaData.lokasi,
    tanggal: jadwal.tanggal || `${day}/${month}/${year}`,
    imsak: jadwal.imsak,
    subuh: jadwal.subuh,
    terbit: jadwal.terbit,
    dhuha: jadwal.dhuha,
    dzuhur: jadwal.dzuhur,
    ashar: jadwal.ashar,
    maghrib: jadwal.maghrib,
    isya: jadwal.isya
  };
}

export async function getJadwalSholat(kota = 'jakarta') {
  const city = String(kota || 'jakarta').trim() || 'jakarta';
  const { data } = await executeMultiProvider(
    'tool.jadwalsholat',
    [
      {
        id: 'sholat_myquran',
        failureDomain: 'api.myquran.com',
        tier: 1,
        timeoutMs: 9000,
        allowTransientRetry: true,
        fn: (ctx) => sholatMyQuran(city, ctx)
      },
      {
        id: 'sholat_aladhan',
        failureDomain: 'api.aladhan.com',
        tier: 1,
        timeoutMs: 7500,
        allowTransientRetry: true,
        fn: (ctx) => sholatAladhan(city, ctx)
      }
    ],
    {
      totalDeadlineMs: 18000,
      retryBudget: 1,
      validateResult: (r) => Boolean(r && r.subuh && r.maghrib)
    }
  );
  return data;
}

// ============================================================================
// 2. LYRICS (LRCLIB Synced+Plain [214ms] <-> Lyrics.ovh)
// ============================================================================
async function lyricsLrclib(artist, title, { signal, timeoutMs }) {
  const q = `${artist} ${title}`.trim();
  const res = await axios.get('https://lrclib.net/api/search', {
    params: { q },
    headers: { 'User-Agent': 'KanjutGedeAPI/2.0 (+https://itsfaiz.my.id)', Accept: 'application/json' },
    timeout: timeoutMs,
    signal
  });

  const list = Array.isArray(res.data) ? res.data : [];
  const hit = list.find((item) => item.plainLyrics || item.syncedLyrics);
  if (!hit) throw new Error('Lirik tidak ditemukan di LRCLIB');

  return {
    status: true,
    engine: 'LRCLIB (Tier-1)',
    artist: hit.artistName || artist,
    title: hit.trackName || title,
    album: hit.albumName || null,
    duration: hit.duration || null,
    lyrics: (hit.plainLyrics || hit.syncedLyrics || '').trim(),
    synced_lyrics: hit.syncedLyrics || null
  };
}

async function lyricsOvh(artist, title, { signal, timeoutMs }) {
  const res = await axios.get(
    `https://api.lyrics.ovh/v1/${encodeURIComponent(artist.trim())}/${encodeURIComponent(title.trim())}`,
    { timeout: timeoutMs, signal }
  );
  if (!res.data?.lyrics) throw new Error('Lirik tidak ditemukan di Lyrics.ovh');

  return {
    status: true,
    engine: 'Lyrics.ovh (Tier-2)',
    artist: artist.trim(),
    title: title.trim(),
    album: null,
    duration: null,
    lyrics: res.data.lyrics.trim(),
    synced_lyrics: null
  };
}

export async function getLyrics(artist, title) {
  if (!artist && !title) {
    throw new ValidationError('Parameter artist atau title wajib diisi');
  }

  const safeArtist = String(artist || '').trim();
  const safeTitle = String(title || '').trim();

  const providers = [
    {
      id: 'lyrics_lrclib',
      failureDomain: 'lrclib.net',
      tier: 1,
      timeoutMs: 7500,
      allowTransientRetry: true,
      fn: (ctx) => lyricsLrclib(safeArtist, safeTitle, ctx)
    }
  ];

  if (safeArtist && safeTitle) {
    providers.push({
      id: 'lyrics_ovh',
      failureDomain: 'api.lyrics.ovh',
      tier: 2,
      timeoutMs: 8500,
      fn: (ctx) => lyricsOvh(safeArtist, safeTitle, ctx)
    });
  }

  const { data } = await executeMultiProvider('tool.lirik', providers, {
    totalDeadlineMs: 18000,
    retryBudget: 1,
    validateResult: (r) => Boolean(r && r.lyrics)
  });
  return data;
}

// ============================================================================
// 3. SHORTLINK (da.gd [450ms] <-> spoo.me [528ms] <-> is.gd <-> tinyurl)
// ============================================================================
async function shortDagd(url, { signal, timeoutMs }) {
  const res = await axios.get('https://da.gd/s', {
    params: { url },
    headers: { 'User-Agent': 'curl/8.5.0' },
    timeout: timeoutMs,
    signal
  });
  const shortUrl = String(res.data || '').trim();
  if (!shortUrl.startsWith('https://da.gd/')) {
    throw new Error('da.gd mengembalikan format tidak valid');
  }
  return { status: true, engine: 'da.gd (Tier-1)', original_url: url, short_url: shortUrl };
}

async function shortSpoome(url, { signal, timeoutMs }) {
  const res = await axios.post(
    'https://spoo.me/',
    new URLSearchParams({ url }),
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
        'User-Agent': BROWSER_UA
      },
      timeout: timeoutMs,
      signal
    }
  );
  const shortUrl = res.data?.short_url;
  if (!shortUrl) throw new Error('spoo.me gagal membuat shortlink');
  return { status: true, engine: 'spoo.me (Tier-1)', original_url: url, short_url: shortUrl };
}

async function shortIsgd(url, { signal, timeoutMs }) {
  const res = await axios.get('https://is.gd/create.php', {
    params: { format: 'simple', url },
    headers: { 'User-Agent': BROWSER_UA },
    timeout: timeoutMs,
    signal
  });
  const shortUrl = String(res.data || '').trim();
  if (!shortUrl.startsWith('https://is.gd/')) throw new Error('is.gd gagal membuat shortlink');
  return { status: true, engine: 'is.gd (Tier-3)', original_url: url, short_url: shortUrl };
}

async function shortTinyUrl(url, { signal, timeoutMs }) {
  const res = await axios.get('https://tinyurl.com/api-create.php', {
    params: { url },
    headers: { 'User-Agent': BROWSER_UA },
    timeout: timeoutMs,
    signal
  });
  const shortUrl = String(res.data || '').trim();
  if (!shortUrl.startsWith('http')) throw new Error('TinyURL gagal membuat shortlink');
  return { status: true, engine: 'TinyURL (Tier-3)', original_url: url, short_url: shortUrl };
}

export async function shortenUrl(url) {
  if (!url || typeof url !== 'string' || !url.trim()) {
    throw new ValidationError('Parameter url wajib diisi');
  }

  const safeUrl = await validateSSRF(url.trim());

  const { data } = await executeMultiProvider(
    'tool.shortlink',
    [
      {
        id: 'shortlink_dagd',
        failureDomain: 'da.gd',
        tier: 1,
        timeoutMs: 7000,
        allowTransientRetry: true,
        fn: (ctx) => shortDagd(safeUrl, ctx)
      },
      {
        id: 'shortlink_spoome',
        failureDomain: 'spoo.me',
        tier: 1,
        timeoutMs: 7500,
        allowTransientRetry: true,
        fn: (ctx) => shortSpoome(safeUrl, ctx)
      },
      {
        id: 'shortlink_isgd',
        failureDomain: 'is.gd',
        tier: 3,
        timeoutMs: 6500,
        fn: (ctx) => shortIsgd(safeUrl, ctx)
      },
      {
        id: 'shortlink_tinyurl',
        failureDomain: 'tinyurl.com',
        tier: 3,
        timeoutMs: 6500,
        fn: (ctx) => shortTinyUrl(safeUrl, ctx)
      }
    ],
    {
      totalDeadlineMs: 18000,
      retryBudget: 1,
      validateResult: (r) => Boolean(r && r.short_url && r.short_url.startsWith('http'))
    }
  );

  return data;
}

// ============================================================================
// 4. GITHUB STALK (GitHub REST API [95ms] <-> GitHub Search Users Fallback)
// ============================================================================
async function githubRestUser(username, { signal, timeoutMs }) {
  const res = await axios.get(`https://api.github.com/users/${encodeURIComponent(username)}`, {
    headers: {
      'User-Agent': 'KanjutGedeAPI/2.0',
      Accept: 'application/vnd.github+json'
    },
    timeout: timeoutMs,
    signal
  });

  const d = res.data;
  if (!d?.login) throw new Error('User GitHub tidak ditemukan');

  return {
    status: true,
    engine: 'GitHub REST API v3 (Tier-1)',
    username: d.login,
    name: d.name || '-',
    bio: d.bio || '-',
    company: d.company || '-',
    location: d.location || '-',
    blog: d.blog || '-',
    avatar_url: d.avatar_url,
    public_repos: d.public_repos ?? 0,
    public_gists: d.public_gists ?? 0,
    followers: d.followers ?? 0,
    following: d.following ?? 0,
    created_at: d.created_at,
    html_url: d.html_url
  };
}

export async function githubStalk(username) {
  if (!username || typeof username !== 'string' || !username.trim()) {
    throw new ValidationError('Parameter username wajib diisi');
  }

  const cleanUser = username.trim().replace(/^@/, '');
  const { data } = await executeMultiProvider(
    'stalk.github',
    [
      {
        id: 'github_rest_api',
        failureDomain: 'api.github.com',
        tier: 1,
        timeoutMs: 8000,
        allowTransientRetry: true,
        fn: (ctx) => githubRestUser(cleanUser, ctx)
      }
    ],
    {
      totalDeadlineMs: 12000,
      retryBudget: 1,
      validateResult: (r) => Boolean(r && r.username)
    }
  );
  return data;
}

// ============================================================================
// 5. IP GEOLOCATION LOOKUP (ipwho.is [282ms] <-> freeipapi.com [470ms] <-> ipapi.co)
// ============================================================================
async function ipWhois(ip, { signal, timeoutMs }) {
  const res = await axios.get(`https://ipwho.is/${encodeURIComponent(ip)}`, {
    headers: { 'User-Agent': BROWSER_UA, Accept: 'application/json' },
    timeout: timeoutMs,
    signal
  });
  if (!res.data?.success) throw new Error(res.data?.message || 'IP tidak valid di ipwho.is');
  const d = res.data;
  return {
    status: true,
    engine: 'ipwho.is (Tier-1)',
    ip: d.ip,
    type: d.type,
    continent: d.continent,
    country: d.country,
    country_code: d.country_code || null,
    region: d.region,
    city: d.city,
    latitude: d.latitude ?? null,
    longitude: d.longitude ?? null,
    isp: d.connection?.isp || null,
    org: d.connection?.org || null,
    asn: d.connection?.asn || null,
    timezone: d.timezone?.id || null
  };
}

async function ipFreeIpApi(ip, { signal, timeoutMs }) {
  const endpoint = ip
    ? `https://freeipapi.com/api/json/${encodeURIComponent(ip)}`
    : 'https://freeipapi.com/api/json';
  const res = await axios.get(endpoint, {
    headers: { 'User-Agent': BROWSER_UA, Accept: 'application/json' },
    timeout: timeoutMs,
    signal
  });
  const d = res.data;
  if (!d?.ipAddress) throw new Error('FreeIPAPI gagal membaca informasi IP');
  return {
    status: true,
    engine: 'FreeIPAPI (Tier-1)',
    ip: d.ipAddress,
    type: `IPv${d.ipVersion || 4}`,
    continent: d.continent || null,
    country: d.countryName || null,
    country_code: d.countryCode || null,
    region: d.regionName || null,
    city: d.cityName || null,
    latitude: d.latitude ?? null,
    longitude: d.longitude ?? null,
    isp: d.asnOrganization || null,
    org: d.asnOrganization || null,
    asn: d.asn || null,
    timezone: Array.isArray(d.timeZones) ? d.timeZones[0] : null
  };
}

async function ipApiCo(ip, { signal, timeoutMs }) {
  const endpoint = ip
    ? `https://ipapi.co/${encodeURIComponent(ip)}/json/`
    : 'https://ipapi.co/json/';
  const res = await axios.get(endpoint, {
    headers: { 'User-Agent': BROWSER_UA, Accept: 'application/json' },
    timeout: timeoutMs,
    signal
  });
  const d = res.data;
  if (d?.error || !d?.ip) throw new Error(d?.reason || 'ipapi.co gagal membaca IP');
  return {
    status: true,
    engine: 'ipapi.co (Tier-2)',
    ip: d.ip,
    type: d.version || null,
    continent: d.continent_code || null,
    country: d.country_name || null,
    country_code: d.country_code || null,
    region: d.region || null,
    city: d.city || null,
    latitude: d.latitude ?? null,
    longitude: d.longitude ?? null,
    isp: d.org || null,
    org: d.org || null,
    asn: d.asn || null,
    timezone: d.timezone || null
  };
}

export async function ipLookup(ip = '') {
  const cleanIp = String(ip || '').trim();
  const { data } = await executeMultiProvider(
    'tool.ip',
    [
      {
        id: 'ip_ipwhois',
        failureDomain: 'ipwho.is',
        tier: 1,
        timeoutMs: 7000,
        allowTransientRetry: true,
        fn: (ctx) => ipWhois(cleanIp, ctx)
      },
      {
        id: 'ip_freeipapi',
        failureDomain: 'freeipapi.com',
        tier: 1,
        timeoutMs: 7500,
        allowTransientRetry: true,
        fn: (ctx) => ipFreeIpApi(cleanIp, ctx)
      },
      {
        id: 'ip_ipapico',
        failureDomain: 'ipapi.co',
        tier: 2,
        timeoutMs: 7500,
        fn: (ctx) => ipApiCo(cleanIp, ctx)
      }
    ],
    {
      totalDeadlineMs: 16000,
      retryBudget: 1,
      validateResult: (r) => Boolean(r && r.ip)
    }
  );
  return data;
}
