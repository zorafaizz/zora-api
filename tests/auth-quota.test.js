import test from 'node:test';
import assert from 'node:assert/strict';
import { createOrFindAccount, reactivateFreeBenefit, evaluateAccountInactivity } from '../src/modules/account/account.service.js';
import { createApiKey, verifyApiKey, revokeApiKey } from '../src/modules/api-keys/api-keys.service.js';
import { consumeQuotaForRequest } from '../src/modules/account/quota.service.js';
import { closeDb, query } from '../src/core/db.js';
import { closeRedis } from '../src/core/redis.js';

test.after(async () => {
  await closeRedis();
  await closeDb();
});

test('Account & API Key Lifecycle Tests', async (t) => {
  const testEmail = `test-user-${Date.now()}@itsfaiz.my.id`;
  let account;
  let liveKey;
  let testKey;

  await t.test('createOrFindAccount initializes account and wallet', async () => {
    account = await createOrFindAccount(testEmail);
    assert.ok(account.id, 'Account ID must exist');
    assert.equal(account.email, testEmail);
    assert.equal(account.test_quota_remaining, 50, 'Must start with 50 test quota');

    const wallet = await query('SELECT * FROM wallets WHERE account_id = $1', [account.id]);
    assert.equal(wallet.rowCount, 1, 'Wallet must be automatically created');
    assert.equal(wallet.rows[0].balance_credits, '0', 'Initial wallet balance 0');
  });

  await t.test('createApiKey creates live and test keys', async () => {
    liveKey = await createApiKey(account.id, 'live', 'My Production Key', ['192.168.1.0/24']);
    assert.ok(liveKey.rawKey.startsWith('zora_live_'));

    testKey = await createApiKey(account.id, 'test', 'My Sandbox Key');
    assert.ok(testKey.rawKey.startsWith('zora_test_'));
  });

  await t.test('verifyApiKey succeeds with valid key and allowed IP', async () => {
    const verified = await verifyApiKey(liveKey.rawKey, '192.168.1.45');
    assert.equal(verified.key.id, liveKey.id);
    assert.equal(verified.account.email, testEmail);
  });

  await t.test('verifyApiKey rejects unauthorized IP when allowlist is set', async () => {
    await assert.rejects(async () => {
      await verifyApiKey(liveKey.rawKey, '10.0.0.1');
    }, /allowlist/);
  });

  await t.test('revokeApiKey disables key immediately', async () => {
    await revokeApiKey(liveKey.id, account.id);
    await assert.rejects(async () => {
      await verifyApiKey(liveKey.rawKey, '192.168.1.45');
    }, /revoked/);
  });
});

test('Quota Rules & Inactivity Enforcement Tests', async (t) => {
  const quotaUserEmail = `quota-user-${Date.now()}@itsfaiz.my.id`;
  const account = await createOrFindAccount(quotaUserEmail);
  const testKey = await createApiKey(account.id, 'test', 'Test Quota Key');
  const liveKey = await createApiKey(account.id, 'live', 'Live Quota Key');

  const dummyEndpoint = {
    id: 'dl.tiktok',
    billing_policy: { type: 'free_eligible', default_credits: 1, paid_credits: 1 }
  };

  await t.test('Test Key consumes lifetime quota (decrements from 50)', async () => {
    const res1 = await consumeQuotaForRequest(account, testKey, dummyEndpoint);
    assert.equal(res1.quotaType, 'test');
    assert.equal(res1.remaining, 49);

    const res2 = await consumeQuotaForRequest(account, testKey, dummyEndpoint);
    assert.equal(res2.remaining, 48);

    // Creating or rotating key MUST NOT reset lifetime quota
    const newTestKey = await createApiKey(account.id, 'test', 'Second Test Key');
    const res3 = await consumeQuotaForRequest(account, newTestKey, dummyEndpoint);
    assert.equal(res3.remaining, 47, 'Lifetime allocation must persist across keys');
  });

  await t.test('Live Key consumes daily free quota (up to 20/day)', async () => {
    const res = await consumeQuotaForRequest(account, liveKey, dummyEndpoint);
    assert.equal(res.quotaType, 'free');
    assert.ok(res.remaining <= 19, 'Remaining daily quota must be <= 19');
  });

  await t.test('120-hour inactivity freezes free benefit and explicit reactivation restores it', async () => {
    // Simulasi inaktivitas dengan memundurkan waktu aktivitas 6 hari ke belakang
    const pastDate = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);
    await query('UPDATE accounts SET last_live_activity_at = $1 WHERE id = $2', [pastDate, account.id]);

    const refreshed = await query('SELECT * FROM accounts WHERE id = $1', [account.id]);
    const frozenAcc = await evaluateAccountInactivity(refreshed.rows[0]);
    assert.equal(frozenAcc.is_frozen, true, 'Account must be marked frozen after 120h');

    // Pemanggilan kuota gratis saat freeze harus ditolak
    await assert.rejects(async () => {
      await consumeQuotaForRequest(frozenAcc, liveKey, dummyEndpoint);
    }, /dibekukan|reactivate/);

    // Reaktivasi eksplisit
    const restored = await reactivateFreeBenefit(account.id);
    assert.equal(restored.is_frozen, false, 'Free benefit restored');
  });
});
