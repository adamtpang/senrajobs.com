// Weekly local run: refresh the boards that answer 403 to plain requests but load in a real browser.
// Opens a visible Chromium window, loads each public careers page once, and reads the role list the
// page itself received. No login, no form input, no candidate data. Run it on a home connection:
//
//   node scripts/capture-rendered-boards.mjs              refresh all three and update jobs.json
//   node scripts/capture-rendered-boards.mjs --dry-run    capture and report, write nothing
//   node scripts/capture-rendered-boards.mjs --only=meta  one board (revolut, quantumlight, meta)
//
// Needs playwright-core outside the repo, so site builds never install it:
//   npm install --prefix "%LOCALAPPDATA%\senrajobs-capture" playwright-core
// and a Chromium from `npx playwright-core install chromium` (or set SENRA_CHROME to a chrome.exe).
// A board whose capture fails or does not add up is left exactly as it was.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { parseRevolut, parseQuantumLight, parseMeta, carryEarlierDetail } from '../rendered-feeds.mjs';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run'), force = args.includes('--force'), headless = args.includes('--headless');
const only = args.find((a) => a.startsWith('--only='))?.slice(7).split(',');
const local = process.env.LOCALAPPDATA || '';

function loadPlaywright() {
  const dirs = [process.env.SENRA_CAPTURE_DIR, path.join(local, 'senrajobs-capture'), process.cwd()].filter(Boolean);
  for (const dir of dirs) {
    try { return createRequire(path.join(dir, 'package.json'))('playwright-core'); } catch { /* try the next place */ }
  }
  throw Error(`playwright-core not found. Run: npm install --prefix "${path.join(local, 'senrajobs-capture')}" playwright-core`);
}
function findChrome() {
  if (process.env.SENRA_CHROME) return process.env.SENRA_CHROME;
  const root = path.join(local, 'ms-playwright');
  const builds = fs.existsSync(root) ? fs.readdirSync(root).filter((name) => /^chromium-\d+$/.test(name)).sort((a, b) => Number(b.slice(9)) - Number(a.slice(9))) : [];
  for (const build of builds) for (const sub of ['chrome-win64', 'chrome-win']) {
    const exe = path.join(root, build, sub, 'chrome.exe');
    if (fs.existsSync(exe)) return exe;
  }
  return undefined; // let Playwright use its own default
}

const shownLinks = (page, part) => page.evaluate((part) => [...new Set([...document.querySelectorAll(`a[href*="${part}"]`)].map((a) => a.href))], part);
const heading = (page) => page.evaluate(() => document.body.innerText.match(/We have \d+ open positions/)?.[0] || '');
const open = async (context, url) => { const page = await context.newPage(); const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }); return { page, status: response?.status() }; };

const BOARDS = {
  revolut: {
    name: 'Revolut (co-founder and CEO)', parse: parseRevolut,
    async capture(context) {
      const { page, status } = await open(context, 'https://www.revolut.com/careers/');
      await page.waitForFunction(() => /We have \d+ open positions/.test(document.body.innerText), null, { timeout: 30000 });
      const data = await page.evaluate(() => document.getElementById('__NEXT_DATA__')?.textContent || '');
      const capture = { status, heading: await heading(page), positions: JSON.parse(data || '{}')?.props?.pageProps?.positions, shownLinks: await shownLinks(page, '/careers/position/') };
      await page.close(); return capture;
    },
  },
  quantumlight: {
    name: 'QuantumLight (founder)', parse: parseQuantumLight,
    async capture(context) {
      const page = await context.newPage();
      const first = page.waitForResponse((r) => /\/api\/quantum-light\/external\/v3\/postings\?page=1$/.test(r.url()), { timeout: 45000 });
      const response = await page.goto('https://revolutpeople.com/quantum-light/public/careers', { waitUntil: 'domcontentloaded', timeout: 60000 });
      const pages = [await (await first).json()];
      // The site pages its own list; follow its next links from inside the page, at most a few times.
      while (pages.at(-1)?.pages?.next && pages.length < 10) pages.push(await page.evaluate((url) => fetch(url).then((r) => r.json()), new URL(pages.at(-1).pages.next, 'https://revolutpeople.com').href));
      await page.waitForFunction(() => /We have \d+ open positions/.test(document.body.innerText), null, { timeout: 30000 });
      await page.waitForTimeout(1500);
      const capture = { status: response?.status(), heading: await heading(page), pages, shownLinks: await shownLinks(page, '/careers/position/') };
      await page.close(); return capture;
    },
  },
  meta: {
    name: 'Meta (chief AI officer, not founder)', parse: parseMeta,
    async capture(context) {
      const page = await context.newPage();
      const results = page.waitForResponse(async (r) => {
        if (!/\/graphql/.test(r.url()) || !/CareersJobSearchResults/.test(r.request().postData() || '')) return false;
        return /"all_jobs"/.test(await r.text().catch(() => ''));
      }, { timeout: 60000 });
      const response = await page.goto('https://www.metacareers.com/jobsearch/', { waitUntil: 'domcontentloaded', timeout: 60000 });
      const body = JSON.parse((await (await results).text()).split('\n')[0]);
      const search = Object.values(body.data || {}).find((value) => Array.isArray(value?.all_jobs));
      await page.waitForFunction(() => /^[\d,]+ Items$/m.test(document.body.innerText), null, { timeout: 30000 });
      const itemsText = await page.evaluate(() => document.body.innerText.match(/^[\d,]+ Items$/m)?.[0] || '');
      await page.close(); return { status: response?.status(), itemsText, jobs: search?.all_jobs };
    },
  },
};

