import { AppError } from './errors.js';

const DEFAULT_EWMA_ALPHA = 0.3;
const DEFAULT_CB_FAILURE_THRESHOLD = 4;
const DEFAULT_CB_COOLDOWN_MS = 30_000;
const DEFAULT_BULKHEAD_CONCURRENCY = 12;

// Internal registries for circuit breakers, provider health/EWMA, and bulkheads
const circuitStore = new Map();
const healthStore = new Map();
const bulkheadStore = new Map();

/**
 * Classify an error into standardized operational failure classes.
 * Used for retry eligibility, circuit breaker accounting, and failure-domain skipping.
 */
export function classifyProviderError(err) {
  if (!err) return 'UNKNOWN';
  const code = String(err.errorCode || err.code || '').toUpperCase();
  const status = Number(err.statusCode || err.status || 0);
  const msg = String(err.message || '').toLowerCase();

  if (status === 400 || status === 422 || code === 'VALIDATION_ERROR' || code === 'SSRF_BLOCKED') {
    return 'CLIENT_VALIDATION';
  }
  if (status === 404 && !msg.includes('upstream')) {
    return 'NOT_FOUND';
  }
  if (code === 'UPSTREAM_TIMEOUT' || code === 'ETIMEDOUT' || code === 'ABORT_ERR' || msg.includes('timed out') || msg.includes('timeout')) {
    return 'TIMEOUT';
  }
  if (status === 429 || msg.includes('rate limit') || msg.includes('too many requests')) {
    return 'RATE_LIMIT';
  }
  if (status === 403 && (msg.includes('cloudflare') || msg.includes('challenge') || msg.includes('just a moment') || msg.includes('captcha') || msg.includes('forbidden'))) {
    return 'ANTI_BOT';
  }
  if (status === 401 || status === 403) {
    return 'AUTH_FORBIDDEN';
  }
  if (
    code === 'ENOTFOUND' ||
    code === 'ECONNREFUSED' ||
    code === 'ECONNRESET' ||
    code === 'EAI_AGAIN' ||
    msg.includes('fetch failed') ||
    msg.includes('network') ||
    msg.includes('socket hang up')
  ) {
    return 'NETWORK_FAILURE';
  }
  if (status >= 500 && status <= 599) {
    return 'UPSTREAM_5XX';
  }
  if (msg.includes('json') || msg.includes('unexpected token') || msg.includes('schema') || msg.includes('empty')) {
    return 'SCHEMA_DRIFT';
  }
  return 'UPSTREAM_ERROR';
}

/**
 * Returns true if the failure class indicates that the entire upstream failureDomain
 * is unreachable, rate-limiting our IP, or throwing anti-bot challenges, meaning
 * other providers sharing the exact same failureDomain should be skipped in this request.
 */
export function isDomainWideFailure(failureClass) {
  return (
    failureClass === 'TIMEOUT' ||
    failureClass === 'RATE_LIMIT' ||
    failureClass === 'ANTI_BOT' ||
    failureClass === 'NETWORK_FAILURE' ||
    failureClass === 'UPSTREAM_5XX'
  );
}

/**
 * Returns true if a transient retry on the same provider is worthwhile within the retry budget.
 */
export function isTransientRetryable(failureClass) {
  return failureClass === 'TIMEOUT' || failureClass === 'NETWORK_FAILURE' || failureClass === 'UPSTREAM_5XX';
}

/**
 * Execute an async function with an explicit deadline and AbortController signal.
 */
export async function withTimeout(fn, timeoutMs = 15000, label = 'Upstream provider', parentSignal = null) {
  if (parentSignal?.aborted) {
    throw new AppError(`${label} aborted because request deadline expired`, 504, 'UPSTREAM_TIMEOUT');
  }

  const controller = new AbortController();
  let timer;
  const onParentAbort = () => controller.abort(parentSignal.reason || new Error('Parent deadline exceeded'));
  if (parentSignal) {
    parentSignal.addEventListener('abort', onParentAbort, { once: true });
  }

  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const timeoutErr = new AppError(`Operasi ${label} melampaui batas waktu (${timeoutMs}ms)`, 504, 'UPSTREAM_TIMEOUT');
      controller.abort(timeoutErr);
      reject(timeoutErr);
    }, timeoutMs);
  });

  try {
    return await Promise.race([
      Promise.resolve().then(() => fn({ signal: controller.signal, timeoutMs })),
      timeoutPromise
    ]);
  } finally {
    clearTimeout(timer);
    if (parentSignal) {
      parentSignal.removeEventListener('abort', onParentAbort);
    }
  }
}

