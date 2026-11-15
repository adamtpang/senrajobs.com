// Roles from a board we can no longer refresh stop being listed after a set number of days.
// A failed refresh normally keeps the last verified roles, which is right for a short outage.
// For a board with no automated path it means showing postings nobody has checked in weeks.
// Listed here: company name (text before any parenthetical) and the days its last good fetch stays valid.
import fs from 'node:fs';

export const EXPIRE_AFTER_DAYS = {
  Tesla: 14, // careers search answers 403 to automated requests; the last capture was a manual browser pass
};

export function expireStaleBoards(jobs, now = Date.now()) {
  const expired = [];
  for (const [name, board] of Object.entries(jobs)) {
    const days = EXPIRE_AFTER_DAYS[name.split(' (')[0]];
    if (!days || !board?.roles?.length) continue;
    const failed = board.refreshFailed === true || board.coverage?.status === 'failed';
    const fetched = Date.parse(board.fetched);
    if (!failed || !Number.isFinite(fetched) || now - fetched <= days * 864e5) continue;
    board.expired = { at: new Date(now).toISOString(), lastFetched: board.fetched, rolesDropped: board.roles.length, afterDays: days };
    board.roles = [];
    board.coverage = { ...board.coverage, status: 'failed', listingStatus: 'failed', retained: false, reason: `Roles removed after ${days} days without a successful refresh. ${board.coverage?.reason || ''}`.trim() };
    delete board.coverage.pageReceipts;
    delete board.coverage.partitionReceipt;
    expired.push({ name, ...board.expired });
  }
  return expired;
}

// Run directly to apply the rule to jobs.json without a full refresh.
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split(/[\\/]/).pop())) {
  const jobs = JSON.parse(fs.readFileSync('jobs.json', 'utf8'));
  const expired = expireStaleBoards(jobs);
  if (expired.length) fs.writeFileSync('jobs.json', JSON.stringify(jobs, null, 1) + '\n');
  console.log(expired.length ? expired.map((e) => `Expired ${e.rolesDropped} roles from ${e.name} (last fetched ${e.lastFetched})`).join('\n') : 'Nothing to expire.');
}
