// Renders og.png, the 1200x630 link preview card, from the site's own data and logos.
// Run: node scripts/render-og.mjs   (then commit og.png and bump ?v= in template.html and sector-pages.mjs)
//
// Uses the same out-of-repo playwright-core and Chromium as scripts/capture-rendered-boards.mjs, so the
// site build never installs a browser. The card page is served under https://senrajobs.com/ through a
// request route, so the site's Adobe Fonts kit accepts the font requests exactly as it does on the site.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

// Well-known companies the site lists, each with a sharp logo. The script checks every one is still a
// current company of a guest and still has a logo file, and stops if not.
const COMPANIES = ['OpenAI', 'Coinbase', 'Shopify', 'Robinhood', 'Uber'];

const local = process.env.LOCALAPPDATA || '';
function loadPlaywright() {
  for (const dir of [process.cwd(), path.join(local, 'senrajobs-capture')]) {
    try { return createRequire(path.join(dir, 'package.json'))('playwright-core'); } catch { /* try the next place */ }
  }
  throw Error(`playwright-core not found. Run: npm install --prefix "${path.join(local, 'senrajobs-capture')}" playwright-core`);
}
function chromePath() {
  if (process.env.SENRA_CHROME) return process.env.SENRA_CHROME;
  const root = path.join(local, 'ms-playwright');
  const builds = fs.existsSync(root) ? fs.readdirSync(root).filter((name) => /^chromium-\d+$/.test(name)).sort((a, b) => Number(b.slice(9)) - Number(a.slice(9))) : [];
  for (const build of builds) {
    for (const sub of ['chrome-win64', 'chrome-win', 'chrome-linux', 'chrome-mac']) {
      const exe = path.join(root, build, sub, process.platform === 'win32' ? 'chrome.exe' : 'chrome');
      if (fs.existsSync(exe)) return exe;
    }
  }
  throw Error('No Chromium found. Run `npx playwright-core install chromium` or set SENRA_CHROME.');
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const guests = JSON.parse(fs.readFileSync('guests.json', 'utf8'));
const logos = JSON.parse(fs.readFileSync('company-logos.json', 'utf8'));
const current = new Set((guests.guests || guests).flatMap((g) => g.companies.filter((c) => c.note !== 'acquired or closed').map((c) => c.name.split(' (')[0])));

const rows = COMPANIES.map((name) => {
  if (!current.has(name)) throw Error(`${name} is not a current company of any guest in guests.json`);
  const src = logos[name]?.src;
  if (!src || !fs.existsSync('.' + src)) throw Error(`${name} has no logo file`);
  const data = `data:image/png;base64,${fs.readFileSync('.' + src).toString('base64')}`;
  return `<li><img src="${data}" alt="" width="48" height="48"><span class="name">${esc(name)}</span><span class="go">Careers <span aria-hidden="true">&rarr;</span></span></li>`;
}).join('');

const template = fs.readFileSync('template.html', 'utf8');
const typekit = template.match(/<link rel="stylesheet" href="(https:\/\/use\.typekit\.net\/[^"]+\.css)">/)?.[1];
const display = template.match(/@font-face \{ font-family:"Schmalfette Grotesk";[^}]+\}/)?.[0];
if (!typekit || !display) throw Error('Could not read the font links from template.html');

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<link rel="stylesheet" href="${typekit}">
<style>
  ${display}
  * { box-sizing:border-box; margin:0; padding:0; }
  html, body { width:1200px; height:630px; background:#fff; color:#000; overflow:hidden; }
  body { font-family:"tt-commons-pro",Arial,sans-serif; padding:64px; display:grid; grid-template-rows:1fr auto; }
  .main { display:grid; grid-template-columns:45fr 55fr; gap:56px; align-items:center; }
  h1 { font:400 120px/.88 "Schmalfette Grotesk",Impact,sans-serif; letter-spacing:-.01em; }
  .lede { font-size:32px; line-height:1.2; margin-top:24px; max-width:440px; }
  ul { list-style:none; border-top:1px solid #e3e3e3; }
  li { display:flex; align-items:center; gap:20px; height:80px; border-bottom:1px solid #e3e3e3; }
  li img { width:48px; height:48px; border-radius:4px; object-fit:contain; }
  .name { font-size:28px; font-weight:500; flex:1; }
  .go { font-size:22px; color:#666; }
  footer { display:flex; justify-content:space-between; font-size:22px; color:#666; border-top:1px solid #e3e3e3; padding-top:20px; margin-top:28px; }
  footer b { color:#000; font-weight:500; }
</style></head><body>
<div class="main">
  <div><h1>SENRA<br>JOBS</h1><p class="lede">Jobs at David Senra&rsquo;s guests&rsquo; companies.</p></div>
  <ul>${rows}</ul>
</div>
<footer><b>senrajobs.com</b><span>Free, independent fan project.</span></footer>
</body></html>`;

const { chromium } = loadPlaywright();
const browser = await chromium.launch({ executablePath: chromePath(), headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  const cardUrl = 'https://senrajobs.com/__og-card';
  await page.route(cardUrl, (route) => route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }));
  await page.goto(cardUrl, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  const fonts = await page.evaluate(() => ({
    display: document.fonts.check('120px "Schmalfette Grotesk"'),
    text: document.fonts.check('28px "tt-commons-pro"'),
    loaded: [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family),
  }));
  if (!fonts.loaded.some((f) => /Schmalfette/.test(f)) || !fonts.loaded.some((f) => /tt-commons-pro/.test(f))) {
    throw Error(`Site fonts did not load (loaded: ${fonts.loaded.join(', ') || 'none'}); refusing to write a card with fallback fonts`);
  }
  const overflow = await page.evaluate(() => document.documentElement.scrollHeight > 630 || document.documentElement.scrollWidth > 1200);
  if (overflow) throw Error('Card content overflows 1200x630');
  await page.screenshot({ path: 'og.png', type: 'png' });
  const png = fs.readFileSync('og.png');
  console.log(`og.png ${png.readUInt32BE(16)}x${png.readUInt32BE(20)}, ${png.length} bytes; rows: ${COMPANIES.join(', ')}; fonts: ${[...new Set(fonts.loaded)].join(', ')}`);
} finally {
  await browser.close();
}
