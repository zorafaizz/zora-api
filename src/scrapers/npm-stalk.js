import axios from 'axios';
import { executeMultiProvider } from '../core/resilience.js';
import { ValidationError } from '../core/errors.js';

const NPM_UA = 'KanjutGedeAPI/2.0 (+https://itsfaiz.my.id)';

// Provider 1 (Tier 1): Official npmjs Registry + Downloads Point API
async function npmOfficialRegistry(pkgName, { signal, timeoutMs }) {
  const encodedPkg = pkgName.startsWith('@')
    ? `@${encodeURIComponent(pkgName.slice(1))}`
    : encodeURIComponent(pkgName);

  const [metaRes, dlRes] = await Promise.allSettled([
    axios.get(`https://registry.npmjs.org/${encodedPkg}`, {
      headers: { 'User-Agent': NPM_UA, Accept: 'application/json' },
      timeout: timeoutMs,
      signal
    }),
    axios.get(`https://api.npmjs.org/downloads/point/last-month/${encodedPkg}`, {
      headers: { 'User-Agent': NPM_UA, Accept: 'application/json' },
      timeout: Math.min(5000, timeoutMs),
      signal
    })
  ]);

  if (metaRes.status !== 'fulfilled' || !metaRes.value.data?.name) {
    throw new Error(`Package NPM "${pkgName}" tidak ditemukan di registry.npmjs.org`);
  }

  const d = metaRes.value.data;
  const latestVersion = d['dist-tags']?.latest || Object.keys(d.versions || {}).pop() || null;
  const latestMeta = latestVersion && d.versions?.[latestVersion] ? d.versions[latestVersion] : {};
  const downloadsLastMonth =
    dlRes.status === 'fulfilled' ? dlRes.value.data?.downloads ?? null : null;

  return {
    status: true,
    engine: 'npmjs Official Registry (Tier-1)',
    name: d.name,
    latest_version: latestVersion,
    description: d.description || latestMeta.description || '',
    license: d.license || latestMeta.license || null,
    homepage: d.homepage || latestMeta.homepage || `https://www.npmjs.com/package/${d.name}`,
    repository:
      (typeof d.repository === 'string' ? d.repository : d.repository?.url)?.replace(/^git\+/, '') ||
      null,
    author: typeof d.author === 'string' ? d.author : d.author?.name || null,
    maintainers: Array.isArray(d.maintainers) ? d.maintainers.map((m) => m.name) : [],
    keywords: Array.isArray(d.keywords) ? d.keywords : [],
    dependencies_count: Object.keys(latestMeta.dependencies || {}).length,
    unpacked_size_bytes: latestMeta.dist?.unpackedSize || null,
    tarball_url: latestMeta.dist?.tarball || null,
    downloads_last_month: downloadsLastMonth,
    published_at: (latestVersion && d.time?.[latestVersion]) || d.time?.modified || null,
    npm_url: `https://www.npmjs.com/package/${d.name}`
  };
}

// Provider 2 (Tier 2): npms.io v2 Package Intelligence API Fallback
async function npmsIoFallback(pkgName, { signal, timeoutMs }) {
  const res = await axios.get(`https://api.npms.io/v2/package/${encodeURIComponent(pkgName)}`, {
    headers: { 'User-Agent': NPM_UA, Accept: 'application/json' },
    timeout: timeoutMs,
    signal
  });

  const meta = res.data?.collected?.metadata;
  if (!meta?.name) throw new Error(`Package "${pkgName}" tidak ditemukan di npms.io`);

  return {
    status: true,
    engine: 'npms.io v2 API (Tier-2)',
    name: meta.name,
    latest_version: meta.version || null,
    description: meta.description || '',
    license: meta.license || null,
    homepage: meta.links?.homepage || meta.links?.npm || null,
    repository: meta.links?.repository || null,
    author: meta.author?.name || meta.publisher?.username || null,
    maintainers: Array.isArray(meta.maintainers) ? meta.maintainers.map((m) => m.username) : [],
    keywords: Array.isArray(meta.keywords) ? meta.keywords : [],
    dependencies_count: Object.keys(meta.dependencies || {}).length,
    unpacked_size_bytes: null,
    tarball_url: null,
    downloads_last_month: res.data?.collected?.npm?.downloads?.[1]?.count ?? null,
    published_at: meta.date || null,
    npm_url: meta.links?.npm || `https://www.npmjs.com/package/${meta.name}`
  };
}

export async function stalkNpm(pkg) {
  if (!pkg || typeof pkg !== 'string' || !pkg.trim()) {
    throw new ValidationError('Parameter pkg wajib diisi');
  }

  const cleanPkg = pkg.trim();
  if (!/^(?:@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/i.test(cleanPkg)) {
    throw new ValidationError('Nama package NPM tidak valid');
  }

  const { data } = await executeMultiProvider(
    'stalk.npm',
    [
      {
        id: 'npm_official_registry',
        failureDomain: 'registry.npmjs.org',
        tier: 1,
        timeoutMs: 8000,
        allowTransientRetry: true,
        fn: (ctx) => npmOfficialRegistry(cleanPkg, ctx)
      },
      {
        id: 'npm_npms_io',
        failureDomain: 'api.npms.io',
        tier: 2,
        timeoutMs: 8000,
        fn: (ctx) => npmsIoFallback(cleanPkg, ctx)
      }
    ],
    {
      totalDeadlineMs: 15000,
      retryBudget: 1,
      validateResult: (r) => Boolean(r && r.name && r.latest_version)
    }
  );

  return data;
}
