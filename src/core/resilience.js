import { ProviderError } from './errors.js';
import { logger } from './logger.js';

export class CircuitBreaker {
  constructor(name, options = {}) {
    this.name = name;
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeoutMs = options.resetTimeoutMs || 30000;
    this.state = 'CLOSED'; // 'CLOSED', 'OPEN', 'HALF_OPEN'
    this.failureCount = 0;
    this.nextAttempt = Date.now();
  }

  async execute(actionFn) {
    if (this.state === 'OPEN') {
      if (Date.now() > this.nextAttempt) {
        this.state = 'HALF_OPEN';
        logger.info({ circuit: this.name }, '[CIRCUIT] Moving from OPEN to HALF_OPEN probe');
      } else {
        throw new ProviderError(`Provider '${this.name}' sedang dalam status circuit OPEN (cooldown)`, this.name);
      }
    }

    try {
      const result = await actionFn();
      if (this.state === 'HALF_OPEN') {
        this.state = 'CLOSED';
        this.failureCount = 0;
        logger.info({ circuit: this.name }, '[CIRCUIT] Probe succeeded. Resetting to CLOSED');
      }
      return result;
    } catch (err) {
      this.failureCount++;
      if (this.failureCount >= this.failureThreshold || this.state === 'HALF_OPEN') {
        this.state = 'OPEN';
        this.nextAttempt = Date.now() + this.resetTimeoutMs;
        logger.warn(
          { circuit: this.name, failures: this.failureCount, nextAttemptIn: this.resetTimeoutMs },
          '[CIRCUIT] Threshold reached. Tripping circuit to OPEN'
        );
      }
      throw err;
    }
  }
}

/**
 * Eksekusi fungsi dengan batas waktu (deadline) terjamin
 */
export async function withDeadline(actionFn, timeoutMs = 15000, contextName = 'operation') {
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(new ProviderError(`Operasi '${contextName}' melampaui batas waktu ${timeoutMs}ms`, contextName));
    }, timeoutMs);
  });

  try {
    return await Promise.race([actionFn(), timeoutPromise]);
  } finally {
    clearTimeout(timer);
  }
}
