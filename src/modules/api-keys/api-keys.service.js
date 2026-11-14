import { query } from '../../core/db.js';
import { generateApiKey, hashApiKeySecret, timingSafeEqualString, isIpInAllowlist } from '../../core/security.js';
import { AuthError, ForbiddenError, NotFoundError } from '../../core/errors.js';
import { logger } from '../../core/logger.js';

export async function createApiKey(accountId, type = 'live', label = 'Default Key', ipAllowlist = [], scopes = ['*']) {
  const generated = generateApiKey(type);

  const res = await query(
    `INSERT INTO api_keys (account_id, public_id, key_hash, key_type, label, ip_allowlist, scopes)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, account_id, public_id, key_type, label, ip_allowlist, scopes, created_at`,
    [
      accountId,
      generated.publicId,
      generated.keyHash,
      type,
      label,
      JSON.stringify(ipAllowlist || []),
      JSON.stringify(scopes || ['*'])
    ]
  );

  const keyRecord = res.rows[0];
  logger.info({ keyId: keyRecord.id, accountId, publicId: generated.publicId, type }, '[API-KEY] Key created');

  return {
    ...keyRecord,
    keyType: keyRecord.key_type,
    rawKey: generated.fullKey // Hanya diungkap SATU KALI saat pembuatan
  };
}

export async function verifyApiKey(rawKeyString, clientIp = '127.0.0.1') {
  if (!rawKeyString || typeof rawKeyString !== 'string') {
    throw new AuthError('API Key tidak disediakan');
  }

  const parts = rawKeyString.trim().split('_');
  // Format: zora_{live|test}_{publicId}_{secret}
  if (parts.length !== 4 || parts[0] !== 'zora' || !['live', 'test'].includes(parts[1])) {
    throw new AuthError('Format API Key tidak valid');
  }

  const publicId = parts[2];
  const secret = parts[3];
  const incomingHash = hashApiKeySecret(secret);

  // Ambil record berdasarkan publicId untuk mencegah timing attack
  const res = await query(
    `SELECT k.*, a.email, a.role, a.is_frozen, a.last_live_activity_at, a.test_quota_remaining
     FROM api_keys k
     JOIN accounts a ON a.id = k.account_id
     WHERE k.public_id = $1`,
    [publicId]
  );

  if (res.rowCount === 0) {
    throw new AuthError('API Key tidak valid');
  }

  const record = res.rows[0];

  // Constant-time check hash
  if (!timingSafeEqualString(record.key_hash, incomingHash)) {
    throw new AuthError('API Key tidak valid');
  }

  if (record.is_revoked) {
    throw new ForbiddenError('API Key telah dicabut (revoked)');
  }

  if (record.expires_at && new Date(record.expires_at).getTime() < Date.now()) {
    throw new ForbiddenError('API Key telah kadaluarsa');
  }

  // Cek IP Allowlist
  const allowlist = Array.isArray(record.ip_allowlist) ? record.ip_allowlist : [];
  if (allowlist.length > 0 && !isIpInAllowlist(clientIp, allowlist)) {
    logger.warn({ keyId: record.id, clientIp, allowlist }, '[API-KEY] Rejected by IP allowlist CIDR');
    throw new ForbiddenError(`Akses dari IP '${clientIp}' tidak diizinkan oleh allowlist key ini`);
  }

  // Update last_used_at secara asynchronous (non-blocking)
  query('UPDATE api_keys SET last_used_at = NOW() WHERE id = $1', [record.id]).catch(() => {});

  return {
    key: {
      id: record.id,
      publicId: record.public_id,
      keyType: record.key_type,
      label: record.label,
      scopes: record.scopes
    },
    account: {
      id: record.account_id,
      email: record.email,
      role: record.role,
      isFrozen: record.is_frozen,
      lastLiveActivityAt: record.last_live_activity_at,
      testQuotaRemaining: record.test_quota_remaining
    }
  };
}

export async function listApiKeys(accountId) {
  const res = await query(
    `SELECT id, public_id, key_type, label, ip_allowlist, scopes, is_revoked, expires_at, last_used_at, created_at
     FROM api_keys
     WHERE account_id = $1
     ORDER BY created_at DESC`,
    [accountId]
  );
  return res.rows;
}

export async function revokeApiKey(keyId, accountId) {
  const res = await query(
    `UPDATE api_keys
     SET is_revoked = TRUE
     WHERE id = $1 AND account_id = $2
     RETURNING id, public_id, is_revoked`,
    [keyId, accountId]
  );
  if (res.rowCount === 0) {
    throw new NotFoundError('API Key tidak ditemukan atau bukan milik akun ini');
  }
  logger.info({ keyId, accountId }, '[API-KEY] Key revoked');
  return res.rows[0];
}
