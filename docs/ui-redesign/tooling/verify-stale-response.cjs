// Run against fixture-server.mjs; all non-loopback traffic is blocked.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/google/chrome/chrome' });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  let requests = 0;
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.hostname !== '127.0.0.1') return route.abort();
    if (url.pathname === '/api/v1/search/anime') {
      requests++;
      await new Promise(resolve => setTimeout(resolve, 1800));
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ marker: 'OLD_REQUEST' }) }).catch(() => {});
    }
    return route.continue();
  });
  try {
    await page.goto('http://127.0.0.1:43873/explorer');
    await page.getByRole('button', { name: 'Execute Request', exact: true }).click();
    await page.locator('#endpoint-directory').getByRole('button', { name: /System Health & Stats/ }).click();
    await page.waitForTimeout(2500);
    assert.equal(requests, 1);
    assert.equal(await page.getByText('OLD_REQUEST', { exact: false }).count(), 0, 'A previous endpoint response must not appear after switching');
    console.log('PASS: endpoint switch invalidates the pending response');
    await page.goto('http://127.0.0.1:43873/');
    const playground = page.locator('#playground');
    await playground.getByRole('button', { name: /Anime Search/ }).first().click();
    await playground.getByRole('button', { name: /Execute request/i }).click();
    await playground.getByRole('button', { name: /System Health & Stats/ }).click();
    await page.waitForTimeout(2500);
    assert.equal(requests, 2);
    assert.equal(await page.getByText('OLD_REQUEST', { exact: false }).count(), 0, 'Landing playground must discard an old endpoint response');
    console.log('PASS: landing playground invalidates the pending response');
    assert.equal(await page.getByRole('button', { name: 'Play hero video' }).count(), 1, 'Reduced motion should initially present a play control');
    console.log('PASS: reduced-motion video control reflects the paused state');
    const slow = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    await slow.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
    // Shorten the request deadline in this fixture only; simulate headers arriving
    // immediately and a body that never completes until the signal aborts.
    await slow.addInitScript(() => {
      const originalTimer = window.setTimeout.bind(window);
      window.setTimeout = (callback, delay, ...args) => originalTimer(callback, delay >= 10000 ? 250 : delay, ...args);
      const originalFetch = window.fetch.bind(window);
      window.fetch = (input, options) => {
        const url = new URL(typeof input === 'string' ? input : input.url, location.href);
        if (url.pathname !== '/api/v1/search/anime') return originalFetch(input, options);
        return Promise.resolve(new Response(new ReadableStream({
          start(stream) {
            stream.enqueue(new TextEncoder().encode('{"partial":'));
            options.signal.addEventListener('abort', () => stream.error(new DOMException('Aborted', 'AbortError')), { once: true });
          }
        }), { status: 200, headers: { 'content-type': 'application/json' } }));
      };
    });
    const slowPage = await slow.newPage();
    await slowPage.goto('http://127.0.0.1:43873/explorer');
    await slowPage.getByRole('button', { name: 'Execute Request', exact: true }).click();
    await slowPage.getByText('Request timed out. Check the parameters and try again.').waitFor({ timeout: 5000 });
    console.log('PASS: timeout covers a stalled response body (shortened fixture deadline)');
    await slow.close();
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
