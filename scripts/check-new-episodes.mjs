// Cheap new-episode detector for the scheduled watcher. No model calls, no writes.
// Reads the official David Senra feed and reports interview episodes whose guest is not
// yet in guests.json. Prints "NONE" when the site is current, otherwise one line per episode.
// Exit 0 = current, 10 = new episodes found, 1 = feed unreachable (try again next run).
import fs from 'node:fs';
import {reconcileFeed} from './audit-coverage.mjs';

const guests = JSON.parse(fs.readFileSync(new URL('../guests.json', import.meta.url), 'utf8'));
let xml;
try {
  const res = await fetch('https://feeds.megaphone.fm/david-senra', {signal: AbortSignal.timeout(20000)});
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  xml = await res.text();
} catch (err) {
  console.log(`FEED_ERROR ${err.message}`);
  process.exitCode = 1;
}
if (xml) {
const feed = reconcileFeed(xml, guests);
const fresh = feed.unresolved || [];
if (!fresh.length) console.log('NONE');
for (const ep of fresh) console.log(`NEW ${ep.date} | ${ep.title} | ${ep.url}`);
if (fresh.length) process.exitCode = 10;
}
