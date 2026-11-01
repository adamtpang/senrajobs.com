// Deploy-shape and syntax checks. No network.
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

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