/**
 * Backward-compatible alias for withTimeout used across scrapers and core-resilience tests.
 */
export async function withDeadline(fn, timeoutMs = 15000, label = 'operation', parentSignal = null) {
  return withTimeout(fn, timeoutMs, label, parentSignal);
}

/**
 * Legacy-compatible single-function resilience wrapper with retries + timeout + backoff.
 */
export async function executeWithResilience(fn, options = {}) {
  const {
    timeoutMs = 15000,
    retries = 1,
    retryDelayMs = 350,
    useJitter = false,
    label = 'Provider',
    signal = null
  } = options;

  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await withTimeout((ctx) => fn(ctx), timeoutMs, label, signal);
    } catch (err) {
      lastError = err;
      // Never retry client validation / SSRF / 4xx non-429 errors
      if (err instanceof AppError && err.statusCode >= 400 && err.statusCode < 500 && err.statusCode !== 429) {
        throw err;
      }
      if (attempt < retries) {
        const expDelay = retryDelayMs * Math.pow(2, attempt);
        const sleepMs = useJitter ? Math.max(10, Math.round(Math.random() * expDelay)) : retryDelayMs * (attempt + 1);
        await new Promise((r) => setTimeout(r, sleepMs));
      }
    }
  }

  if (lastError instanceof AppError) throw lastError;
  throw new AppError(lastError?.message || `${label} failed`, 502, 'UPSTREAM_FAILURE');
}

/**
 * Semaphore-based bulkhead concurrency limiter.
 */
export function createBulkhead(maxConcurrent = DEFAULT_BULKHEAD_CONCURRENCY) {
  let active = 0;
  const queue = [];

  const next = () => {
    if (active < maxConcurrent && queue.length > 0) {
      active++;
      const { fn, resolve, reject } = queue.shift();
      Promise.resolve()
        .then(fn)
        .then(resolve, reject)
        .finally(() => {
          active--;
          next();
        });
    }
  };

  return function runInBulkhead(fn) {
    return new Promise((resolve, reject) => {
      queue.push({ fn, resolve, reject });
      next();
    });
  };
}

function getOrCreateBulkhead(key, maxConcurrent = DEFAULT_BULKHEAD_CONCURRENCY) {
  const normalizedKey = `${key}:${maxConcurrent}`;
  if (!bulkheadStore.has(normalizedKey)) {
    bulkheadStore.set(normalizedKey, createBulkhead(maxConcurrent));
  }
  return bulkheadStore.get(normalizedKey);
}

/**
 * Circuit Breaker state management per provider ID.
 * States: CLOSED -> OPEN -> HALF_OPEN -> CLOSED
 */
export function getCircuitState(providerId, options = {}) {
  const cooldownMs = options.cooldownMs ?? DEFAULT_CB_COOLDOWN_MS;
  let entry = circuitStore.get(providerId);
  if (!entry) {
    entry = {
      state: 'CLOSED',
      consecutiveFailures: 0,
      openedAt: 0,
      halfOpenProbeInFlight: false,
      cooldownMs
    };
    circuitStore.set(providerId, entry);
  }

  if (entry.state === 'OPEN') {
    const now = Date.now();
    if (now - entry.openedAt >= (options.cooldownMs ?? entry.cooldownMs ?? DEFAULT_CB_COOLDOWN_MS)) {
      entry.state = 'HALF_OPEN';
      entry.halfOpenProbeInFlight = false;
    }
  }
  return entry;
}

function canAttemptCircuit(providerId, options = {}) {
  const entry = getCircuitState(providerId, options);
  if (entry.state === 'CLOSED') return { allowed: true, state: 'CLOSED' };
  if (entry.state === 'OPEN') return { allowed: false, state: 'OPEN' };
  if (entry.state === 'HALF_OPEN') {
    if (entry.halfOpenProbeInFlight) {
      return { allowed: false, state: 'HALF_OPEN_BUSY' };
    }
    entry.halfOpenProbeInFlight = true;
    return { allowed: true, state: 'HALF_OPEN' };
  }
  return { allowed: true, state: entry.state };
}

