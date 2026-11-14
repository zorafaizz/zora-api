import { verifyApiKey } from '../modules/api-keys/api-keys.service.js';
import { findEndpointByPath } from '../registry/endpoints.js';
import { getClientIP } from './rate-limiter.js';
import { AuthError } from '../core/errors.js';

export function authMiddleware(req, res, next) {
  // Cek apakah endpoint adalah public (seperti /health)
  const endpoint = findEndpointByPath(req.path);
  if (endpoint && endpoint.scopes?.includes('public')) {
    return next();
  }

  // Ekstraksi API Key dari Header Bearer, X-API-Key, atau query parameter
  let rawKey = null;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    rawKey = authHeader.slice(7).trim();
  } else if (req.headers['x-api-key']) {
    rawKey = String(req.headers['x-api-key']).trim();
  } else if (req.query?.apikey) {
    rawKey = String(req.query.apikey).trim();
  }

  if (!rawKey) {
    // Mode dev / local tanpa key jika diizinkan atau reject dengan pesan informatif
    return res.sendError(new AuthError('Akses ditolak: API Key wajib disertakan via header Authorization: Bearer <key>'), 401);
  }

  const clientIp = getClientIP(req);

  verifyApiKey(rawKey, clientIp)
    .then(({ key, account }) => {
      req.apiKey = key;
      req.account = account;
      next();
    })
    .catch((err) => {
      res.sendError(err, err.statusCode || 401);
    });
}
