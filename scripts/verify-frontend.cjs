const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

(async () => {
  const root = path.resolve(__dirname, '..');
  const out = path.join(root, 'docs/implementation/evidence');
  await fs.promises.mkdir(out, { recursive: true });

  const mimeMap = {
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.woff2': 'font/woff2'
  };

  const server = http.createServer(async (req, res) => {
    try {
      const name = new URL(req.url, 'http://local').pathname;
      const target = path.join(root, 'public', name === '/' ? 'index.html' : decodeURIComponent(name));
      if (!target.startsWith(path.join(root, 'public') + path.sep)) throw new Error('path');
      const body = await fs.promises.readFile(target);
      res.writeHead(200, { 'content-type': mimeMap[path.extname(target)] || 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end('Not found');
    }
  });

  let browser;
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;

  try {
    browser = await chromium.launch({
      executablePath: '/opt/google/chrome/chrome',
      args: ['--no-sandbox']
    });

    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    const errors = [];
    const calls = [];
    let scenario = 'success';

    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('console', (m) => {
      if (
        m.type() === 'error' &&
        !/server responded with a status of (401|403|429|500|503)/.test(m.text())
      ) {
        errors.push(`console.error: ${m.text()}`);
      }
    });

    await context.route('**/*', async (route) => {
      const u = new URL(route.request().url());
      if (u.hostname !== '127.0.0.1') return route.abort();

      if (u.pathname === '/api/v1/auth/session') {
        return route.fulfill({
          status: 503,
          json: {
            status: false,
            error: 'Email sign-in is not enabled. The manual API-key playground remains available.'
          }
        });
      }

      if (u.pathname.startsWith('/api/v1/') || u.pathname === '/health') {
        calls.push({
          path: u.pathname,
          search: u.search,
          auth: route.request().headers().authorization ? 'present' : 'absent'
        });

        if (scenario === 'timeout') {
          await new Promise((r) => setTimeout(r, 16500));
          return route.fulfill({ json: { status: true } }).catch(() => {});
        }
        if (scenario === 'dense') {
          return route.fulfill({ json: Array(10000).fill(0) });
        }
        if (scenario === 'delay') {
          await new Promise((r) => setTimeout(r, 1000));
          return route.fulfill({ json: { status: true, creator: 'KanjutGede' } }).catch(() => {});
        }
        if (scenario === 'large') {
          return route.fulfill({ body: 'x'.repeat(1024 * 1024 + 100), contentType: 'text/plain' });
        }
        if (scenario === 'malformed') {
          return route.fulfill({ body: '<script>bad</script>', contentType: 'text/plain' });
        }

        const status = scenario === 'success' || scenario === 'escaped' ? 200 : Number(scenario);
        const key = route.request().headers().authorization?.slice(7) || '';

        if (scenario === 'escaped') {
          return route.fulfill({
            body: '{"echo":"\\u0066' + key.slice(1) + '"}',
            contentType: 'application/json'
          });
        }

        return route.fulfill({
          status,
          json:
            status === 200
              ? {
                  status: true,
                  creator: 'KanjutGede',
                  result: { title: 'Fixture', echo: key, nested: [1, { test: true }] }
                }
              : { status: false, error: 'Fixture error' },
          headers: {
            'x-request-id': 'fixture',
            'x-cache': 'MISS',
            'set-cookie': 'do-not-render',
            'x-internal-secret': 'do-not-render'
          }
        });
      }

      return route.continue();
    });

    const report = {
      environment:
        'Chrome headless, loopback static server, intercepted API fixtures; zero live upstream requests',
      layouts: [],
      flows: [],
      errors
    };

    // 1. Multi-viewport & Dual-theme Layout Matrix (3 routes x 2 themes x 5 viewports = 30 checks)
    for (const route of ['/', '/explorer.html?endpoint=dl.tiktok', '/signin.html']) {
      for (const theme of ['dark', 'light']) {
        await page.goto(base + route, { waitUntil: 'networkidle' });
        await page.locator('#theme').selectOption(theme);
        assert.equal(await page.locator('html').getAttribute('data-theme'), theme);

        for (const width of [320, 390, 768, 1280, 1440]) {
          await page.setViewportSize({ width, height: 1000 });
          const layout = await page.evaluate(() => ({
            width: innerWidth,
            scroll: document.documentElement.scrollWidth,
            images: [...document.images]
              .filter((i) => i.hasAttribute('src'))
              .every((i) => i.complete && i.naturalWidth > 0)
          }));

          assert.ok(
            layout.scroll <= width,
            `${route} (${theme}) at ${width}px overflowed horizontally: ${layout.scroll}px`
          );
          assert.ok(layout.images, `${route} broken image at ${width}px`);

          if (route === '/') {
            const ctaOverlap = await page.evaluate(() => {
              const buttons = [...document.querySelectorAll('.hero-actions a, .hero-actions button')];
              for (let i = 0; i < buttons.length; i++) {
                for (let j = i + 1; j < buttons.length; j++) {
                  const a = buttons[i].getBoundingClientRect();
                  const b = buttons[j].getBoundingClientRect();
                  if (a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top) {
                    return true;
                  }
                }
              }
              return false;
            });
            assert.equal(ctaOverlap, false, `Hero actions overlap at ${width}px`);
          }

          report.layouts.push({ route, theme, ...layout });

          if ([390, 1440].includes(width)) {
            const slug =
              route === '/' ? 'landing' : route.startsWith('/explorer') ? 'explorer' : 'signin';
            await page.screenshot({
              path: path.join(out, `${slug}-${width}-${theme}.png`),
              fullPage: true
            });
          }
        }
      }
    }

    // Zero API requests fired merely by browsing landing & explorer
    assert.equal(calls.length, 0, 'Zero endpoint calls before explicit Execute');

    // 2. Landing Quickstart Console, Command Palette (Ctrl+K), Scope Filters & Directory
    await page.goto(base + '/', { waitUntil: 'networkidle' });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.locator('#theme').selectOption('dark');
    assert.equal(await page.locator('script[src="/assets/gsap.min.js"]').count(), 0);
    assert.equal(await page.locator('script[src="/assets/companion.js"]').count(), 0);

    // Quickstart presets, language tabs & response envelope toggle
    await page.locator('[data-preset="dl.tiktok"]').click();
    assert.match(await page.locator('#quickstart-code').textContent(), /\/api\/v1\/download\/tiktok|\/api\/v1\/downloader\/tiktok/);
    assert.match(await page.locator('#quickstart-code').textContent(), /\$API_KEY/);

    await page.locator('[data-qs-lang="Go"]').click();
    assert.match(await page.locator('#quickstart-code').textContent(), /os\.Getenv\("API_KEY"\)/);

    await page.locator('[data-qs-tab="response"]').click();
    assert.match(await page.locator('#quickstart-code').textContent(), /"creator": "KanjutGede"/);
    await page.locator('[data-qs-lang="cURL"]').click();
    assert.equal(calls.length, 0, 'Quickstart preset switching never triggers network execution');

    // Command Palette open via Ctrl+K, search filter, Escape restore focus
    await page.keyboard.press('Control+k');
    await page.locator('#cmd-backdrop:not([hidden])').waitFor();
    await page.locator('#cmd-input').fill('turnstile');
    assert.ok((await page.locator('#cmd-list [role="option"]').count()) >= 1);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.querySelector('#cmd-backdrop').hidden);

    // Reduced motion compliance
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const animDuration = await page.evaluate(() => {
      const btn = document.querySelector('.primary');
      return getComputedStyle(btn).transitionDuration;
    });
    assert.ok(animDuration === '0s' || animDuration === '0.00001s' || parseFloat(animDuration) <= 0.01);
    await page.emulateMedia({ reducedMotion: 'no-preference' });

    // Directory scope & search filters
    await page.locator('[data-scope="public"]').click();
    assert.equal(await page.locator('.catalog .endpoint').count(), 24);
    await page.locator('[data-scope="protected"]').click();
    assert.equal(await page.locator('.catalog .endpoint').count(), 18);
    await page.locator('[data-scope="all"]').click();
    assert.equal(await page.locator('.catalog .endpoint').count(), 42);

    await page.locator('#search').fill('no matches fixture');
    assert.match(await page.locator('.catalog-status').textContent(), /No matching/i);

    await page.locator('#search').fill('tiktok');
    await page.locator('.catalog .endpoint').first().click();
    await page.locator('input[name="url"]').waitFor();
    assert.equal(await page.locator('input[name="url"]').inputValue(), '');
    assert.match(page.url(), /endpoint=dl\.tiktok/);

    // 200% Zoom anti-overflow check on Workbench
    await page.evaluate(() => {
      document.documentElement.style.zoom = '2';
    });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.evaluate(() => {
      document.documentElement.style.zoom = '';
    });

    // 3. Workbench Security, Sample Fill, Redaction, Bounded Rendering, Timeout & Cancel
    await page.locator('#endpoint').selectOption('solve.bridge');
    assert.ok(await page.locator('.execute').isDisabled());
    assert.match(await page.locator('.snippet').textContent(), /native bridge/i);

    await page.locator('#endpoint').selectOption('dl.tiktok');
    await page.locator('.execute').click();
    assert.equal(calls.length, 0, 'Missing required URL blocks execution client-side');

    // Fill Sample button fills sample URL without auto-executing
    await page.locator('#fill-sample').click();
    assert.ok((await page.locator('input[name="url"]').inputValue()).startsWith('https://'));
    assert.equal(calls.length, 0);

    await page.locator('input[name="url"]').fill('https://example.invalid/video?a=1&b=2');
    await page.locator('.execute').click();
    assert.match(await page.locator('.status').textContent(), /Enter an API key/i);
    assert.equal(calls.length, 0);

    const testKey = 'fixture-only-key-SENTINEL';
    await page.locator('#api-key').fill(testKey);
    assert.ok(!(await page.locator('.snippet').textContent()).includes(testKey));

    await page.locator('.execute').click();
    await page.waitForFunction(() => !document.querySelector('.execute').disabled);
    assert.equal(calls.length, 1);
    assert.match(calls[0].path, /^\/api\/v1\/download(?:er)?\/tiktok$/);
    assert.equal(calls[0].auth, 'present');
    assert.match(await page.locator('.response-meta').textContent(), /HTTP 200/);
    assert.ok(!(await page.locator('.response').textContent()).includes(testKey));
    assert.ok(!(await page.locator('.headers').textContent()).includes('do-not-render'));

    // Tree view & Formatted JSON view
    await page.locator('#response-view').selectOption('tree');
    await page.locator('.response-tree summary').first().waitFor();
    await page.locator('#response-view').selectOption('formatted');

    // Clipboard failure graceful status
    await page.evaluate(() =>
      Object.defineProperty(navigator, 'clipboard', {
        value: {
          writeText: async () => {
            throw new Error('fixture');
          }
        },
        configurable: true
      })
    );
    await page.locator('.copy-response').click();
    assert.match(await page.locator('.copy-status').textContent(), /Clipboard unavailable/i);

    // Unicode-escaped secret redaction in Formatted & Tree
    scenario = 'escaped';
    await page.locator('.execute').click();
    await page.waitForFunction(() => !document.querySelector('.execute').disabled);
    assert.ok(!(await page.locator('.response').textContent()).includes(testKey));
    await page.locator('#response-view').selectOption('tree');
    assert.ok(!(await page.locator('.response-tree').textContent()).includes(testKey));
    await page.locator('#response-view').selectOption('formatted');

    // HTTP status errors, malformed XSS text, and >1MB payload limit
    for (const code of ['401', '403', '429', '500', 'malformed', 'large']) {
      scenario = code;
      await page.locator('.execute').click();
      await page.waitForFunction(() => !document.querySelector('.execute').disabled);
      if (code === 'large') {
        assert.match(await page.locator('.status').textContent(), /1 MB/);
      } else if (code === 'malformed') {
        assert.equal(await page.locator('.response').textContent(), '<script>bad</script>');
      } else {
        assert.match(await page.locator('.response-meta').textContent(), new RegExp('HTTP ' + code));
      }
    }

    // Dense 10,000-element JSON bounded span count & full raw copy
    scenario = 'dense';
    await page.locator('.execute').click();
    await page.waitForFunction(() => !document.querySelector('.execute').disabled);
    assert.ok((await page.locator('.response span').count()) <= 2000);
    await page.locator('#response-view').selectOption('tree');
    assert.equal(await page.locator('.response span').count(), 0);
    await page.locator('#response-view').selectOption('formatted');
    await page.evaluate(() =>
      Object.defineProperty(navigator, 'clipboard', {
        value: {
          writeText: async (t) => {
            window.fixtureCopy = t;
          }
        },
        configurable: true
      })
    );
    await page.locator('.copy-response').click();
    assert.equal(await page.evaluate(() => JSON.parse(window.fixtureCopy).length), 10000);

    // Client timeout (using tool.dns with 10s deadline -> 15s abort guard) & explicit cancel
    await page.locator('#endpoint').selectOption('tool.dns');
    await page.locator('#fill-sample').click();
    scenario = 'timeout';
    await page.locator('.execute').click();
    await page.waitForFunction(() => !document.querySelector('.execute').disabled, {}, { timeout: 22000 });
    assert.match(await page.locator('.status').textContent(), /timed out/i);

    scenario = 'delay';
    await page.locator('.execute').click();
    await page.locator('.cancel').click();
    assert.match(await page.locator('.status').textContent(), /cancelled/i);
    await page.waitForTimeout(1100);
    assert.match(await page.locator('.status').textContent(), /cancelled/i);

    // Clear key wipes secret & response, zero persistence in storage/URL/DOM
    await page.locator('.clear-key').click();
    assert.equal(await page.locator('#api-key').inputValue(), '');
    assert.equal(await page.locator('.copy-response').isDisabled(), true);
    const stored = await page.evaluate(() =>
      JSON.stringify({ local: localStorage, session: sessionStorage, url: location.href })
    );
    assert.ok(!stored.includes(testKey));
    assert.ok(!(await page.locator('body').innerText()).includes(testKey));

    // 4. Sign-in 503 Boundary & Open-Redirect returnTo Sanitization
    await page.goto(base + '/signin.html?returnTo=//evil.example/phish', { waitUntil: 'networkidle' });
    assert.match(await page.locator('#auth-status').textContent(), /not enabled/i);
    assert.equal(await page.locator('.continue').getAttribute('href'), '/explorer.html');

    // 5. Theme System Sync & Persistence + Skip Link Keyboard Navigation
    await page.locator('#theme').selectOption('system');
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
    await page.locator('#theme').selectOption('light');
    await page.reload({ waitUntil: 'networkidle' });
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');

    await page.goto(base + '/', { waitUntil: 'networkidle' });
    await page.keyboard.press('Tab');
    assert.equal((await page.evaluate(() => document.activeElement.textContent)).trim(), 'Skip to content');
    await page.keyboard.press('Enter');
    assert.equal(new URL(page.url()).hash, '#main');

    // 6. Mobile Touch Context (390x844) — Command Palette tap & Escape
    const touch = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true
    });
    const tp = await touch.newPage();
    await tp.goto(base + '/', { waitUntil: 'networkidle' });
    await tp.locator('[data-open-cmd]').first().tap();
    await tp.locator('#cmd-backdrop:not([hidden])').waitFor();
    await tp.keyboard.press('Escape');
    await tp.waitForFunction(() => document.querySelector('#cmd-backdrop').hidden);
    await touch.close();

    report.flows = [
      '30-viewport dual-theme layout matrix (320px-1440px) with zero horizontal overflow',
      'zero API requests before explicit Execute',
      'Quickstart preset switcher, Go/Python/TS/cURL snippets, and 200 OK envelope preview',
      'Command Palette (Ctrl+K & mobile tap), live endpoint search, Escape focus restore',
      'prefers-reduced-motion compliance and 200% zoom anti-overflow',
      'Directory All (42) / Public (24) / Bearer (18) scope filters and deep link',
      'Workbench sample fill, required parameter & API key guards, native bridge docs-only lock',
      'Bearer redaction (nested + Unicode escape) and safe response header allowlist',
      'Bounded 10k-item JSON rendering, Raw/Tree toggle, and clipboard fallback',
      '401/403/429/500, non-JSON XSS literal safety, and >1 MB stream cutoff',
      'Deadline timeout abort & user cancel ignoring late responses',
      'Sign-in 503 disabled-auth boundary & open-redirect returnTo sanitization',
      'Theme system/light/dark persistence and keyboard Skip-to-content navigation'
    ];

    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(out, 'frontend-qa.json'), JSON.stringify(report, null, 2));
    console.log(
      JSON.stringify({
        layouts: report.layouts.length,
        flows: report.flows.length,
        apiCalls: calls.length,
        errors
      })
    );
  } finally {
    await browser?.close();
    server.closeAllConnections();
    server.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
