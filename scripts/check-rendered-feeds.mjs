// The rendered-board parsers must accept a page that adds up and refuse one that does not.
import assert from 'node:assert/strict';
import { parseRevolut, parseQuantumLight, parseMeta, carryEarlierDetail, titleSlug } from '../rendered-feeds.mjs';

const at = '2026-11-15T22:00:00.000Z';
const A = '531a667a-805b-47c8-8749-cc0e536ed122', B = 'a7a3f022-8230-45a1-9cf1-e392a08e2ce3';

// Slugs follow the sites' own addresses.
assert.equal(titleSlug('Credit Manager (Policy)'), 'credit-manager-policy');
assert.equal(titleSlug('FinCrime Escalations Officer (Swedish)'), 'fin-crime-escalations-officer-swedish');
assert.equal(titleSlug('Partner, Capital Formation & IR'), 'partner-capital-formation-ir');
assert.equal(titleSlug('Graduate Programme 2027: Software Engineer (Android)'), 'graduate-programme-2027-software-engineer-android');

// Revolut
const positions = [
  { id: A, text: 'Credit Manager (Policy)', team: 'Credit', locations: [{ name: 'Brazil - Remote', type: 'remote', country: 'Brazil' }, { name: 'Sao Paulo', type: 'office', country: 'Brazil' }] },
  { id: B, text: 'FinCrime Escalations Officer (Swedish)', team: 'Support', locations: [{ name: 'Poland - Remote', type: 'remote', country: 'Poland' }] },
];
const shown = [`https://www.revolut.com/careers/position/credit-manager-policy-${A}/`];
const revolut = parseRevolut({ heading: 'We have 2 open positions', positions, shownLinks: shown, observedAt: at });
assert.equal(revolut.status, 'complete');
assert.equal(revolut.rows.length, 2);
assert.equal(revolut.rows[0].url, shown[0]);
assert.equal(revolut.rows[0].location, 'Sao Paulo', 'Offices come first');
assert.deepEqual(revolut.rows[0].secondaryLocations, ['Brazil']);
assert.equal(revolut.rows[0].department, 'Credit');
assert.equal(revolut.rows[1].workplace, 'Remote');
assert.equal(revolut.rows[1].remoteEligibility, 'Remote locations published by employer: Poland');
assert.equal(parseRevolut({ heading: 'We have 3 open positions', positions, shownLinks: shown, observedAt: at }).status, 'failed', 'Count mismatch must fail');
assert.equal(parseRevolut({ heading: 'We have 2 open positions', positions: [positions[0], positions[0]], shownLinks: shown, observedAt: at }).status, 'failed', 'Duplicate ids must fail');
assert.equal(parseRevolut({ heading: 'We have 2 open positions', positions, shownLinks: ['https://www.revolut.com/careers/position/something-else/'], observedAt: at }).status, 'failed', 'A shown link we did not derive must fail');
assert.equal(parseRevolut({ heading: 'We have 2 open positions', positions, shownLinks: [], observedAt: at }).status, 'failed', 'No shown links means nothing to verify against');
assert.equal(parseRevolut({ heading: '', positions: undefined, shownLinks: [], observedAt: at }).status, 'failed');

// QuantumLight
const postings = { pages: { next: null }, count: 1, results: [{ id: A, title: 'Legal Counsel', function: { name: 'Legal' }, locations: [{ name: 'United Kingdom', type: 'office' }] }] };
const qlUrl = `https://revolutpeople.com/quantum-light/public/careers/position/legal-counsel-${A}`;
const quantum = parseQuantumLight({ heading: 'We have 1 open positions', pages: [postings], shownLinks: [qlUrl], observedAt: at });
assert.equal(quantum.status, 'complete');
assert.equal(quantum.rows[0].url, qlUrl);
assert.equal(quantum.rows[0].location, 'United Kingdom');
assert.equal(parseQuantumLight({ heading: 'We have 1 open positions', pages: [{ ...postings, pages: { next: '/x?page=2' } }], shownLinks: [qlUrl], observedAt: at }).status, 'failed', 'Unfinished paging must fail');
assert.equal(parseQuantumLight({ heading: 'We have 1 open positions', pages: [postings], shownLinks: [], observedAt: at }).status, 'failed', 'Every role must be shown on the page');

// Meta
const metaJobs = [
  { id: '704019139159184', title: 'Software Engineer', locations: ['Sunnyvale, CA', 'Remote, US', 'Sunnyvale, CA'], teams: ['Software Engineering'], sub_teams: ['Engineering', 'Software Engineering'] },
  { id: '1551507749512061', title: 'Analyst', locations: [], teams: [], sub_teams: [] },
];
const meta = parseMeta({ itemsText: '2 Items', jobs: metaJobs, observedAt: at });
assert.equal(meta.status, 'complete');
assert.equal(meta.rows[0].url, 'https://www.metacareers.com/profile/job_details/704019139159184');
assert.deepEqual(meta.rows[0].secondaryLocations, ['Remote, US']);
assert.equal(meta.rows[0].department, 'Software Engineering · Engineering');
assert.equal(meta.rows[1].locationStatus, 'unknown');
assert.equal(parseMeta({ itemsText: '1,343 Items', jobs: metaJobs, observedAt: at }).status, 'failed', 'Count mismatch must fail');
assert.equal(parseMeta({ itemsText: '2 Items', jobs: [metaJobs[0], { ...metaJobs[0] }], observedAt: at }).status, 'failed');
assert.equal(parseMeta({ itemsText: '2 Items', jobs: metaJobs }).status, 'failed', 'Capture time is required');

// Pay and first-seen date survive a refresh, even when a retitled role gets a new address.
const pay = [{ min: 1, max: 2, currency: 'USD', period: 'year' }];
const earlier = [{ id: `old-title-${A}`, url: `https://www.revolut.com/careers/position/old-title-${A}/`, payRanges: pay, firstSeen: '2026-10-26T00:00:00.000Z', detailObservedAt: '2026-10-26T01:00:00.000Z' }];
const carried = carryEarlierDetail(revolut.rows, earlier);
assert.deepEqual(carried[0].payRanges, pay);
assert.equal(carried[0].firstSeen, '2026-10-26T00:00:00.000Z');
assert.equal(carried[0].detailCarriedFrom, '2026-10-26T01:00:00.000Z');
assert.equal(carried[1].firstSeen, undefined, 'A role we have not seen before has no earlier date');
assert.deepEqual(carried[1].payRanges, []);
console.log('PASS: rendered-board parsers accept consistent captures, refuse inconsistent ones, and carry pay and first-seen dates.');
