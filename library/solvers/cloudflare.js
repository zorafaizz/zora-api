import axios from 'axios';

const FLARESOLVERR_URL = process.env.FLARESOLVERR_URL || 'http://127.0.0.1:8191/v1';

/**
 * REVERSE ENGINEERED FROM TurnstileX (bycf.izzcs.my.id)
 * Menggunakan local headless solver engine (FlareSolverr v3.5.2)
 */
export async function solveCloudflareWAF(targetUrl, timeoutMs = 45000) {
  if (!targetUrl) throw new Error('Parameter url target wajib diisi');

  try {
    const payload = {
      cmd: 'request.get',
      url: targetUrl.trim(),
      maxTimeout: timeoutMs
    };

    const res = await axios.post(FLARESOLVERR_URL, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: timeoutMs + 5000
    });

    const data = res.data?.solution;
    if (!data) throw new Error(res.data?.message || 'Gagal memecahkan proteksi WAF');

    // Filter cookie cf_clearance
    const cfClearance = data.cookies?.find(c => c.name === 'cf_clearance')?.value || null;

    return {
      status: true,
      engine: 'TurnstileX / FlareSolverr Engine',
      target_url: targetUrl,
      cf_clearance: cfClearance,
      user_agent: data.userAgent,
      cookies: data.cookies,
      headers: {
        'User-Agent': data.userAgent,
        Cookie: data.cookies.map(c => `${c.name}=${c.value}`).join('; ')
      }
    };
  } catch (err) {
    throw new Error(`Cloudflare WAF Solver Error: ${err.message}`);
  }
}

export async function solveTurnstileToken(targetUrl, siteKey, timeoutMs = 45000) {
  if (!targetUrl) throw new Error('Parameter url target wajib diisi');

  // Request token melewati rendering challenge
  const res = await solveCloudflareWAF(targetUrl, timeoutMs);
  return {
    status: true,
    engine: 'Turnstile Token Extractor',
    target_url: targetUrl,
    sitekey: siteKey || '-',
    cf_clearance: res.cf_clearance,
    headers: res.headers
  };
}
