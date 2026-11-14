import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  executeMultiProvider,
  classifyProviderError,
  getProviderHealthSnapshot,
  resetResilienceState,
  CircuitBreaker
} from '../src/core/resilience.js';
import { AppError } from '../src/core/errors.js';
import { scrapePixeldrain } from '../src/scrapers/pixeldrain.js';
import { screenshotWeb, dnsLookup } from '../src/scrapers/network-tools.js';
import { scrapeAIO } from '../scrapers/aio.js';
import { scrapeTikTok } from '../scrapers/tiktok.js';
import { createOrFindAccount } from '../src/modules/account/account.service.js';
import {
  grantCredits,
  reserveCredits,
  releaseReservation,
  getWallet
} from '../src/modules/billing/ledger.service.js';
import { closeDb } from '../src/core/db.js';
import { closeRedis } from '../src/core/redis.js';

const ROOT_DIR = path.resolve(import.meta.dirname, '..');

test.after(async () => {
  await closeRedis();
  await closeDb();
});

test('Multi-Engine Provider Failover & Deadline Orchestration', async (t) => {
  t.beforeEach(() => {
    resetResilienceState();
  });

  await t.test('primary fails -> secondary succeeds with provider attribution', async () => {
    const calls = [];
    const out = await executeMultiProvider(
      'test.capability.fallback',
      [
        {
          id: 'prov_primary',
          failureDomain: 'alpha.example.test',
          timeoutMs: 1000,
          fn: async () => {
            calls.push('prov_primary');
            const err = new Error('HTTP 503 Service Unavailable');
            err.status = 503;
            throw err;
          }
        },
        {
          id: 'prov_secondary',
          failureDomain: 'beta.example.test',
          timeoutMs: 1000,
          fn: async () => {
            calls.push('prov_secondary');
            return { title: 'Recovered Media', download_url: 'https://cdn.example.test/video.mp4' };
          }
        }
      ],
      { totalDeadlineMs: 3000, retryBudget: 0 }
    );

    assert.deepEqual(calls, ['prov_primary', 'prov_secondary']);
    assert.equal(out.data.title, 'Recovered Media');
    assert.equal(out.provider, 'prov_secondary');
  });

  await t.test('primary times out -> secondary succeeds within remaining deadline', async () => {
    const start = Date.now();
    const out = await executeMultiProvider(
      'test.capability.timeout',
      [
        {
          id: 'slow_primary',
          failureDomain: 'slow.example.test',
          timeoutMs: 80,
          fn: async ({ signal }) =>
            new Promise((resolve, reject) => {
              const timer = setTimeout(() => resolve({ ok: true }), 2000);
              signal?.addEventListener('abort', () => {
                clearTimeout(timer);
                reject(new Error('Aborted due to timeout'));
              });
            })
        },
        {
          id: 'fast_secondary',
          failureDomain: 'fast.example.test',
          timeoutMs: 500,
          fn: async () => ({ ok: true, source: 'fast_secondary' })
        }
      ],
      { totalDeadlineMs: 1500, retryBudget: 0 }
    );

    const elapsed = Date.now() - start;
    assert.ok(elapsed < 1000, `Failover should complete quickly within budget, got ${elapsed}ms`);
    assert.equal(out.provider, 'fast_secondary');
    assert.equal(out.data.source, 'fast_secondary');
  });

  await t.test('all providers fail -> throws normalized error with safe message', async () => {
    await assert.rejects(
      async () => {
        await executeMultiProvider(
          'test.capability.allfail',
          [
            {
              id: 'dead_one',
              failureDomain: 'dead1.example.test',
              fn: async () => {
                throw new Error('Upstream 502 Bad Gateway');
              }
            },
            {
              id: 'dead_two',
              failureDomain: 'dead2.example.test',
              fn: async () => {
                throw new Error('Upstream 504 Gateway Timeout');
              }
            }
          ],
          { totalDeadlineMs: 2000, retryBudget: 0 }
        );
      },
      (err) => {
        assert.ok(err instanceof AppError);
        assert.equal(err.code, 'ALL_PROVIDERS_FAILED');
        return true;
      }
    );
  });

  await t.test('input/validation errors short-circuit immediately without retries or tripping breaker', async () => {
    let secondaryCalled = false;
    let primaryAttempts = 0;

    await assert.rejects(async () => {
      await executeMultiProvider(
        'test.capability.validation',
        [
          {
            id: 'val_primary',
            failureDomain: 'val1.example.test',
            retries: 2,
            fn: async () => {
              primaryAttempts += 1;
              throw new AppError('URL parameter is malformed', 400, 'VALIDATION_ERROR');
            }
          },
          {
            id: 'val_secondary',
            failureDomain: 'val2.example.test',
            fn: async () => {
              secondaryCalled = true;
              return { ok: true };
            }
          }
        ],
        { totalDeadlineMs: 3000, retryBudget: 2 }
      );
    });

    assert.equal(primaryAttempts, 1, 'Validation error must not waste retries');
    assert.equal(secondaryCalled, false, 'Caller validation error must not cascade to secondary provider');

    const snapshot = getProviderHealthSnapshot();
    const primarySnap = snapshot['val_primary'];
    assert.ok(primarySnap);
    assert.notEqual(primarySnap.circuitState, 'OPEN', 'Input validation errors must not open circuit breaker');
  });
});

