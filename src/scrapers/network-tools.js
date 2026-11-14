import axios from 'axios';
import { executeMultiProvider } from '../core/resilience.js';
import { ValidationError } from '../core/errors.js';
import { validateSSRF } from '../core/security.js';

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

// ============================================================================
// 1. MULTI-PROVIDER TRANSLATOR (Google GTX [127ms] <-> MyMemory [335ms])
// ============================================================================
async function translateGoogleGtx(text, to, from, { signal, timeoutMs }) {
  const res = await axios.get('https://translate.googleapis.com/translate_a/single', {
    params: {
      client: 'gtx',
      sl: from || 'auto',
      tl: to || 'id',
      dt: 't',
      q: text
    },
    headers: { 'User-Agent': BROWSER_UA, Accept: 'application/json' },
    timeout: timeoutMs,
    signal
  });

  const segments = res.data?.[0];
  if (!Array.isArray(segments) || segments.length === 0) {
    throw new Error('Google GTX gagal menerjemahkan teks');
  }

  const translated = segments.map((s) => s?.[0] || '').join('');
  const detectedLang = res.data?.[2] || from || 'auto';

  return {
    status: true,
    engine: 'Google GTX Translator (Tier-1)',
    source_lang: detectedLang,
    target_lang: to || 'id',
    original_text: text,
    translated_text: translated
  };
}

async function translateMyMemory(text, to, from, { signal, timeoutMs }) {
  const srcLang = !from || from === 'auto' ? 'en' : from;
  const targetLang = to || 'id';
  const res = await axios.get('https://api.mymemory.translated.net/get', {
    params: { q: text, langpair: `${srcLang}|${targetLang}` },
    headers: { 'User-Agent': BROWSER_UA, Accept: 'application/json' },
    timeout: timeoutMs,
    signal
  });

  const translated = res.data?.responseData?.translatedText;
  if (!translated) {
    throw new Error('MyMemory gagal menerjemahkan teks');
  }

  return {
    status: true,
    engine: 'MyMemory Translation API (Tier-1)',
    source_lang: srcLang,
    target_lang: targetLang,
    original_text: text,
    translated_text: translated
  };
}

export async function translateText(text, to = 'id', from = 'auto') {
  if (!text || typeof text !== 'string' || !text.trim()) {
    throw new ValidationError('Parameter text wajib diisi');
  }

  const cleanText = text.trim().slice(0, 4000);
  const cleanTo = String(to || 'id').trim().toLowerCase() || 'id';
  const cleanFrom = String(from || 'auto').trim().toLowerCase() || 'auto';

  const { data } = await executeMultiProvider(
    'tool.translate',
    [
      {
        id: 'translate_google_gtx',
        failureDomain: 'translate.googleapis.com',
        tier: 1,
        timeoutMs: 7000,
        allowTransientRetry: true,
        fn: (ctx) => translateGoogleGtx(cleanText, cleanTo, cleanFrom, ctx)
      },
      {
        id: 'translate_mymemory',
        failureDomain: 'mymemory.translated.net',
        tier: 1,
        timeoutMs: 7500,
        allowTransientRetry: true,
        fn: (ctx) => translateMyMemory(cleanText, cleanTo, cleanFrom, ctx)
      }
    ],
    {
      totalDeadlineMs: 14000,
      retryBudget: 1,
      validateResult: (r) => Boolean(r && r.translated_text)
    }
  );

  return data;
}

// ============================================================================
// 2. DNS OVER HTTPS (DoH) RESOLVER (Cloudflare 1.1.1.1 [79ms] <-> Google 8.8.8.8 [78ms])
// ============================================================================
const ALLOWED_DNS_TYPES = new Set(['A', 'AAAA', 'CNAME', 'MX', 'NS', 'TXT', 'SOA', 'SRV', 'CAA', 'PTR']);

async function dnsCloudflareDoh(domain, recordType, { signal, timeoutMs }) {
  const res = await axios.get('https://cloudflare-dns.com/dns-query', {
    params: { name: domain, type: recordType },
    headers: { Accept: 'application/dns-json', 'User-Agent': 'KanjutGedeAPI/2.0' },
    timeout: timeoutMs,
    signal
  });

  const d = res.data;
  if (typeof d?.Status !== 'number') throw new Error('Respons Cloudflare DoH tidak valid');

  return {
    status: true,
    engine: 'Cloudflare DoH 1.1.1.1 (Tier-1)',
    domain,
    record_type: recordType,
    rcode: d.Status,
    dnssec_validated: Boolean(d.AD),
    answers: (d.Answer || []).map((a) => ({
      name: a.name,
      type: a.type,
      ttl: a.TTL,
      data: a.data
    })),
    authority: (d.Authority || []).map((a) => ({
      name: a.name,
      type: a.type,
      ttl: a.TTL,
      data: a.data
    }))
  };
}

