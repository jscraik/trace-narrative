#!/usr/bin/env node
import { mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";

const [, , inputUrl, rawLabel] = process.argv;

if (!inputUrl) {
  console.error("Usage: node screenshot.mjs <url> [label]");
  process.exit(1);
}

const screenshotLabel = rawLabel
  ? rawLabel
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-_]/g, "")
  : "";

const screenshotsDir = "temporary screenshots";

function nextScreenshotPath(existingFiles) {
  const pattern = /^screenshot-(\d+)(?:-[^/.]+)?\.png$/;
  let max = 0;

  for (const name of existingFiles) {
    const match = name.match(pattern);
    if (!match) continue;

    const n = Number(match[1]);
    if (!Number.isNaN(n) && n > max) max = n;
  }

  const seq = max + 1;
  const filename = screenshotLabel
    ? `screenshot-${seq}-${screenshotLabel}.png`
    : `screenshot-${seq}.png`;

  return join(screenshotsDir, filename);
}

async function getChromiumLauncher() {
  const candidates = ["playwright", "playwright-core", "@playwright/test"]; 

  for (const pkg of candidates) {
    try {
      const module = await import(pkg);
      const chromium = module?.chromium;
      if (chromium?.launch) {
        return chromium;
      }
    } catch {
      // continue
    }
  }

  console.error(
    "Could not find a local screenshot engine for this script. Install Playwright first: pnpm add -D playwright"
  );
  return null;
}

async function gotoWithRetry(page, url, attempts = 12, delayMs = 600) {
  let lastError;
  for (let i = 0; i < attempts; i += 1) {
    try {
      await page.goto(url, { waitUntil: "networkidle", timeout: 8000 });
      return;
    } catch (error) {
      lastError = error;
      const message = (error && "message" in error) ? String(error.message) : String(error);
      if (!/ERR_CONNECTION_REFUSED|net::ERR_CONNECTION_REFUSED/.test(message)) {
        throw error;
      }
      if (i === attempts - 1) {
        throw error;
      }
      console.log(
        `[screenshot] Navigation not ready yet (${i + 1}/${attempts}). Retrying in ${delayMs}ms...`
      );
      await page.waitForTimeout(delayMs);
    }
  }
  throw lastError;
}

(async () => {
  await mkdir(screenshotsDir, { recursive: true });
  const existing = await readdir(screenshotsDir);
  const outputPath = nextScreenshotPath(existing);

  const chromium = await getChromiumLauncher();
  if (!chromium) {
    process.exit(1);
  }

  const browser = await chromium.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const context = await browser.newContext({ viewport: { width: 1600, height: 1200 } });
  const page = await context.newPage();

  try {
    await gotoWithRetry(page, inputUrl);
    await page.waitForTimeout(1000);
    await page.screenshot({ path: outputPath, fullPage: true });
    console.log(outputPath);
  } finally {
    await browser.close();
  }
})();