test('Circuit Breaker, EWMA Health & Shared Failure Domain Isolation', async (t) => {
  t.beforeEach(() => {
    resetResilienceState();
  });

  await t.test('CircuitBreaker opens on failure threshold and transitions HALF_OPEN -> CLOSED on recovery', async () => {
    const breaker = new CircuitBreaker('unit_breaker', {
      failureThreshold: 2,
      resetTimeoutMs: 60
    });

    await assert.rejects(() => breaker.execute(async () => { throw new Error('fail 1'); }));
    await assert.rejects(() => breaker.execute(async () => { throw new Error('fail 2'); }));
    assert.equal(breaker.state, 'OPEN');

    await assert.rejects(() => breaker.execute(async () => ({ ok: true })));

    await new Promise((r) => setTimeout(r, 75));
    const res = await breaker.execute(async () => ({ recovered: true }));
    assert.equal(res.recovered, true);
    assert.equal(breaker.state, 'CLOSED');
  });

  await t.test('shared failureDomain skips sibling scraper on dead host and EWMA reranks healthier provider', async () => {
    let siblingCalled = false;

    const firstRun = await executeMultiProvider(
      'test.shared.domain',
      [
        {
          id: 'shared_a',
          failureDomain: 'dead-shared.example.test',
          fn: async () => {
            const e = new Error('HTTP 503');
            e.status = 503;
            throw e;
          }
        },
        {
          id: 'shared_b',
          failureDomain: 'dead-shared.example.test',
          fn: async () => {
            siblingCalled = true;
            return { ok: false };
          }
        },
        {
          id: 'independent_healthy',
          failureDomain: 'healthy.example.test',
          fn: async () => ({ ok: true })
        }
      ],
      { totalDeadlineMs: 2000, retryBudget: 0 }
    );

    assert.equal(siblingCalled, false, 'Sibling provider on dead failureDomain must be skipped in-flight');
    assert.ok(
      firstRun.skippedProviders.some(
        (s) => s.providerId === 'shared_b' && s.reason === 'FAILURE_DOMAIN_SKIPPED'
      )
    );
    assert.equal(firstRun.provider, 'independent_healthy');

    for (let i = 0; i < 2; i++) {
      await executeMultiProvider(
        'test.shared.domain',
        [
          {
            id: 'shared_a',
            failureDomain: 'dead-shared.example.test',
            fn: async () => {
              const e = new Error('HTTP 503');
              e.status = 503;
              throw e;
            }
          },
          {
            id: 'independent_healthy',
            failureDomain: 'healthy.example.test',
            fn: async () => ({ ok: true })
          }
        ],
        { totalDeadlineMs: 2000, retryBudget: 0 }
      );
    }

    const order = [];
    const nextRun = await executeMultiProvider(
      'test.shared.domain',
      [
        {
          id: 'shared_a',
          failureDomain: 'dead-shared.example.test',
          fn: async () => {
            order.push('shared_a');
            throw new Error('Still dead');
          }
        },
        {
          id: 'independent_healthy',
          failureDomain: 'healthy.example.test',
          fn: async () => {
            order.push('independent_healthy');
            return { ok: true };
          }
        }
      ],
      { totalDeadlineMs: 2000, retryBudget: 0 }
    );

    assert.equal(nextRun.data.ok, true);
    assert.equal(order[0], 'independent_healthy', 'EWMA health scoring must promote healthy provider ahead of failing provider');
  });

  await t.test('classifyProviderError distinguishes rate limit, timeout, validation, and upstream 5xx', () => {
    const e429 = Object.assign(new Error('Too Many Requests'), { status: 429 });
    assert.equal(classifyProviderError(e429), 'RATE_LIMIT');

    const e400 = new AppError('Invalid query', 400, 'VALIDATION_ERROR');
    assert.equal(classifyProviderError(e400), 'CLIENT_VALIDATION');

    const eTimeout = new Error('Request timed out after 5000ms');
    assert.equal(classifyProviderError(eTimeout), 'TIMEOUT');

    const e502 = Object.assign(new Error('Bad Gateway'), { status: 502 });
    assert.equal(classifyProviderError(e502), 'UPSTREAM_5XX');
  });
});

