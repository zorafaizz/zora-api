import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../server.js';
import { createOrFindAccount } from '../src/modules/account/account.service.js';
import { createApiKey } from '../src/modules/api-keys/api-keys.service.js';
import { closeDb } from '../src/core/db.js';
import { closeRedis } from '../src/core/redis.js';

process.env.NODE_ENV = 'test';
process.env.ENABLE_MOCK_PAYMENT = 'true';

test.after(async () => {
  await closeRedis();
  await closeDb();
});

test('HTTP Server & Contract Verification Tests', async (t) => {
  const account = await createOrFindAccount(`http-user-${Date.now()}@itsfaiz.my.id`);
  const liveKey = await createApiKey(account.id, 'live', 'HTTP Contract Key');

  await t.test('GET /health returns 200 and KanjutGede creator', async () => {
    const res = await request(app).get('/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.creator, 'KanjutGede');
    assert.equal(res.body.status, true);
    assert.ok(res.headers['x-request-id'], 'Must contain X-Request-ID');
  });

  await t.test('GET /api/v1/openapi.json returns valid OpenAPI 3.1 spec', async () => {
    const res = await request(app).get('/api/v1/openapi.json');
    assert.equal(res.status, 200);
    assert.equal(res.body.openapi, '3.1.0');
    assert.equal(res.body.info.title, 'KanjutGede API');
    assert.ok(res.body.paths['/api/downloader/tiktok'], 'TikTok route must be documented');
  });

  await t.test('GET /docs returns interactive Scalar HTML documentation', async () => {
    const res = await request(app).get('/docs');
    assert.equal(res.status, 200);
    assert.ok(res.text.includes('KanjutGede API Documentation'));
    assert.ok(res.text.includes('@scalar/api-reference'));
  });

  await t.test('Legacy endpoint /api/tools/gempa preserves backward compatibility envelope', async () => {
    const res = await request(app).get('/api/tools/gempa');
    assert.equal(res.status, 200);
    assert.equal(res.body.creator, 'KanjutGede');
    assert.equal(res.body.status, true);
    assert.ok(res.body.result, 'result object must exist');
    assert.ok(res.body.data, 'data fallback alias must exist');
    assert.ok(res.body.latency, 'latency must exist');
  });

  await t.test('GET /api/v1/billing/pricing returns pricing list with credits', async () => {
    const res = await request(app)
      .get('/api/v1/billing/pricing')
      .set('Authorization', `Bearer ${liveKey.rawKey}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.status, true);
    assert.ok(Array.isArray(res.body.result));
    assert.ok(res.body.result.length > 10);
  });

  await t.test('POST /api/v1/billing/topup creates invoice in test sandbox', async () => {
    const res = await request(app)
      .post('/api/v1/billing/topup')
      .set('Authorization', `Bearer ${liveKey.rawKey}`)
      .send({ amount_idr: 25000 });

    assert.equal(res.status, 200);
    assert.equal(res.body.status, true);
    assert.ok(res.body.result.invoiceNumber.startsWith('INV-'));
    assert.equal(Number(res.body.result.creditAmount), 2500);
    assert.ok(res.body.result.qrisString, 'Must contain simulated QRIS string');
  });

  await t.test('GET /api/v1/keys without auth returns 401', async () => {
    const res = await request(app).get('/api/v1/keys');
    assert.equal(res.status, 401);
    assert.equal(res.body.status, false);
  });

  await t.test('GET /api/v1/keys with valid Bearer token returns 200', async () => {
    const res = await request(app)
      .get('/api/v1/keys')
      .set('Authorization', `Bearer ${liveKey.rawKey}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.status, true);
    assert.ok(Array.isArray(res.body.result));
  });

  await t.test('GET /api/tools/tempmail creates disposable email', async () => {
    const res = await request(app).get('/api/tools/tempmail');
    assert.equal(res.status, 200);
    assert.equal(res.body.status, true);
    assert.ok(res.body.result.email, 'Must return generated email');
  });

  await t.test('GET /api/v1/openapi.json documents all 42 endpoints including new capabilities', async () => {
    const res = await request(app).get('/api/v1/openapi.json');
    assert.equal(res.status, 200);
    assert.equal(Object.keys(res.body.paths).length, 42);
    assert.ok(res.body.paths['/api/downloader/pixeldrain']);
    assert.ok(res.body.paths['/api/search/manga']);
    assert.ok(res.body.paths['/api/tools/ssweb']);
  });

  await t.test('New URL-accepting endpoints reject SSRF loopback/metadata targets', async () => {
    const ssrfRes = await request(app)
      .get('/api/v1/tools/ssweb')
      .query({ url: 'http://169.254.169.254/latest/meta-data/' })
      .set('Authorization', `Bearer ${liveKey.rawKey}`);
    assert.ok([400, 403, 422, 500].includes(ssrfRes.status));
    assert.equal(ssrfRes.body.status, false);

    const pdRes = await request(app)
      .get('/api/v1/downloader/pixeldrain')
      .query({ url: 'http://127.0.0.1:6379/u/abcd1234' })
      .set('Authorization', `Bearer ${liveKey.rawKey}`);
    assert.ok([400, 403, 422, 500].includes(pdRes.status));
    assert.equal(pdRes.body.status, false);
  });
});
