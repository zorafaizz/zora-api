export class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details = null) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message, details = null) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

export class AuthError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403, 'FORBIDDEN');
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404, 'NOT_FOUND');
  }
}

export class QuotaExceededError extends AppError {
  constructor(message = 'Quota limit reached') {
    super(message, 429, 'QUOTA_EXCEEDED');
  }
}

export class PaymentRequiredError extends AppError {
  constructor(message = 'Insufficient credit balance for this endpoint') {
    super(message, 402, 'PAYMENT_REQUIRED');
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Too many requests, please slow down') {
    super(message, 429, 'RATE_LIMIT_EXCEEDED');
  }
}

export class SSRFError extends AppError {
  constructor(message = 'Target destination forbidden (SSRF policy)') {
    super(message, 400, 'SSRF_BLOCKED');
  }
}

export class ProviderError extends AppError {
  constructor(message, provider = 'upstream', originalError = null) {
    super(message, 502, 'UPSTREAM_PROVIDER_ERROR', { provider, originalMessage: originalError?.message });
  }
}