test('SSRF Guard, Staging Isolation, Discovery Artifacts & Billing Reservation Safety', async (t) => {
  await t.test('URL-accepting scrapers reject internal/loopback/metadata SSRF targets before network call', async () => {
    await assert.rejects(() => scrapePixeldrain('http://127.0.0.1/u/abcd1234'));
    await assert.rejects(() => screenshotWeb('http://169.254.169.254/latest/meta-data/'));
    await assert.rejects(() => scrapeAIO('http://localhost:6379/video'));
    await assert.rejects(() => scrapeTikTok('http://10.0.0.1/video/12345'));
    await assert.rejects(() => dnsLookup('invalid..domain', 'INVALID_RECORD'));
  });

  await t.test('production files never import from staging/ directory', () => {
    const dirsToCheck = ['scrapers', 'src'];
    const filesToCheck = [path.join(ROOT_DIR, 'server.js')];

    const walk = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.name.endsWith('.js') || entry.name.endsWith('.mjs')) filesToCheck.push(full);
      }
    };
    for (const d of dirsToCheck) walk(path.join(ROOT_DIR, d));

    for (const file of filesToCheck) {
      const content = fs.readFileSync(file, 'utf8');
      assert.ok(
        !/from\s+['"][^'"]*staging\//.test(content) && !/import\(['"][^'"]*staging\//.test(content),
        `Forbidden staging import found in production file: ${file}`
      );
    }
  });

  await t.test('all 6 scraper-discovery deliverables exist, validate structurally, and contain zero leaked secrets', () => {
    const discDir = path.join(ROOT_DIR, 'docs', 'scraper-discovery');
    const expected = [
      'inventory.json',
      'benchmarks.json',
      'report.md',
      'duplicates.md',
      'rejected.md',
      'provider-matrix.md'
    ];
    for (const fn of expected) {
      const p = path.join(discDir, fn);
      assert.ok(fs.existsSync(p), `Missing required artifact: ${fn}`);
      const raw = fs.readFileSync(p, 'utf8');
      assert.ok(raw.length > 200, `Artifact ${fn} is unexpectedly empty`);
      assert.ok(!/AIza[0-9A-Za-z\-_]{20,}/.test(raw), `Leaked Google API key in ${fn}`);
      assert.ok(!/ghp_[A-Za-z0-9]{20,}/.test(raw), `Leaked GitHub token in ${fn}`);
      assert.ok(!/sk-[A-Za-z0-9]{20,}/.test(raw), `Leaked secret key in ${fn}`);
    }

    const inv = JSON.parse(fs.readFileSync(path.join(discDir, 'inventory.json'), 'utf8'));
    assert.equal(inv.total_sources_inspected, 12);
    assert.equal(inv.candidates.length, 529);

    const bench = JSON.parse(fs.readFileSync(path.join(discDir, 'benchmarks.json'), 'utf8'));
    assert.ok(bench.benchmarks.length >= 70);
  });

  await t.test('failed upstream execution releases credit reservation without double-charging', async () => {
    const account = await createOrFindAccount(`resilience-ledger-${Date.now()}@itsfaiz.my.id`);
    await grantCredits(account.id, 50, 'topup', `TOPUP_${Date.now()}`, 'system', 'Resilience test grant');

    const reqId = `req_failover_${Date.now()}`;
    await reserveCredits(account.id, 10, reqId, 'tool.ssweb');

    let failed = false;
    try {
      await executeMultiProvider(
        'tool.ssweb.sim',
        [
          {
            id: 'sim_fail_1',
            failureDomain: 'sim1.example.test',
            fn: async () => {
              throw new Error('Upstream 502');
            }
          }
        ],
        { totalDeadlineMs: 1000, retryBudget: 0 }
      );
    } catch {
      failed = true;
      await releaseReservation(reqId, 'All upstream providers failed');
    }

    assert.equal(failed, true);
    const wallet = await getWallet(account.id);
    assert.equal(Number(wallet.balance_credits), 50, 'Full balance must be restored after upstream failure');
    assert.equal(Number(wallet.reserved_credits), 0, 'Reserved credits must return to zero');
  });
});
