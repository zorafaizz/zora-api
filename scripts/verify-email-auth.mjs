import { createRequire } from "node:module";
import crypto from "node:crypto";
import express from "express";
import pg from "pg";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { createEmailAuth } from "../src/modules/email-auth/index.js";
import { MemoryMail } from "../src/modules/email-auth/mail.js";
const require = createRequire(import.meta.url);
const { chromium } = require(
  process.env.PLAYWRIGHT_MODULE ||
    "/root/.npm/_npx/31e32ef8478fbf80/node_modules/playwright",
);
if (!process.env.AUTH_TEST_DATABASE_URL)
  throw Error("Use isolated auth runner");
const out = new URL("../docs/auth/evidence/", import.meta.url);
await mkdir(out, { recursive: true });
const pool = new pg.Pool({
    connectionString: process.env.AUTH_TEST_DATABASE_URL,
  }),
  app = express(),
  mail = new MemoryMail({ environment: "test" });
let now = Date.now();
const server = app.listen(0, "127.0.0.1");
await new Promise((r) => server.on("listening", r));
const origin = "http://127.0.0.1:" + server.address().port;
const auth = createEmailAuth({
  enabled: true,
  pool,
  origin,
  environment: "test",
  allowInsecureLocal: true,
  allowSignup: true,
  mail,
  now: () => now,
  codeKey: crypto.randomBytes(32).toString("hex"),
  csrfKey: crypto.randomBytes(32).toString("hex"),
  limitKey: crypto.randomBytes(32).toString("hex"),
});
app.use("/api/v1/auth", auth.router);
app.use(express.static(new URL("../public/", import.meta.url).pathname));
let browser;
const report = {
  environment:
    "Chrome157 headless; actual local auth router and isolated Postgres; in-memory mail only; no real messages",
  layouts: [],
  flows: [],
  errors: [],
};
try {
  browser = await chromium.launch({
    executablePath: "/opt/google/chrome/chrome",
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  await context.route("**/*", (r) =>
    new URL(r.request().url()).origin === origin ? r.continue() : r.abort(),
  );
  const page = await context.newPage();
  page.on("pageerror", (e) => report.errors.push(e.message));
  for (const theme of ["light", "dark"])
    for (const width of [320, 390, 768, 1280, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(origin + "/signin.html");
      await page.locator(".send:not([disabled])").waitFor();
      await page.locator("#theme").selectOption(theme);
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      report.layouts.push({ theme, width });
      if ([390, 1440].includes(width))
        await page.screenshot({
          path: new URL(`signin-${width}-${theme}.png`, out).pathname,
          fullPage: true,
        });
    }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(origin + "/signin.html?returnTo=https://evil.invalid/");
  await page.locator(".send:not([disabled])").waitFor();
  await page.locator("#email").fill("bad-email");
  await page.locator(".send").click();
  assert.match(await page.locator("#auth-status").textContent(), /valid email/);
  const recipient = "browser-" + crypto.randomUUID() + "@example.test";
  await page.locator("#email").fill(recipient);
  await page.locator(".send").click();
  await page.locator("#code").waitFor();
  const otp = mail.takeCode(recipient);
  await page
    .locator("#code")
    .fill(otp === "00000000" ? "11111111" : "00000000");
  await page.locator(".verify").click();
  await page.waitForFunction(() => !document.querySelector(".verify").disabled);
  assert.match(
    await page.locator("#auth-status").textContent(),
    /invalid or expired/,
  );
  assert.equal(await page.locator("#code").inputValue(), "");
  await page.locator("#code").fill(otp);
  await page.locator(".verify").click();
  await page.locator("#signed-in").waitFor();
  assert.equal(await page.locator("#code").inputValue(), "");
  assert.equal(
    await page.locator(".continue").getAttribute("href"),
    "/explorer.html",
  );
  await page.locator(".continue").click();
  await page.locator("#endpoint:not([disabled])").waitFor();
  assert.equal(await page.locator("#api-key").inputValue(), "");
  await page.goto(origin + "/signin.html");
  await page.locator("#signed-in").waitFor();
  now += 300001;
  await page.locator(".logout-all").click();
  await page.waitForFunction(() =>
    document
      .querySelector("#auth-status")
      .textContent.includes("Verify your email again"),
  );
  assert.match(
    await page.locator("#auth-status").textContent(),
    /Verify your email again/,
  );
  await page.locator(".reauth").click();
  await page.locator("#code").waitFor();
  const fresh = mail.takeCode(recipient);
  await page.locator("#code").fill(fresh);
  await page.locator(".verify").click();
  await page.locator("#signed-in").waitFor();
  await page.locator(".logout-all").click();
  await page.locator("#email-form").waitFor();
  assert.match(
    await page.locator("#auth-status").textContent(),
    /Signed out everywhere/,
  );
  const again = "browser-" + crypto.randomUUID() + "@example.test";
  await page.locator("#email").fill(again);
  await page.locator(".send").click();
  await page.locator("#code").waitFor();
  assert.ok(await page.locator(".resend").isDisabled());
  now += 61000;
  await page.evaluate(() => {
    const original = Date.now;
    Date.now = () => original() + 61000;
  });
  await page.waitForFunction(() => !document.querySelector(".resend").disabled);
  await page.locator(".resend").click();
  await page.waitForFunction(() => !document.querySelector(".verify").disabled);
  await page.locator(".change-email").click();
  await page.locator("#email-form").waitFor();
  assert.equal(await page.locator("#code").inputValue(), "");
  const exp = "browser-" + crypto.randomUUID() + "@example.test";
  await page.locator("#email").fill(exp);
  await page.locator(".send").click();
  await page.locator("#code").waitFor();
  const expired = mail.takeCode(exp);
  now += 600001;
  await page.locator("#code").fill(expired);
  await page.locator(".verify").click();
  await page.waitForFunction(() => !document.querySelector(".verify").disabled);
  assert.match(
    await page.locator("#auth-status").textContent(),
    /Refresh|invalid|expired/,
  );
  await page.locator(".retry").click();
  await page.locator("#email-form").waitFor();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  await page.locator(".send:not([disabled])").waitFor();
  assert.match(await page.locator("body").getAttribute("class"), /motion-off/);
  await page.keyboard.press("Tab");
  assert.equal(
    await page.evaluate(() => document.activeElement.textContent),
    "Skip to content",
  );
  await page.keyboard.press("Enter");
  assert.equal(new URL(page.url()).hash, "#main");
  const stored = await page.evaluate(() =>
    JSON.stringify({ local: localStorage, session: sessionStorage }),
  );
  assert.ok(!stored.includes(otp) && !stored.includes(recipient));
  await context.setOffline(true);
  await page.locator("#email").fill("offline-fixture@example.test");
  await page.locator(".send").click();
  await page.waitForFunction(() => !document.querySelector(".send").disabled);
  assert.match(
    await page.locator("#auth-status").textContent(),
    /fetch|network|connect/i,
  );
  await context.setOffline(false);
  await page.route("**/api/v1/auth/email/start", (route) =>
    route.fulfill({
      status: 429,
      json: { status: false, message: "Too many attempts. Try again later." },
    }),
  );
  await page.locator(".send").click();
  await page.waitForFunction(() =>
    document
      .querySelector("#auth-status")
      .textContent.includes("Too many attempts"),
  );
  await page.unroute("**/api/v1/auth/email/start");
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const mp = await mobile.newPage();
  await mp.goto(
    origin +
      "/signin.html?returnTo=" +
      encodeURIComponent("/explorer.html?endpoint=dl.tiktok"),
  );
  await mp.locator(".send:not([disabled])").waitFor();
  const mr = "mobile-" + crypto.randomUUID() + "@example.test";
  await mp.locator("#email").fill(mr);
  await mp.locator(".send").tap();
  await mp.locator("#code").waitFor();
  const mc = mail.takeCode(mr);
  await mp.locator("#code").fill(mc);
  await mp.locator(".verify").tap();
  await mp.locator("#signed-in").waitFor();
  assert.equal(
    await mp.locator(".continue").getAttribute("href"),
    "/explorer.html?endpoint=dl.tiktok",
  );
  await mp.locator(".logout").tap();
  await mp.locator("#email-form").waitFor();
  report.flows = [
    "network failure and throttled UI recovery",
    "actual email/code verification and session cookies",
    "invalid code recovery and cleared input",
    "safe intended destination",
    "manual playground remains separate",
    "fresh proof and sign-out-all",
    "resend cooldown/change email",
    "expired proof/restart",
    "keyboard/reduced motion/no credential storage",
    "mobile touch full sign-in/logout",
  ];
  assert.deepEqual(report.errors, []);
  await writeFile(
    new URL("browser-qa.json", out),
    JSON.stringify(report, null, 2),
  );
  console.log(
    JSON.stringify({
      layouts: report.layouts.length,
      flows: report.flows,
      errors: report.errors,
    }),
  );
} finally {
  await browser?.close();
  mail.clear();
  await pool.end();
  server.closeAllConnections();
  server.close();
}
