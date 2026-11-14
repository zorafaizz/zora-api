import dns from 'node:dns/promises';
import net from 'node:net';
import crypto from 'node:crypto';
import { SSRFError } from './errors.js';

// Server-side pepper untuk hashing API Key
const DEFAULT_PEPPER = process.env.API_KEY_PEPPER || 'kanjutgede_api_production_pepper_secret_9998127391';

/**
 * Memeriksa apakah suatu IP adalah IP private / loopback / link-local / cloud metadata
 */
export function isPrivateOrReservedIP(ipStr) {
  if (!ipStr) return true;

  // Normalisasi IPv4-mapped IPv6 (::ffff:127.0.0.1 -> 127.0.0.1)
  let cleanIp = ipStr.toLowerCase();
  if (cleanIp.startsWith('::ffff:')) {
    cleanIp = cleanIp.slice(7);
  }

  // IPv4 Checks
  if (net.isIPv4(cleanIp)) {
    const parts = cleanIp.split('.').map(Number);
    const [a, b, c, d] = parts;

    // 0.0.0.0/8 (Current network)
    if (a === 0) return true;
    // 10.0.0.0/8 (Private)
    if (a === 10) return true;
    // 127.0.0.0/8 (Loopback)
    if (a === 127) return true;
    // 169.254.0.0/16 (Link Local & AWS/Cloud Metadata: 169.254.169.254)
    if (a === 169 && b === 254) return true;
    // 172.16.0.0/12 (Private: 172.16 - 172.31)
    if (a === 172 && b >= 16 && b <= 31) return true;
    // 192.168.0.0/16 (Private)
    if (a === 192 && b === 168) return true;
    // 100.64.0.0/10 (Carrier Grade NAT)
    if (a === 100 && b >= 64 && b <= 127) return true;
    // 224.0.0.0/4 (Multicast)
    if (a >= 224 && a <= 239) return true;
    // 240.0.0.0/4 (Reserved)
    if (a >= 240) return true;
    // 255.255.255.255 (Broadcast)
    if (a === 255 && b === 255 && c === 255 && d === 255) return true;

    return false;
  }

  // IPv6 Checks
  if (net.isIPv6(cleanIp)) {
    if (cleanIp === '::' || cleanIp === '::1') return true; // Loopback & Unspecified
    if (cleanIp.startsWith('fe80:')) return true; // Link-local
    if (cleanIp.startsWith('fc00:') || cleanIp.startsWith('fd00:')) return true; // Unique local (ULA)
    if (cleanIp.startsWith('ff00:')) return true; // Multicast
    return false;
  }

  return true;
}

/**
 * Validasi URL terhadap ancaman SSRF (Server-Side Request Forgery)
 */
export async function validateSSRF(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') {
    throw new SSRFError('URL tidak valid');
  }

  let parsed;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw new SSRFError('Format URL tidak valid');
  }

  // Hanya perbolehkan protokol http dan https
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new SSRFError(`Protokol ${parsed.protocol} dilarang`);
  }

  const hostname = parsed.hostname.toLowerCase();

  // Blokir nama host loopback / lokal langsung
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal')
  ) {
    throw new SSRFError(`Target host '${hostname}' dilarang`);
  }

  // Jika hostname adalah IP langsung
  if (net.isIP(hostname)) {
    if (isPrivateOrReservedIP(hostname)) {
      throw new SSRFError(`Target IP '${hostname}' dilarang oleh kebijakan SSRF`);
    }
    return parsed.toString();
  }

  // Lakukan resolusi DNS untuk memeriksa apakah domain mengarah ke IP privat (DNS Rebinding protection)
  try {
    const addresses = await dns.lookup(hostname, { all: true });
    if (!addresses || addresses.length === 0) {
      throw new SSRFError(`Domain '${hostname}' tidak dapat diselesaikan via DNS`);
    }

    for (const addr of addresses) {
      if (isPrivateOrReservedIP(addr.address)) {
        throw new SSRFError(`Domain '${hostname}' mengarah ke IP privat (${addr.address})`);
      }
    }
  } catch (err) {
    if (err instanceof SSRFError) throw err;
    throw new SSRFError(`Gagal memvalidasi DNS untuk host '${hostname}': ${err.message}`);
  }

  return parsed.toString();
}

/**
 * Validasi apakah suatu IP klien masuk dalam daftar CIDR allowlist
 */
export function isIpInAllowlist(clientIp, allowlist = []) {
  if (!allowlist || allowlist.length === 0) return true; // Kosong = bebas / nonaktif

  let cleanIp = clientIp;
  if (cleanIp.startsWith('::ffff:')) {
    cleanIp = cleanIp.slice(7);
  }

  for (const range of allowlist) {
    const trimmed = range.trim();
    if (trimmed === cleanIp) return true;

    // Sederhana CIDR IPv4 matching jika menggunakan format prefix /xx
    if (trimmed.includes('/') && net.isIPv4(cleanIp)) {
      const [subnet, bitsStr] = trimmed.split('/');
      const bits = parseInt(bitsStr, 10);
      if (net.isIPv4(subnet) && !isNaN(bits)) {
        const ipNum = ipToLong(cleanIp);
        const subnetNum = ipToLong(subnet);
        const mask = -1 << (32 - bits);
        if ((ipNum & mask) === (subnetNum & mask)) {
          return true;
        }
      }
    }
  }

  return false;
}

function ipToLong(ip) {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
}

/**
 * Generate Secure Token (CSPRNG)
 */
export function generateSecureToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Generate API Key Terstruktur
 * Format: zora_{live|test}_{publicId}_{secret}
 */
export function generateApiKey(type = 'live') {
  const prefix = type === 'test' ? 'zora_test' : 'zora_live';
  const publicId = crypto.randomBytes(6).toString('hex'); // 12 chars public identifier
  const secret = crypto.randomBytes(24).toString('hex'); // 48 chars secret (192 bits entropy)
  const fullKey = `${prefix}_${publicId}_${secret}`;
  const keyHash = hashApiKeySecret(secret);

  return {
    fullKey,
    publicId,
    keyType: type,
    keyHash
  };
}

/**
 * Hash API Key Secret menggunakan HMAC-SHA256 dengan server pepper
 */
export function hashApiKeySecret(secret, pepper = DEFAULT_PEPPER) {
  return crypto.createHmac('sha256', pepper).update(secret).digest('hex');
}

/**
 * Constant-time string comparison untuk mencegah timing attacks
 */
export function timingSafeEqualString(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
