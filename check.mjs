// Schema and syntax checks. No network, no dependencies.
import fs from "node:fs";
import { spawnSync } from "node:child_process";

let failed = 0;
const bad = (msg) => { console.error(msg); failed++; };

for (const file of ["fetch-jobs.mjs", "build.mjs", "check.mjs"]) {
  const r = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (r.status !== 0) bad(`${file} failed node --check\n${r.stderr}`);
}

const workflow = fs.readFileSync(".github/workflows/fetch-jobs.yml", "utf8");
if (!workflow.includes('cron: "0 12 * * *"')) bad("daily cron missing");
if (!workflow.includes("contents: write")) bad("workflow needs contents: write");
if (!workflow.includes("node fetch-jobs.mjs") || !workflow.includes("node build.mjs")) bad("workflow must fetch and rebuild");

const jobs = JSON.parse(fs.readFileSync("jobs.json", "utf8"));
const fetched = [];
let roles = 0;
let live = 0;
for (const [name, entry] of Object.entries(jobs)) {
  if (!entry) continue;
  live++;
  if (!entry.source || !entry.fetched || !Array.isArray(entry.roles)) bad(`bad jobs entry: ${name}`);
  const t = Date.parse(entry.fetched);
  if (!Number.isFinite(t)) bad(`bad fetched date: ${name}`);
  else fetched.push(t);
  for (const role of entry.roles) {
    if (!role.title || !/^https?:\/\//.test(role.url || "")) bad(`bad role in ${name}`);
    roles++;
  }
}
if (live < 1 || roles < 1) bad("jobs.json has no roles");

const html = fs.readFileSync("index.html", "utf8");
const stamp = html.match(/<time datetime="([^"]+)">([^<]+)<\/time>/);
if (!stamp || !html.includes("Last updated")) bad("homepage is missing the Last updated timestamp");
else {
  const expected = new Date(Math.max(...fetched)).toISOString();
  if (stamp[1] !== expected) bad(`timestamp ${stamp[1]} != newest fetch ${expected}`);
}

if (failed) {
  console.error(`${failed} check(s) failed`);
  process.exit(1);
}
console.log(`ok: ${live} companies, ${roles} roles, last updated ${stamp[1]}`);
