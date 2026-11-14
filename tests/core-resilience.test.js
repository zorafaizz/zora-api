import test from 'node:test';
import assert from 'node:assert/strict';
import { validateSSRF, isPrivateOrReservedIP, isIpInAllowlist, generateApiKey, hashApiKeySecret } from '../src/core/security.js';
import { CircuitBreaker, withDeadline } from '../src/core/resilience.js';
import { getOrSetCache, invalidateCache } from '../src/core/cache.js';
import { closeRedis } from '../src/core/redis.js';

test.after(async () => {
  await closeRedis();
});

test('Security & SSRF Protection Tests', async (t) => {
  await t.test('isPrivateOrReservedIP correctly identifies dangerous IPs', () => {
    assert.equal(isPrivateOrReservedIP('127.0.0.1'), true, 'Loopback must be blocked');
    assert.equal(isPrivateOrReservedIP('10.0.0.5'), true, '10.x must be blocked');
    assert.equal(isPrivateOrReservedIP('172.16.0.1'), true, '172.16.x must be blocked');
    assert.equal(isPrivateOrReservedIP('192.168.1.1'), true, '192.168.x must be blocked');
    assert.equal(isPrivateOrReservedIP('169.254.169.254'), true, 'AWS metadata must be blocked');
    assert.equal(isPrivateOrReservedIP('::1'), true, 'IPv6 loopback must be blocked');
    assert.equal(isPrivateOrReservedIP('8.8.8.8'), false, 'Google DNS is public');
    assert.equal(isPrivateOrReservedIP('1.1.1.1'), false, 'Cloudflare DNS is public');
  });

  await t.test('validateSSRF blocks localhost and internal addresses', async () => {
    await assert.rejects(async () => {
      await validateSSRF('http://localhost:3095/health');
    }, /dilarang|SSRF/);

    await assert.rejects(async () => {
      await validateSSRF('http://127.0.0.1:8191/v1');
    }, /dilarang|SSRF/);

    await assert.rejects(async () => {
      await validateSSRF('http://169.254.169.254/latest/meta-data/');
    }, /dilarang|SSRF/);

    await assert.rejects(async () => {
      await validateSSRF('ftp://example.com/test');
    }, /Protokol|dilarang/);
  });

  await t.test('isIpInAllowlist works correctly', () => {
    const allowlist = ['192.168.1.0/24', '10.5.0.1'];
    assert.equal(isIpInAllowlist('192.168.1.50', allowlist), true);
    assert.equal(isIpInAllowlist('10.5.0.1', allowlist), true);
    assert.equal(isIpInAllowlist('192.168.2.1', allowlist), false);
    assert.equal(isIpInAllowlist('8.8.8.8', []), true, 'Empty allowlist permits all');
  });

  await t.test('generateApiKey generates structured keys and valid hashes', () => {
    const live = generateApiKey('live');
    assert.ok(live.fullKey.startsWith('zora_live_'));
    assert.equal(typeof live.keyHash, 'string');
    assert.equal(live.keyHash.length, 64); // SHA-256 hex length

    const testKey = generateApiKey('test');
    assert.ok(testKey.fullKey.startsWith('zora_test_'));
    assert.equal(testKey.keyType, 'test');
  });
});

test('Resilience & Circuit Breaker Tests', async (t) => {
  await t.test('CircuitBreaker trips to OPEN after threshold failures', async () => {
    const cb = new CircuitBreaker('test-service', { failureThreshold: 3, resetTimeoutMs: 100 });

    let callCount = 0;
    const failingFn = async () => {
      callCount++;
      throw new Error('Service down');
    };

    // 3 Failures
    await assert.rejects(() => cb.execute(failingFn));
    await assert.rejects(() => cb.execute(failingFn));
    await assert.rejects(() => cb.execute(failingFn));

    assert.equal(cb.state, 'OPEN');

    // Call 4 should be rejected by circuit breaker immediately without running failingFn
    await assert.rejects(() => cb.execute(failingFn), /circuit OPEN/);
    assert.equal(callCount, 3, 'failingFn should not have been called when OPEN');
  });

  await t.test('withDeadline times out if function exceeds limit', async () => {
    const slowFn = () => new Promise(resolve => setTimeout(resolve, 300));
    await assert.rejects(() => withDeadline(slowFn, 50, 'slow-job'), /melampaui batas waktu/);

    const fastFn = async () => 'success';
    const result = await withDeadline(fastFn, 500, 'fast-job');
    assert.equal(result, 'success');
  });
});

test('Cache System Tests', async (t) => {
  await t.test('getOrSetCache caches responses and prevents stampede', async () => {
    const cacheKey = `test:item:${Date.now()}`;
    let executions = 0;

    const fetcher = async () => {
      executions++;
      return { data: 'test_value', time: Date.now() };
    };

    // First call
    const res1 = await getOrSetCache(cacheKey, 60, fetcher);
    assert.equal(executions, 1);
    assert.equal(res1.data, 'test_value');

    // Second call should come from cache without running fetcher
    const res2 = await getOrSetCache(cacheKey, 60, fetcher);
    assert.equal(executions, 1, 'Fetcher must not be called again');
    assert.equal(res2.data, 'test_value');

    await invalidateCache(cacheKey);
  });
});
