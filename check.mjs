// Feed rules and syntax. No network.
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import { isInWindow, matchesPlace, matchesTrack, formatPay, WINDOW_MS } from "./feed.mjs";

let failed = 0;
const bad = (msg) => { console.error(msg); failed++; };
const eq = (cond, msg) => { if (!cond) bad(msg); };

for (const file of ["fetch-jobs.mjs", "build.mjs", "feed.mjs", "check.mjs"]) {
  const r = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (r.status !== 0) bad(`${file} failed node --check\n${r.stderr}`);
}

const now = Date.parse("2026-11-01T18:00:00.000Z");
eq(isInWindow({ firstSeen: "2026-11-01T16:00:00.000Z" }, now), "seen 2h ago should be inside 48h");
eq(!isInWindow({ firstSeen: "2026-09-30T12:00:00.000Z" }, now), "seen on Sep 30 should be outside 48h");
eq(isInWindow({ firstSeen: "2026-09-30T12:00:00.000Z", postedAt: "2026-11-01T12:00:00.000Z" }, now), "old role posted today should be inside");
eq(matchesPlace({ location: "Austin, TX", remote: false }, "austin-texas"), "Austin, TX");
eq(matchesPlace({ location: "Remote - TX", remote: null }, "remote"), "location says Remote");
eq(matchesPlace({ location: "United States", remote: true }, "remote"), "remote flag");
eq(!matchesPlace({ location: "Hawthorne, CA", remote: null }, "remote"), "onsite city is not remote");
eq(matchesPlace({ location: "Austin, TX", remote: false }, "either"), "either includes Austin");
eq(matchesTrack({ title: "Forward Deployed Engineer" }, "forward-deployed"), "FDE");
eq(matchesTrack({ title: "Software Engineer, Applied AI" }, "applied-ai"), "applied AI");
eq(matchesTrack({ title: "AI Agent Engineer" }, "ai-agents"), "AI agent");
eq(matchesTrack({ title: "Solutions Engineer, Enterprise" }, "solutions-engineer"), "solutions engineer");
eq(!matchesTrack({ title: "Software Engineer" }, "applied-ai"), "plain SWE is not applied AI");
eq(formatPay(null) == null, "missing pay stays blank");
eq(formatPay({ min: 50, max: 70, currency: "USD", period: "hour" }) === "USD 50–70 hour", "hourly pay is not annualized");
eq(WINDOW_MS === 48 * 60 * 60 * 1000, "window is 48 hours");

const feed = JSON.parse(fs.readFileSync("new.json", "utf8"));
const generated = Date.parse(feed.generatedAt);
eq(feed.windowHours === 48, "windowHours");
eq(feed.json === "https://senrajobs.com/new.json", "json url");
eq(Array.isArray(feed.roles) && feed.roles.length > 0, "feed has roles");
const urls = new Set();
for (const role of feed.roles) {
  for (const key of ["company", "title", "location", "url", "firstSeen"]) if (!role[key]) bad(`missing ${key}`);
  if (![true, false, null].includes(role.remote)) bad("remote must be true, false, or null");
  if (!isInWindow(role, generated)) bad(`outside window: ${role.title}`);
  if (urls.has(role.url)) bad(`duplicate ${role.url}`);
  urls.add(role.url);
  if (role.pay) {
    for (const key of Object.keys(role.pay)) if (!["min", "max", "currency", "period", "text"].includes(key)) bad(`unexpected pay field ${key}`);
    if (role.pay.min != null && typeof role.pay.min !== "number") bad("pay.min invented");
    if (typeof role.pay.text === "string" && role.pay.text.includes("[object Object]")) bad("pay text stringified an object");
  }
}
const xml = fs.readFileSync("new.xml", "utf8");
eq(xml.includes("<rss version=\"2.0\">"), "rss root");
eq(fs.readFileSync("index.html", "utf8").includes('href="/new"'), "homepage links to /new");
eq(fs.readFileSync("new.html", "utf8").includes("https://senrajobs.com/new.json"), "page documents the json url");
eq(fs.readFileSync("llms.txt", "utf8").includes("https://senrajobs.com/new.json"), "llms.txt documents the json url");

if (failed) {
  console.error(`${failed} check(s) failed`);
  process.exit(1);
}
console.log(`ok: ${feed.roles.length} roles in the 48h feed at ${feed.generatedAt}`);