function recordProviderSuccess(providerId, latencyMs, meta = {}) {
  const cb = getCircuitState(providerId);
  cb.state = 'CLOSED';
  cb.consecutiveFailures = 0;
  cb.openedAt = 0;
  cb.halfOpenProbeInFlight = false;

  const now = Date.now();
  const prev = healthStore.get(providerId);
  const alpha = DEFAULT_EWMA_ALPHA;
  const ewmaLatencyMs = prev?.ewmaLatencyMs != null
    ? Math.round(alpha * latencyMs + (1 - alpha) * prev.ewmaLatencyMs)
    : latencyMs;

  const successCount = (prev?.successCount || 0) + 1;
  const failureCount = prev?.failureCount || 0;
  const total = successCount + failureCount;

  healthStore.set(providerId, {
    providerId,
    capability: meta.capability || prev?.capability || 'unknown',
    failureDomain: meta.failureDomain || prev?.failureDomain || providerId,
    ewmaLatencyMs,
    lastLatencyMs: latencyMs,
    successCount,
    failureCount,
    successRate: Number((successCount / total).toFixed(4)),
    lastFailureClass: prev?.lastFailureClass || null,
    lastSuccessAt: now,
    lastFailureAt: prev?.lastFailureAt || null
  });
}

function recordProviderFailure(providerId, latencyMs, failureClass, options = {}) {
  const threshold = options.failureThreshold ?? DEFAULT_CB_FAILURE_THRESHOLD;
  const cooldownMs = options.cooldownMs ?? DEFAULT_CB_COOLDOWN_MS;
  const cb = getCircuitState(providerId, { cooldownMs });
  cb.halfOpenProbeInFlight = false;

  // Client validation errors should never trip an upstream provider's circuit breaker
  if (failureClass !== 'CLIENT_VALIDATION') {
    cb.consecutiveFailures += 1;
    if (cb.state === 'HALF_OPEN' || cb.consecutiveFailures >= threshold) {
      cb.state = 'OPEN';
      cb.openedAt = Date.now();
      cb.cooldownMs = cooldownMs;
    }
  }

  const now = Date.now();
  const prev = healthStore.get(providerId);
  const successCount = prev?.successCount || 0;
  const failureCount = (prev?.failureCount || 0) + (failureClass === 'CLIENT_VALIDATION' ? 0 : 1);
  const total = Math.max(1, successCount + failureCount);

  healthStore.set(providerId, {
    providerId,
    capability: options.capability || prev?.capability || 'unknown',
    failureDomain: options.failureDomain || prev?.failureDomain || providerId,
    ewmaLatencyMs: prev?.ewmaLatencyMs ?? latencyMs,
    lastLatencyMs: latencyMs,
    successCount,
    failureCount,
    successRate: Number((successCount / total).toFixed(4)),
    lastFailureClass: failureClass,
    lastSuccessAt: prev?.lastSuccessAt || null,
    lastFailureAt: now
  });
}

/**
 * Compute adaptive routing score for a provider (higher is better).
 * Respects configured tier priority while promoting faster, healthier providers
 * and demoting degraded providers automatically.
 */
export function computeProviderScore(provider, index = 0) {
  const tier = Number(provider.tier ?? 1);
  const health = healthStore.get(provider.id);
  const cb = getCircuitState(provider.id, provider);

  // Base score separated per tier, but severe health drops (>60% failures) allow next-tier promotion
  let score = 1000 - (tier - 1) * 180 - index * 5;

  if (cb.state === 'HALF_OPEN') {
    score -= 220;
  }

  if (health) {
    const samples = health.successCount + health.failureCount;
    const reliabilityWeight = Math.min(1, samples / 3);
    // Reward high success rate (+100 max), penalize heavy failure rate (-300 max)
    const reliabilityDelta = (health.successRate - 0.75) * 400 * reliabilityWeight;
    score += reliabilityDelta;

    // Latency adjustment: fast (<300ms) gets small boost, slow (>2500ms) gets penalty up to -120
    if (health.ewmaLatencyMs != null) {
      const latencyPenalty = Math.min(120, Math.max(-25, (health.ewmaLatencyMs - 400) / 25));
      score -= latencyPenalty;
    }
  }

  return Number(score.toFixed(2));
}

/**
 * Order candidate providers adaptively by tier, health score, and EWMA latency.
 */
export function rankProviders(providers = []) {
  return providers
    .map((p, idx) => ({ provider: p, idx, score: computeProviderScore(p, idx) }))
    .sort((a, b) => b.score - a.score || a.idx - b.idx)
    .map((entry) => entry.provider);
}

