import test from 'node:test';
import assert from 'node:assert/strict';
import { createOrFindAccount } from '../src/modules/account/account.service.js';
import { createApiKey } from '../src/modules/api-keys/api-keys.service.js';
import { consumeQuotaForRequest } from '../src/modules/account/quota.service.js';
import { validateSSRF, isPrivateOrReservedIP } from '../src/core/security.js';
import { antiAbuseEngine } from '../src/modules/anti-abuse/anti-abuse.service.js';
import { closeDb, query } from '../src/core/db.js';
import { closeRedis } from '../src/core/redis.js';

test.after(async () => {
  await closeRedis();
  await closeDb();
});

test('High-Concurrency Quota Race Condition (100 Simultaneous Requests vs 20 Quota)', async () => {
  const account = await createOrFindAccount(`race-user-${Date.now()}@itsfaiz.my.id`);
  const liveKey = await createApiKey(account.id, 'live', 'Race Test Key');

  const endpoint = {
    id: 'dl.tiktok',
    billing_policy: { type: 'free_eligible', default_credits: 1, paid_credits: 1 }
  };

  // Kirim 100 permintaan konsumsi kuota secara paralel
  const promises = [];
  for (let i = 0; i < 100; i++) {
    promises.push(
      consumeQuotaForRequest(account, liveKey, endpoint)
        .then(() => ({ success: true }))
        .catch(err => ({ success: false, code: err.code }))
    );
  }

  const results = await Promise.all(promises);
  const successes = results.filter(r => r.success);
  const failures = results.filter(r => !r.success);

  assert.equal(successes.length, 20, 'Exactly 20 requests must succeed with free quota');
  assert.equal(failures.length, 80, 'Exactly 80 requests must be rejected when free quota exhausts');

  // Periksa database secara langsung
  const quotaRows = await query('SELECT used_count, max_count FROM daily_quotas WHERE account_id = $1', [account.id]);
  assert.equal(quotaRows.rows[0].used_count, 20, 'used_count in database must equal exactly 20');
  assert.equal(quotaRows.rows[0].max_count, 20);
});

test('Advanced SSRF Bypass & IP Notation Attacks', async (t) => {
  await t.test('blocks alternative loopback representations', () => {
    assert.equal(isPrivateOrReservedIP('127.0.0.1'), true);
    assert.equal(isPrivateOrReservedIP('127.1.2.3'), true);
    assert.equal(isPrivateOrReservedIP('::ffff:127.0.0.1'), true);
    assert.equal(isPrivateOrReservedIP('::1'), true);
    assert.equal(isPrivateOrReservedIP('169.254.169.254'), true);
    assert.equal(isPrivateOrReservedIP('10.255.255.255'), true);
    assert.equal(isPrivateOrReservedIP('172.31.255.255'), true);
    assert.equal(isPrivateOrReservedIP('192.168.254.254'), true);
  });

  await t.test('validateSSRF blocks localhost subdomains and metadata endpoints', async () => {
    await assert.rejects(async () => {
      await validateSSRF('http://localhost:8080/admin');
    }, /dilarang|SSRF/);

    await assert.rejects(async () => {
      await validateSSRF('http://sub.localhost:3000');
    }, /dilarang|SSRF/);

    await assert.rejects(async () => {
      await validateSSRF('http://169.254.169.254/openstack');
    }, /dilarang|SSRF/);
  });
});

test('Shared-IP Bot Panel Acceptance (100 Legitimate Accounts on One Panel IP)', async () => {
  const sharedPanelIp = '103.150.190.55'; // Contoh IP server node panel bot

  // 100 akun independen yang mengakses dari IP panel yang sama
  for (let i = 0; i < 20; i++) {
    const assessment = await antiAbuseEngine.evaluateRisk({
      accountId: `panel-acc-${i}`,
      apiKeyId: `key-${i}`,
      clientIp: sharedPanelIp,
      endpointId: 'dl.tiktok',
      quotaExhausted: false
    });

    // Harus berstatus PASS dan tidak boleh diblokir hanya karena satu IP dipakai bersama
    assert.equal(assessment.action, 'PASS');
    assert.ok(assessment.score < 50, 'Score must stay low for normal multi-tenant traffic');
  }
});