const jobs = JSON.parse(fs.readFileSync('jobs.json', 'utf8'));
const stamp = new Date().toISOString();
const rawDir = path.join('.cache', 'rendered-capture', stamp.replace(/[:.]/g, '-'));
fs.mkdirSync(rawDir, { recursive: true });
const { chromium } = loadPlaywright();
const browser = await chromium.launch({ executablePath: findChrome(), headless, args: ['--disable-blink-features=AutomationControlled'] });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'en-US' });
const report = [];
for (const [key, board] of Object.entries(BOARDS)) {
  if (only && !only.includes(key)) continue;
  const previous = jobs[board.name];
  try {
    if (!previous) throw Error(`${board.name} is not in jobs.json`);
    const observedAt = new Date().toISOString();
    const capture = { ...(await board.capture(context)), observedAt };
    fs.writeFileSync(path.join(rawDir, `${key}.json`), JSON.stringify(capture));
    const result = board.parse(capture);
    if (result.status !== 'complete') throw Error(result.reason);
    const before = previous.roles?.length || 0;
    // A sudden collapse is more likely a changed page than real layoffs; a person should look first.
    if (before >= 10 && result.rows.length < before / 2 && !force) throw Error(`Only ${result.rows.length} roles against ${before} before. Re-run with --force if that is real`);
    const roles = carryEarlierDetail(result.rows, previous.roles).map((role) => ({ ...role, firstSeen: role.firstSeen || observedAt }));
    const earlierUrls = new Set((previous.roles || []).map((role) => role.url)), nowUrls = new Set(roles.map((role) => role.url));
    jobs[board.name] = { source: result.source, sourceUrl: result.endpoint, careersUrl: previous.careersUrl || result.endpoint, fetched: observedAt, lastAttempt: observedAt, roles,
      coverage: { status: 'complete', listingStatus: 'complete', reason: result.reason, total: result.total, pages: result.pages, observedAt, pageReceipts: result.pageReceipts, retained: false } };
    report.push({ key, ok: true, line: `OK ${key}: ${roles.length} roles (${roles.filter((r) => !earlierUrls.has(r.url)).length} new, ${[...earlierUrls].filter((u) => !nowUrls.has(u)).length} gone, ${roles.filter((r) => r.payRanges?.length).length} with pay carried over)` });
  } catch (error) {
    report.push({ key, ok: false, line: `FAILED ${key}: ${String(error.message || error).split('\n')[0].slice(0, 300)} (board left unchanged)` });
  }
}
await browser.close();
const succeeded = report.filter((r) => r.ok).length;
if (succeeded && !dryRun) fs.writeFileSync('jobs.json', JSON.stringify(jobs, null, 1) + '\n');
for (const r of report) console.log(r.line);
console.log(dryRun ? 'Dry run: jobs.json not written.' : succeeded ? `jobs.json updated for ${succeeded} board(s).` : 'Nothing written.');
console.log(`Raw captures: ${rawDir}`);
process.exitCode = succeeded ? 0 : 2;