/**
 * Execute a multi-provider fallback chain with:
 * - Adaptive health + EWMA latency routing
 * - Per-provider Circuit Breakers (CLOSED / OPEN / HALF_OPEN)
 * - Failure-Domain Skipping (avoids hitting distinct scrapers that share a dead upstream domain)
 * - Shared Retry Budget + Exponential Backoff with Full Jitter
 * - Total Request Deadline Propagation + AbortSignal
 * - Per-Provider Bulkhead Concurrency Isolation
 */
export async function executeMultiProvider(capability, providers, options = {}) {
  if (!Array.isArray(providers) || providers.length === 0) {
    throw new AppError(`No providers configured for capability ${capability}`, 500, 'NO_PROVIDERS');
  }

  const {
    totalDeadlineMs = 20_000,
    retryBudget = 1,
    baseBackoffMs = 180,
    validateResult = null,
    adaptiveRouting = true
  } = options;

  const requestStartedAt = Date.now();
  let remainingRetries = Math.max(0, Number(retryBudget));
  const failedDomains = new Set();
  const attempts = [];
  const skippedProviders = [];

  const ordered = adaptiveRouting ? rankProviders(providers) : [...providers];
  let lastError = null;

  for (const provider of ordered) {
    const providerId = provider.id || provider.name || `${capability}-anon`;
    const failureDomain = (provider.failureDomain || providerId).toLowerCase();
    const elapsedTotal = Date.now() - requestStartedAt;
    const remainingDeadlineMs = totalDeadlineMs - elapsedTotal;

    if (remainingDeadlineMs <= 80) {
      skippedProviders.push({ providerId, failureDomain, reason: 'DEADLINE_EXHAUSTED' });
      break;
    }

    // Skip duplicate failure domain if an earlier provider already proved the upstream domain is down/blocking
    if (failedDomains.has(failureDomain)) {
      skippedProviders.push({ providerId, failureDomain, reason: 'FAILURE_DOMAIN_SKIPPED' });
      continue;
    }

    const cbDecision = canAttemptCircuit(providerId, provider);
    if (!cbDecision.allowed) {
      skippedProviders.push({ providerId, failureDomain, reason: `CIRCUIT_${cbDecision.state}` });
      continue;
    }

    const bulkhead = getOrCreateBulkhead(
      provider.bulkheadKey || failureDomain,
      provider.maxConcurrent || DEFAULT_BULKHEAD_CONCURRENCY
    );

    const maxProviderTries = provider.retries != null
      ? Math.min(provider.retries, remainingRetries)
      : (provider.allowTransientRetry ? Math.min(1, remainingRetries) : 0);

    for (let tryIdx = 0; tryIdx <= maxProviderTries; tryIdx++) {
      const nowRemaining = totalDeadlineMs - (Date.now() - requestStartedAt);
      if (nowRemaining <= 60) {
        if (cbDecision.state === 'HALF_OPEN') {
          getCircuitState(providerId).halfOpenProbeInFlight = false;
        }
        break;
      }

      const effectiveTimeoutMs = Math.max(60, Math.min(provider.timeoutMs || 10_000, nowRemaining));
      const t0 = Date.now();

      try {
        const result = await bulkhead(() =>
          withTimeout(
            (ctx) => provider.fn({ ...ctx, providerId, failureDomain, capability }),
            effectiveTimeoutMs,
            `${capability}:${providerId}`
          )
        );

        if (typeof validateResult === 'function' && !validateResult(result)) {
          throw new AppError(`Provider ${providerId} returned incomplete schema`, 502, 'SCHEMA_VALIDATION_FAILED');
        }
        if (result === null || result === undefined) {
          throw new AppError(`Provider ${providerId} returned empty payload`, 502, 'EMPTY_UPSTREAM_PAYLOAD');
        }

        const latencyMs = Date.now() - t0;
        recordProviderSuccess(providerId, latencyMs, { capability, failureDomain });
        attempts.push({ providerId, failureDomain, attempt: tryIdx + 1, ok: true, latencyMs });

        return {
          data: result,
          provider: providerId,
          tier: provider.tier ?? 1,
          failureDomain,
          latencyMs,
          totalElapsedMs: Date.now() - requestStartedAt,
          attempts,
          skippedProviders
        };
      } catch (err) {
        const latencyMs = Date.now() - t0;
        const failureClass = classifyProviderError(err);
        lastError = err;

        recordProviderFailure(providerId, latencyMs, failureClass, {
          capability,
          failureDomain,
          failureThreshold: provider.failureThreshold,
          cooldownMs: provider.cooldownMs
        });

        attempts.push({
          providerId,
          failureDomain,
          attempt: tryIdx + 1,
          ok: false,
          latencyMs,
          failureClass,
          message: err?.message || String(err)
        });

        // Immediately propagate client input/SSRF validation errors without wasting fallback calls
        if (failureClass === 'CLIENT_VALIDATION') {
          throw err;
        }

        const canRetrySameProvider =
          tryIdx < maxProviderTries &&
          remainingRetries > 0 &&
          isTransientRetryable(failureClass) &&
          totalDeadlineMs - (Date.now() - requestStartedAt) > baseBackoffMs * 2;

        if (canRetrySameProvider) {
          remainingRetries -= 1;
          const cap = baseBackoffMs * Math.pow(2, tryIdx);
          const jitterDelay = Math.max(15, Math.round(Math.random() * cap));
          await new Promise((r) => setTimeout(r, jitterDelay));
          continue;
        }

        if (isDomainWideFailure(failureClass)) {
          failedDomains.add(failureDomain);
        }
        break;
      }
    }
  }

  if (lastError instanceof AppError) {
    throw lastError;
  }

  const summary = attempts.map((a) => `${a.providerId}(${a.failureClass})`).join(', ') || 'all circuits open or deadline exceeded';
  throw new AppError(
    lastError?.message || `All providers failed for ${capability}: ${summary}`,
    502,
    'ALL_PROVIDERS_FAILED'
  );
}

