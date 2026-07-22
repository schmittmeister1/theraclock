/* Capture 1080x1920 Play-Store-compliant phone screenshots.
   Run from repo root with the local server on :8123. Outputs to ../store-assets/. */
import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:8123/';
const OUT = '../store-assets/';
const browser = await chromium.launch();

async function shot(name, { colorScheme, scrollTo }) {
  const ctx = await browser.newContext({
    viewport: { width: 360, height: 640 },
    deviceScaleFactor: 3,
    colorScheme,
  });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  if (scrollTo) {
    await page.$eval(scrollTo, el => el.scrollIntoView({ block: 'start' }));
    await page.evaluate(() => window.scrollBy(0, -8));
  }
  await page.waitForTimeout(250);
  await page.screenshot({ path: OUT + name }); // viewport-only => 1080x1920
  console.log('saved', name);
  await ctx.close();
}

await shot('shot-1-inputs.png', { colorScheme: 'light' });
await shot('shot-2-result.png', { colorScheme: 'light', scrollTo: '.result-card' });
await shot('shot-3-dark.png', { colorScheme: 'dark', scrollTo: '.result-card' });

await browser.close();
