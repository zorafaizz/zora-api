import test from 'node:test';
import assert from 'node:assert/strict';
import { ENDPOINT_REGISTRY, findEndpointByPath } from '../src/registry/endpoints.js';

test('Endpoint Registry Integrity Validation', async (t) => {
  await t.test('registry should contain active endpoints', () => {
    assert.equal(ENDPOINT_REGISTRY.length, 42, 'Registry must contain all 42 active endpoints');
  });

  await t.test('all endpoint IDs and paths must be unique', () => {
    const idSet = new Set();
    const pathSet = new Set();

    for (const ep of ENDPOINT_REGISTRY) {
      assert.ok(!idSet.has(ep.id), `Duplicate endpoint ID detected: ${ep.id}`);
      idSet.add(ep.id);

      assert.ok(!pathSet.has(ep.path), `Duplicate path detected: ${ep.path}`);
      pathSet.add(ep.path);

      if (Array.isArray(ep.aliases)) {
        for (const alias of ep.aliases) {
          assert.ok(!pathSet.has(alias), `Path/alias collision detected: ${alias}`);
          pathSet.add(alias);
        }
      }
    }
  });

  await t.test('all endpoints must have mandatory metadata and policies', () => {
    for (const ep of ENDPOINT_REGISTRY) {
      assert.ok(ep.id, 'Endpoint must have an id');
      assert.ok(ep.category, `${ep.id} must have a category`);
      assert.ok(ep.method, `${ep.id} must have a method`);
      assert.ok(ep.path, `${ep.id} must have a path`);
      assert.ok(ep.billing_policy, `${ep.id} must have billing_policy`);
      assert.ok(['free_eligible', 'paid_only', 'no_quota'].includes(ep.billing_policy.type), `${ep.id} invalid billing type`);
      assert.ok(typeof ep.billing_policy.default_credits === 'number', `${ep.id} must have numeric credits`);
      assert.ok(ep.cache_policy, `${ep.id} must have cache_policy`);
      assert.ok(ep.metadata && ep.metadata.title, `${ep.id} must have title metadata`);
    }
  });

  await t.test('findEndpointByPath resolves canonical and alias paths', () => {
    const ep1 = findEndpointByPath('/api/downloader/tiktok');
    assert.ok(ep1, 'Must find /api/downloader/tiktok');
    assert.equal(ep1.id, 'dl.tiktok');

    const ep2 = findEndpointByPath('/api/downloader/tt');
    assert.ok(ep2, 'Must find alias /api/downloader/tt');
    assert.equal(ep2.id, 'dl.tiktok');

    const ep3 = findEndpointByPath('/health');
    assert.ok(ep3, 'Must find /health');
    assert.equal(ep3.id, 'sys.health');

    const ep4 = findEndpointByPath('/api/v1/downloader/pixeldrain');
    assert.ok(ep4, 'Must find /api/v1/downloader/pixeldrain');
    assert.equal(ep4.id, 'dl.pixeldrain');

    const ep5 = findEndpointByPath('/api/v1/tools/ssweb');
    assert.ok(ep5, 'Must find /api/v1/tools/ssweb');
    assert.equal(ep5.id, 'tool.ssweb');

    const ep6 = findEndpointByPath('/api/tools/npm');
    assert.ok(ep6, 'Must find alias /api/tools/npm');
    assert.equal(ep6.id, 'stalk.npm');
  });
});
