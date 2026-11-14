import pino from 'pino';

const isProduction = process.env.NODE_ENV === 'production';

export const logger = pino({
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers["x-api-key"]',
      'req.headers.cookie',
      'headers.authorization',
      'headers.cookie',
      'authorization',
      'apiKey',
      'api_key',
      'secret',
      'password',
      'token',
      'access_token',
      'refresh_token',
      '*.password',
      '*.secret',
      '*.apiKey',
      '*.api_key'
    ],
    censor: '[REDACTED]'
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  base: {
    app: 'kanjutgede-api',
    pid: process.pid
  }
});
