import crypto from 'node:crypto';

export function requestIdMiddleware(req, res, next) {
  const existingId = req.headers['x-request-id'];
  const requestId = (typeof existingId === 'string' && existingId.length > 5)
    ? existingId
    : crypto.randomUUID();

  req.id = requestId;
  req._startTime = Date.now();
  res.setHeader('X-Request-ID', requestId);
  next();
}