async function dnsGoogleDoh(domain, recordType, { signal, timeoutMs }) {
  const res = await axios.get('https://dns.google/resolve', {
    params: { name: domain, type: recordType },
    headers: { Accept: 'application/dns-json', 'User-Agent': 'KanjutGedeAPI/2.0' },
    timeout: timeoutMs,
    signal
  });

  const d = res.data;
  if (typeof d?.Status !== 'number') throw new Error('Respons Google DoH tidak valid');

  return {
    status: true,
    engine: 'Google Public DNS 8.8.8.8 (Tier-1)',
    domain,
    record_type: recordType,
    rcode: d.Status,
    dnssec_validated: Boolean(d.AD),
    answers: (d.Answer || []).map((a) => ({
      name: a.name,
      type: a.type,
      ttl: a.TTL,
      data: a.data
    })),
    authority: (d.Authority || []).map((a) => ({
      name: a.name,
      type: a.type,
      ttl: a.TTL,
      data: a.data
    }))
  };
}

export async function dnsLookup(domain, type = 'A') {
  if (!domain || typeof domain !== 'string' || !domain.trim()) {
    throw new ValidationError('Parameter domain wajib diisi');
  }

  let cleanDomain = domain.trim().toLowerCase();
  if (cleanDomain.includes('://')) {
    try {
      cleanDomain = new URL(cleanDomain).hostname;
    } catch {}
  }
  cleanDomain = cleanDomain.replace(/\/.*$/, '');

  if (!/^[a-z0-9._-]+$/i.test(cleanDomain) || !cleanDomain.includes('.')) {
    throw new ValidationError('Format nama domain tidak valid');
  }

  const recordType = String(type || 'A').trim().toUpperCase();
  if (!ALLOWED_DNS_TYPES.has(recordType)) {
    throw new ValidationError(`Tipe record DNS tidak didukung (gunakan: ${[...ALLOWED_DNS_TYPES].join(', ')})`);
  }

  const { data } = await executeMultiProvider(
    'tool.dns',
    [
      {
        id: 'dns_cloudflare_doh',
        failureDomain: 'cloudflare-dns.com',
        tier: 1,
        timeoutMs: 6000,
        allowTransientRetry: true,
        fn: (ctx) => dnsCloudflareDoh(cleanDomain, recordType, ctx)
      },
      {
        id: 'dns_google_doh',
        failureDomain: 'dns.google',
        tier: 1,
        timeoutMs: 6000,
        allowTransientRetry: true,
        fn: (ctx) => dnsGoogleDoh(cleanDomain, recordType, ctx)
      }
    ],
    {
      totalDeadlineMs: 12000,
      retryBudget: 1,
      validateResult: (r) => Boolean(r && Array.isArray(r.answers))
    }
  );

  return data;
}

// ============================================================================
// 3. WEB SCREENSHOT CAPTURE (SSRF-Hardened: Thum.io [450ms] <-> WordPress mShots)
// ============================================================================
async function sswebThumIo(safeUrl, { signal, timeoutMs }) {
  const screenshotUrl = `https://image.thum.io/get/width/1280/crop/800/noanimate/${safeUrl}`;
  const res = await axios.get(screenshotUrl, {
    headers: { 'User-Agent': BROWSER_UA, Range: 'bytes=0-1023' },
    responseType: 'arraybuffer',
    timeout: timeoutMs,
    signal
  });

  const contentType = String(res.headers['content-type'] || '');
  if (!contentType.startsWith('image/') && res.status !== 200 && res.status !== 206) {
    throw new Error('Thum.io tidak mengembalikan stream gambar');
  }

  return {
    status: true,
    engine: 'Thum.io Render Engine (Tier-1)',
    target_url: safeUrl,
    viewport: '1280x800',
    mime_type: contentType || 'image/png',
    screenshot_url: screenshotUrl
  };
}

async function sswebWpMshots(safeUrl, { signal, timeoutMs }) {
  const screenshotUrl = `https://s0.wordpress.com/mshots/v1/${encodeURIComponent(safeUrl)}?w=1280&h=800`;
  const res = await axios.head(screenshotUrl, {
    headers: { 'User-Agent': BROWSER_UA },
    maxRedirects: 5,
    timeout: timeoutMs,
    signal
  });

  if (res.status >= 400) {
    throw new Error(`WordPress mShots mengembalikan HTTP ${res.status}`);
  }

  return {
    status: true,
    engine: 'WordPress mShots Renderer (Tier-1)',
    target_url: safeUrl,
    viewport: '1280x800',
    mime_type: 'image/jpeg',
    screenshot_url: screenshotUrl
  };
}

export async function screenshotWeb(url) {
  if (!url || typeof url !== 'string' || !url.trim()) {
    throw new ValidationError('Parameter url wajib diisi');
  }

  let normalized = url.trim();
  if (!/^https?:\/\//i.test(normalized)) {
    normalized = `https://${normalized}`;
  }

  // Mandatory SSRF verification before forwarding URL to external renderers
  const safeUrl = await validateSSRF(normalized);

  const { data } = await executeMultiProvider(
    'tool.ssweb',
    [
      {
        id: 'ssweb_thumio',
        failureDomain: 'image.thum.io',
        tier: 1,
        timeoutMs: 8500,
        allowTransientRetry: true,
        fn: (ctx) => sswebThumIo(safeUrl, ctx)
      },
      {
        id: 'ssweb_wp_mshots',
        failureDomain: 's0.wordpress.com',
        tier: 1,
        timeoutMs: 8500,
        fn: (ctx) => sswebWpMshots(safeUrl, ctx)
      }
    ],
    {
      totalDeadlineMs: 16000,
      retryBudget: 1,
      validateResult: (r) => Boolean(r && r.screenshot_url)
    }
  );

  return data;
}