/**
 * Snapshot internal provider health, EWMA latency, and circuit states for observability & tests.
 */
export function getProviderHealthSnapshot() {
  const providers = {};
  const allIds = new Set([...healthStore.keys(), ...circuitStore.keys()]);
  for (const id of allIds) {
    const h = healthStore.get(id) || null;
    const cb = getCircuitState(id);
    providers[id] = {
      circuitState: cb.state,
      consecutiveFailures: cb.consecutiveFailures,
      ewmaLatencyMs: h?.ewmaLatencyMs ?? null,
      lastLatencyMs: h?.lastLatencyMs ?? null,
      successCount: h?.successCount ?? 0,
      failureCount: h?.failureCount ?? 0,
      successRate: h?.successRate ?? null,
      failureDomain: h?.failureDomain ?? null,
      capability: h?.capability ?? null,
      lastFailureClass: h?.lastFailureClass ?? null
    };
  }
  return providers;
}

/**
 * Object-oriented CircuitBreaker wrapper backed by the central circuit & EWMA health store.
 * Preserves 100% compatibility with existing CircuitBreaker(name, { failureThreshold, resetTimeoutMs }) callers.
 */
export class CircuitBreaker {
  constructor(name, options = {}) {
    this.name = name;
    this.failureThreshold = options.failureThreshold ?? DEFAULT_CB_FAILURE_THRESHOLD;
    this.resetTimeoutMs = options.resetTimeoutMs ?? options.cooldownMs ?? DEFAULT_CB_COOLDOWN_MS;
    // Initialize entry in central store
    const entry = getCircuitState(this.name, { cooldownMs: this.resetTimeoutMs });
    entry.cooldownMs = this.resetTimeoutMs;
  }

  get state() {
    return getCircuitState(this.name, { cooldownMs: this.resetTimeoutMs }).state;
  }

  async execute(fn) {
    const decision = canAttemptCircuit(this.name, { cooldownMs: this.resetTimeoutMs });
    if (!decision.allowed) {
      throw new AppError(
        `Layanan ${this.name} ditolak sementara karena circuit OPEN (${decision.state})`,
        503,
        'CIRCUIT_OPEN'
      );
    }

    const t0 = Date.now();
    try {
      const res = await fn();
      recordProviderSuccess(this.name, Date.now() - t0, { failureDomain: this.name });
      return res;
    } catch (err) {
      const failureClass = classifyProviderError(err);
      recordProviderFailure(this.name, Date.now() - t0, failureClass, {
        failureDomain: this.name,
        failureThreshold: this.failureThreshold,
        cooldownMs: this.resetTimeoutMs
      });
      throw err;
    }
  }

  reset() {
    circuitStore.delete(this.name);
  }
}

/**
 * Reset in-memory resilience metrics & circuit states (primarily for isolated deterministic tests).
 */
export function resetResilienceState() {
  circuitStore.clear();
  healthStore.clear();
  bulkheadStore.clear();
}
