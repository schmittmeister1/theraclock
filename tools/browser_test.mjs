/* End-to-end smoke test + screenshots. Run from repo root:
   node tools/browser_test.mjs
   Requires a static server on :8123 (the script starts none). */
import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:8123/';
let failures = 0;
const ok = (cond, name) => {
  console.log((cond ? '  ok - ' : '  FAIL - ') + name);
  if (!cond) failures++;
};

const browser = await chromium.launch();

// ---------- phone, light mode ----------
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  colorScheme: 'light',
});
const page = await ctx.newPage();
const consoleErrors = [];
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', e => consoleErrors.push(String(e)));

await page.goto(BASE, { waitUntil: 'networkidle' });

console.log('defaults (8:00 start, 24 units, 30 min break, 90%)');
ok(await page.textContent('#end-time') === '3:10 PM', 'end time is 3:10 PM');
ok((await page.textContent('#worked')).trim() === '6 hr 40 min', 'working time 6 hr 40 min');
ok((await page.textContent('#nonbill')).trim() === '40 min', 'non-billable 40 min');
ok((await page.textContent('#units-hint')).includes('24 units = 6 hr'), 'units hint shows conversion');

console.log('interactions');
// productivity chip 75 -> 8:00 + 6h/0.75 (8h) + 0:30 = 4:30 PM
await page.click('#prod-chips button[data-value="75"]');
ok(await page.textContent('#end-time') === '4:30 PM', '75% chip -> 4:30 PM');
ok(await page.$eval('#prod-chips button[data-value="75"]', b => b.classList.contains('active')), 'chip highlights');

// stepper: +1 unit = +15 billed min -> 25 units = 6h15 -> /0.75 = 8h20 + 30 = 4:50 PM
await page.click('#units-plus');
ok(await page.textContent('#end-time') === '4:50 PM', 'unit stepper +1 -> 4:50 PM');
await page.click('#units-minus');

// switch to hours mode: should convert 24 units -> 6 hr 0 min
await page.click('label[for="mode-hours"]');
ok(await page.inputValue('#bill-h') === '6' && await page.inputValue('#bill-m') === '0', 'mode switch converts to 6 hr 0 min');
await page.fill('#bill-m', '30'); // 6.5h billed /0.75 = 8h40m + 30 = 5:10 PM
ok(await page.textContent('#end-time') === '5:10 PM', 'hours mode edit -> 5:10 PM');

// switch back converts to units (6h30 = 26 units)
await page.click('label[for="mode-units"]');
ok(await page.inputValue('#units') === '26', 'switch back -> 26 units');

// start time change: 7:00 + 8h40m + 30m = 4:10 PM
await page.fill('#start', '07:00');
ok(await page.textContent('#end-time') === '4:10 PM', 'start time change -> 4:10 PM');

// break chip none: 7:00 + 8h40m = 3:40 PM
await page.click('#break-chips button[data-value="0"]');
ok(await page.textContent('#end-time') === '3:40 PM', 'break none -> 3:40 PM');

// validation: clear billed time
await page.click('#units-minus'); // 25
for (let i = 0; i < 30; i++) await page.click('#units-minus');
ok(await page.textContent('#end-time') === '—', 'zero billed time -> em dash + reason');
ok((await page.textContent('#end-note')).includes('billed time'), 'reason mentions billed time');

// >100% warning
await page.fill('#units', '24');
await page.fill('#prod', '110');
ok(!(await page.$eval('#warn', el => el.hidden)), 'warning shown above 100%');
ok((await page.textContent('#warn')).includes('concurrent'), 'warning text mentions concurrent');

// persistence: reload keeps values
await page.reload({ waitUntil: 'networkidle' });
ok(await page.inputValue('#prod') === '110', 'localStorage persists productivity');
ok(await page.inputValue('#start') === '07:00', 'localStorage persists start time');

// service worker registered
const swState = await page.evaluate(async () => {
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ? 'registered' : 'none';
});
ok(swState === 'registered', 'service worker registered');

// reset to friendly defaults for the screenshot
await page.evaluate(() => localStorage.clear());
await page.fill('#start', '08:00');
await page.fill('#units', '24');
await page.fill('#break', '30');
await page.fill('#prod', '90');
await page.waitForTimeout(300);
await page.screenshot({ path: 'docs/screenshot-light.png', fullPage: true });
console.log('  saved docs/screenshot-light.png');

ok(consoleErrors.length === 0, 'no console errors' + (consoleErrors.length ? ': ' + consoleErrors.join(' | ') : ''));
await ctx.close();

// ---------- phone, dark mode ----------
const dctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  colorScheme: 'dark',
});
const dpage = await dctx.newPage();
await dpage.goto(BASE, { waitUntil: 'networkidle' });
await dpage.waitForTimeout(200);
await dpage.screenshot({ path: 'docs/screenshot-dark.png', fullPage: true });
console.log('  saved docs/screenshot-dark.png');
await dctx.close();

// ---------- desktop, two-column layout ----------
const wctx = await browser.newContext({ viewport: { width: 1100, height: 800 }, colorScheme: 'light' });
const wpage = await wctx.newPage();
await wpage.goto(BASE, { waitUntil: 'networkidle' });
const cols = await wpage.$eval('.columns', el => getComputedStyle(el).gridTemplateColumns.split(' ').length);
ok(cols === 2, 'desktop uses two columns');
await wpage.screenshot({ path: 'docs/screenshot-desktop.png' });
console.log('  saved docs/screenshot-desktop.png');
await wctx.close();

await browser.close();
console.log(failures === 0 ? '\nALL BROWSER CHECKS PASSED' : `\n${failures} CHECKS FAILED`);
process.exit(failures === 0 ? 0 : 1);
