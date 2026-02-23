import { chromium } from "@playwright/test";

(async () => {
  try {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });
    const errors = [];
    page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(`console-error: ${msg.text()}`);
    });
    console.log(navigating);
    await page.goto("http://localhost:2000", { waitUntil: "domcontentloaded", timeout: 120000 });
    await page.waitForTimeout(2000);
    const info = {
      url: page.url(),
      bodyText: (await page.textContent("body"))?.slice(0, 300),
      imgs: (await page.$$eval(img, els => els.map(e => ({src:e.src,alt:e.alt}))).catch(() => [])),
      h1: await page.$$eval(h1, els => els.map(e => e.textContent)),
      errors,
    };
    console.log(JSON.stringify(info, null, 2));
    await page.screenshot({ path: /Users/jamiecraik/dev/firefly-narrative/temporary