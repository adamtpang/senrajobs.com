// Deploy-shape and syntax checks. No network.
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { isInWindow, formatPay, matchesPlace, matchesTrack, WINDOW_MS } from './feed.mjs';

let failed = 0;
const bad = (msg) => { console.error(msg); failed++; };
for (const file of ['build.mjs','fetch-jobs.mjs','ats.mjs','api/assistant.mjs','scripts/stage-public.mjs','scripts/prepare-production.mjs','check.mjs']) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) bad(`${file} failed node --check\n${result.stderr}`);
}
const pkg = JSON.parse(fs.readFileSync('package.json','utf8'));
if (pkg.scripts.build !== 'node build.mjs && node scripts/stage-public.mjs') bad('package.json build must stage public/');
const vercel = JSON.parse(fs.readFileSync('vercel.json','utf8'));
if (vercel.outputDirectory !== 'public') bad('vercel.json outputDirectory must be public');
if (!fs.readFileSync('.gitignore','utf8').includes('public/')) bad('public/ must be gitignored');
const workflow = fs.readFileSync('.github/workflows/fetch-jobs.yml','utf8');
if (!workflow.includes('cron: "0 12 * * *"') || !workflow.includes('contents: write')) bad('daily workflow missing');
const assistant = fs.readFileSync('api/assistant.mjs','utf8');
for (const spec of ["../assistant/crypto.mjs","../assistant/store.mjs","../assistant/contracts.mjs"]) {
  if (!assistant.includes(spec)) bad(`assistant function lost import ${spec}`);
}
const stage = fs.readFileSync('scripts/stage-public.mjs','utf8');
if (/reports\/|docs\/|AGENTS\.md|scripts\//.test(stage.replace('scripts/prepare-production.mjs',''))) bad('stage-public would copy private paths');
const staged = spawnSync(process.execPath, ['scripts/stage-public.mjs'], { encoding: 'utf8' });
if (staged.status !== 0) bad(staged.stderr || staged.stdout);
for (const file of ['index.html','jobs.json','guests.json','llms.txt']) {
  if (!fs.existsSync(`public/${file}`)) bad(`public/${file} missing`);
}
if (fs.existsSync('public/reports') || fs.existsSync('public/docs') || fs.existsSync('public/AGENTS.md') || fs.existsSync('public/api')) bad('public/ contains non-public paths');
const html = fs.readFileSync('index.html','utf8');
if (!html.includes('Last updated') || !/<time datetime="[^"]+"/.test(html)) bad('homepage is missing the Last updated timestamp');
if (!html.includes('200x200bb') || html.includes('300x300bb')) bad('founder portraits should be the 200px rendition');
if (!html.includes('requestIdleCallback')) bad('analytics should wait for idle');
const now = Date.parse('2026-11-01T18:00:00.000Z');
if (!isInWindow({ observedAt: '2026-11-01T16:00:00.000Z' }, now)) bad('recent observation should be inside 48h');
if (isInWindow({ observedAt: '2026-09-30T12:00:00.000Z' }, now)) bad('September observation should be outside 48h');
if (!isInWindow({ observedAt: '2026-09-30T12:00:00.000Z', publishedAt: '2026-11-01T12:00:00.000Z' }, now)) bad('old role posted today should be inside');
if (!matchesPlace({ location: 'Austin, TX', workplace: 'OnSite' }, 'austin-texas')) bad('Austin');
if (!matchesPlace({ location: 'United States', workplace: 'Remote' }, 'remote')) bad('remote workplace');
if (!matchesTrack({ title: 'Forward Deployed Engineer' }, 'forward-deployed')) bad('FDE');
if (formatPay(null) != null) bad('missing pay');
if (formatPay({ min: 50, max: 70, currency: 'USD', period: 'hour' }) !== 'USD 50–70 hour') bad('hourly pay was rewritten');
if (WINDOW_MS !== 48 * 60 * 60 * 1000) bad('window');
if (!fs.existsSync('new.json') || !fs.readFileSync('vercel.json','utf8').includes('"/new"')) bad('new feed route missing');
const feed = JSON.parse(fs.readFileSync('new.json','utf8'));
const anchor = Date.parse(feed.generatedAt);
if (!Array.isArray(feed.roles) || feed.roles.length < 1) bad('feed is empty');
for (const role of feed.roles) {
  if (!role.company || !role.title || !role.url || !role.firstSeen) bad('feed role missing fields');
  if (!isInWindow({ firstSeen: role.firstSeen, publishedAt: role.postedAt }, anchor)) bad(`outside window ${role.title}`);
  if (role.pay && JSON.stringify(role.pay).includes('[object Object]')) bad('pay stringified an object');
}
if (!fs.readFileSync('index.html','utf8').includes('href="/new"')) bad('homepage missing new-role link');
if (!fs.readFileSync('new.html','utf8').includes('https://senrajobs.com/new.json')) bad('page missing feed url');
if (fs.existsSync('targets.json')) {
  const targets = JSON.parse(fs.readFileSync('targets.json','utf8'));
  const names = new Set(targets.map(t => t.name));
  for (const name of ['Fluidstack','Aalo Atomics','SpaceX Global']) if (!names.has(name)) bad(`missing target ${name}`);
  if (names.has('Tesla') || names.has('Terafab')) bad('Tesla and Terafab have no separate public board to add');
  const jobs = JSON.parse(fs.readFileSync('jobs.json','utf8'));
  if (jobs['Base Power']?.source !== 'ashby:base-power' && !String(jobs['Base Power']?.source||'').includes('base-power')) bad('Base Power board changed');
}
if (failed) { console.error(`${failed} check(s) failed`); process.exit(1); }
console.log('ok');
