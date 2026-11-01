// Homepage weight guard. No network.
import fs from "node:fs";
import { spawnSync } from "node:child_process";

let failed = 0;
const bad = (msg) => { console.error(msg); failed++; };
for (const file of ["build.mjs", "fetch-jobs.mjs", "check.mjs"]) {
  const r = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (r.status !== 0) bad(`${file} failed node --check\n${r.stderr}`);
}
const html = fs.readFileSync("index.html");
if (html.byteLength > 200_000) bad(`index.html is ${html.byteLength} bytes; keep role JSON out of the document`);
const text = html.toString("utf8");
if (text.includes("300x300bb")) bad("portraits should be the 200px rendition");
if (!text.includes("200x200bb")) bad("200px portraits missing");
if (!text.includes("requestIdleCallback")) bad("analytics should wait for idle");
const imgs = text.match(/<img /g) || [];
if (imgs.length < 30) bad("founder portraits missing");
if (failed) {
  console.error(`${failed} check(s) failed`);
  process.exit(1);
}
console.log(`ok: index.html ${html.byteLength} bytes, ${imgs.length} portraits`);
