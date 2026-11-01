// Confirms every target board in targets.json was fetched into jobs.json. No network.
import fs from "node:fs";
import { spawnSync } from "node:child_process";

let failed = 0;
const bad = (msg) => { console.error(msg); failed++; };
for (const file of ["fetch-jobs.mjs", "build.mjs", "check.mjs"]) {
  const r = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (r.status !== 0) bad(`${file} failed node --check\n${r.stderr}`);
}

const targets = JSON.parse(fs.readFileSync("targets.json", "utf8"));
const jobs = JSON.parse(fs.readFileSync("jobs.json", "utf8"));
const html = fs.readFileSync("index.html", "utf8");
const names = new Set(targets.map((t) => t.name));
for (const banned of ["Tesla", "Terafab"]) {
  if (names.has(banned)) bad(`${banned} has no verified public board and must not be listed`);
}
if (!jobs["Base Power"] || jobs["Base Power"].source !== "ashby:base-power") bad("Base Power should stay on the existing ashby:base-power board");
for (const t of targets) {
  const entry = jobs[t.name];
  const expect = `${t.source.kind}:${t.source.slug}`;
  if (!entry?.roles?.length) bad(`${t.name} has no roles`);
  else if (entry.source !== expect) bad(`${t.name} source ${entry.source} != ${expect}`);
  if (!html.includes(t.name)) bad(`homepage missing ${t.name}`);
}
if (!html.includes('id="targets"')) bad("target section missing");
const aalo = jobs["Aalo Atomics"];
if (aalo && !aalo.roles.some((r) => /austin/i.test(r.location || ""))) bad("Aalo Atomics roles should include Austin");
if ((jobs.SpaceX?.roles.length || 0) < 500) bad("SpaceX board looks truncated");

if (failed) {
  console.error(`${failed} check(s) failed`);
  process.exit(1);
}
const added = targets.reduce((n, t) => n + jobs[t.name].roles.length, 0);
console.log(`ok: ${targets.map((t) => `${t.name} ${jobs[t.name].roles.length}`).join(", ")}; ${added} target roles`);
