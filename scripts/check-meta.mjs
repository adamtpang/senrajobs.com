// Structural checks on the stored Meta board. Counts change every week, so nothing is pinned.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const jobs = JSON.parse(fs.readFileSync('jobs.json', 'utf8'));
const board = jobs['Meta (chief AI officer, not founder)'];
assert(board, 'Meta board missing');
assert(board.roles.length > 0, 'Meta board is empty');
assert.equal(new Set(board.roles.map((r) => r.url)).size, board.roles.length, 'Meta role URLs must be unique');
assert(Number.isFinite(Date.parse(board.fetched)), 'Meta board needs a fetch date');
const receipts = board.coverage.pageReceipts;
if (receipts) assert.equal(receipts.reduce((n, p) => n + p.rows, 0), board.roles.length, 'Page receipts must account for every role');
for (const r of board.roles) {
  assert.match(r.url, /^https:\/\/www\.metacareers\.com\/profile\/job_details\/\d+$/);
  assert(r.title && typeof r.title === 'string');
  assert.equal(r.locationStatus, r.locations.length ? 'published' : 'unknown');
  assert(!r.locations.some((l) => /show less|\+\d+ more|\+\d+ location/.test(l.raw)));
  assert(r.locations.every((l) => !r.department.split(' · ').includes(l.raw)));
  assert(r.pay === null, 'Location-specific compensation must not become a universal range');
  for (const pay of r.payRanges) {
    assert.equal(pay.currency, 'USD'); assert.equal(pay.location, 'United States of America');
    assert(pay.min > 0 && pay.max >= pay.min); assert(['year', 'month', 'hour'].includes(pay.period));
  }
}
console.log(`PASS: Meta board has ${board.roles.length} unique roles, ${board.roles.filter((r) => !r.locations.length).length} with unknown location, ${board.roles.filter((r) => r.payRanges.length).length} with scoped pay ranges.`);
