// Copy only the public site into public/ for Vercel Git builds.
// Mirrors the file list in scripts/prepare-production.mjs. api/ stays at the repo root
// so Vercel can trace api/assistant.mjs and its ../assistant imports.
import fs from 'node:fs';
import path from 'node:path';
const out = 'public';
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out);
const required = ['index.html','research.html','about.html','privacy.html','founders.html','interview-prompt.txt','og.png','robots.txt','sitemap.xml','llms.txt','guests.json','jobs.json'];
for (const file of required) fs.copyFileSync(file, path.join(out, file));
for (const dir of ['logos','assets','data']) fs.cpSync(dir, path.join(out, dir), { recursive: true });
// Later pull requests add these. Copy them when the build has produced them.
for (const file of ['new.html','new.json','new.xml','targets.json']) {
  if (fs.existsSync(file)) fs.copyFileSync(file, path.join(out, file));
}
console.log('staged public/');
