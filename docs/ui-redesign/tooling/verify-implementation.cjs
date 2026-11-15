// Requires the loopback fixture server and a separately installed Playwright module.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/google/chrome/chrome' });
  const cases = [];
  for (const viewport of [{width:1440,height:900},{width:390,height:844}]) {
    const ctx = await browser.newContext({ viewport, reducedMotion: 'reduce', hasTouch: viewport.width < 600 });
    const page = await ctx.newPage(); let productCalls = 0;
    await ctx.route('**/*', route => { const url = new URL(route.request().url());
      if (url.hostname !== '127.0.0.1') return route.abort();
      if (url.pathname === '/icon.png') return route.fulfill({path:'public/icon.png',contentType:'image/png'});
      if (url.pathname === '/api/v1/search/anime') { productCalls++; return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({status:true,result:{title:'Local fixture'}})}); }
      return route.continue(); });
    await page.goto('http://127.0.0.1:43873/explorer', {waitUntil:'domcontentloaded'});
    if (viewport.width < 600) {
      const picker = page.getByRole('button', {name:/Selected endpoint/});
      assert.equal(await picker.getAttribute('aria-expanded'), 'false');
      await picker.click(); assert.equal(await picker.getAttribute('aria-expanded'), 'true');
      await page.getByRole('searchbox').count();
      const filter = page.getByRole('textbox', {name:'Filter endpoints'}); await filter.fill('Kusonime');
      const ep = page.locator('#endpoint-directory').getByRole('button', {name:/Kusonime Anime Search/});
      await ep.click(); assert.equal(await picker.getAttribute('aria-expanded'), 'false');
      assert.equal(await picker.evaluate(e => e === document.activeElement), true);
      assert.equal(productCalls, 0);
      const menu = page.getByRole('button', {name:'Toggle navigation'}); await menu.click();
      await page.keyboard.press('Escape'); assert.equal(await menu.getAttribute('aria-expanded'), 'false');
      assert.equal(await menu.evaluate(e => e === document.activeElement), true);
    } else {
      const trigger = page.getByRole('button',{name:'Open command menu'}); await trigger.click();
      const dialog = page.getByRole('dialog'); await dialog.waitFor(); await page.waitForTimeout(100);
      for (let i=0;i<40;i++) { await page.keyboard.press('Tab'); assert.equal(await page.evaluate(() => !!document.activeElement?.closest('[role=dialog]')), true); }
      await page.keyboard.press('Escape'); await dialog.waitFor({state:'hidden'}); await page.waitForTimeout(100);
      assert.equal(await trigger.evaluate(e => e === document.activeElement), true);
    }
    const execute = page.getByRole('button',{name:'Execute Request',exact:true}); await execute.click();
    await page.getByText('Local fixture').first().waitFor(); assert.equal(productCalls,1);
    await page.evaluate(() => Object.defineProperty(navigator.clipboard, 'writeText', { configurable:true, value: () => Promise.reject(new Error('fixture denied')) }));
    await page.getByRole('button', {name:'Copy Code'}).click();
    await page.getByText('Could not copy the code. Select and copy it manually.').waitFor();
    cases.push({viewport,productCalls,focusAndMock:'PASS'}); await ctx.close();
  }
  await browser.close(); console.log(JSON.stringify(cases,null,2));
})().catch(error => {console.error(error);process.exit(1)});
