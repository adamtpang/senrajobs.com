// Parsers for three careers sites that refuse plain HTTP requests but hand a real browser their
// whole public list in one page load. scripts/capture-rendered-boards.mjs does the browsing;
// these functions only turn what the page returned into role rows, and refuse anything that
// does not add up (count mismatch, duplicate ids, a link the page itself does not show).
const fail = (endpoint, observedAt, reason) => ({ rows: [], status: 'failed', reason, endpoint, observedAt });
// Both Revolut sites build a role's address from its title, split into lowercase words.
export const titleSlug = (title) => (String(title).normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/['’]/g, '')
  .match(/[A-Z]{2,}(?=[A-Z][a-z]|\d|\b|[^A-Za-z0-9])|[A-Z]?[a-z]+|[A-Z]+|\d+/g) || []).map((word) => word.toLowerCase()).join('-');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// Office and remote places, in the order the employer's own pages print them: offices first.
function placeFields(places, sourceUrl, observedAt) {
  const clean = (place) => String(place.name || '').replace(/\s*-\s*Remote$/i, '').trim();
  const office = places.filter((p) => p.type === 'office').map(clean).filter(Boolean);
  const remote = places.filter((p) => p.type === 'remote').map(clean).filter(Boolean);
  const locations = [...office.map((raw) => ({ raw, workplace: 'Office' })), ...remote.map((raw) => ({ raw, workplace: 'Remote' }))]
    .map((l) => ({ ...l, source: 'employer-public-page', sourceUrl, observedAt, confidence: 'published' }));
  return {
    location: locations[0]?.raw || '', secondaryLocations: [...new Set(locations.slice(1).map((l) => l.raw))], locations,
    workplace: remote.length && !office.length ? 'Remote' : '', publishedOfficeLocations: office, publishedRemoteLocations: remote,
    remoteEligibility: remote.length ? `Remote locations published by employer: ${remote.join(', ')}` : '',
    locationStatus: locations.length ? 'published' : 'unknown',
  };
}

function finish(rows, endpoint, observedAt, source, what) {
  return { rows, status: 'complete', source, endpoint, observedAt, total: rows.length, pages: 1,
    reason: `All ${rows.length} ${what} collected in one page load by the local browser run. Pay is carried over from earlier detail reads of the same role, not re-read.`,
    pageReceipts: [{ url: endpoint, page: 1, total: rows.length, rows: rows.length }] };
}

// capture: { heading: "We have 254 open positions", positions: [...from the page data], shownLinks: [hrefs on screen], observedAt }
export function parseRevolut(capture) {
  const endpoint = 'https://www.revolut.com/careers/', { observedAt } = capture;
  const total = Number(String(capture.heading || '').match(/^We have (\d+) open positions$/)?.[1]);
  const positions = capture.positions;
  if (!Number.isFinite(Date.parse(observedAt))) return fail(endpoint, observedAt, 'Capture time missing');
  if (!Array.isArray(positions) || !Number.isSafeInteger(total) || total < 1) return fail(endpoint, observedAt, 'Advertised total or position list missing');
  if (positions.length !== total) return fail(endpoint, observedAt, `Page advertises ${total} positions but its data holds ${positions.length}`);
  const seen = new Set(), rows = [];
  for (const position of positions) {
    const title = String(position.text || '').trim();
    if (!UUID.test(position.id || '') || !title || seen.has(position.id) || !Array.isArray(position.locations)) return fail(endpoint, observedAt, 'Invalid or duplicate position record');
    seen.add(position.id);
    const id = `${titleSlug(title)}-${position.id}`;
    rows.push({ id, url: `${endpoint}position/${id}/`, sourceUrl: endpoint, observedAt, sourceStatus: 'current', title,
      ...placeFields(position.locations, endpoint, observedAt), unexpandedLocationCount: 0, department: String(position.team || ''), pay: null, payRanges: [] });
  }
  // The page shows only its first cards. Every link it does show must be one we derived.
  const urls = new Set(rows.map((row) => row.url)), shown = capture.shownLinks || [];
  if (!shown.length || shown.some((url) => !urls.has(url))) return fail(endpoint, observedAt, 'Derived role links do not match the links shown on the page');
  return finish(rows, endpoint, observedAt, 'local:revolut-rendered', 'positions in the careers page data');
}

// capture: { heading, pages: [responses of the public postings endpoint], shownLinks, observedAt }
export function parseQuantumLight(capture) {
  const endpoint = 'https://revolutpeople.com/quantum-light/public/careers', { observedAt } = capture;
  const total = Number(String(capture.heading || '').match(/^We have (\d+) open positions$/)?.[1]);
  const pages = capture.pages || [];
  if (!Number.isFinite(Date.parse(observedAt))) return fail(endpoint, observedAt, 'Capture time missing');
  if (!pages.length || pages.at(-1)?.pages?.next != null) return fail(endpoint, observedAt, 'Posting pages missing or not exhausted');
  const results = pages.flatMap((page) => page.results || []);
  if (!Number.isSafeInteger(total) || results.length !== total || pages[0].count !== total) return fail(endpoint, observedAt, `Page advertises ${total} positions but the list holds ${results.length}`);
  const seen = new Set(), rows = [];
  for (const posting of results) {
    const title = String(posting.title || '').trim();
    if (!UUID.test(posting.id || '') || !title || seen.has(posting.id) || !Array.isArray(posting.locations)) return fail(endpoint, observedAt, 'Invalid or duplicate posting record');
    seen.add(posting.id);
    const url = `${endpoint}/position/${titleSlug(title)}-${posting.id}`;
    rows.push({ id: posting.id, title, url, sourceUrl: endpoint, observedAt, sourceStatus: 'current',
      ...placeFields(posting.locations, endpoint, observedAt), department: String(posting.function?.name || ''), pay: null, payRanges: [] });
  }
  const shown = new Set(capture.shownLinks || []);
  if (shown.size !== rows.length || rows.some((row) => !shown.has(row.url))) return fail(endpoint, observedAt, 'Derived role links do not match the links shown on the page');
  return finish(rows, endpoint, observedAt, 'local:quantumlight-rendered', 'postings on the public careers page');
}

// capture: { itemsText: "1343 Items", jobs: [...all_jobs from the search response], observedAt }
export function parseMeta(capture) {
  const endpoint = 'https://www.metacareers.com/jobsearch/', { observedAt } = capture;
  const total = Number(String(capture.itemsText || '').match(/^([\d,]+) Items$/)?.[1]?.replaceAll(',', ''));
  const jobs = capture.jobs;
  if (!Number.isFinite(Date.parse(observedAt))) return fail(endpoint, observedAt, 'Capture time missing');
  if (!Array.isArray(jobs) || !Number.isSafeInteger(total) || total < 1) return fail(endpoint, observedAt, 'Advertised total or job list missing');
  if (jobs.length !== total) return fail(endpoint, observedAt, `Search advertises ${total} jobs but its data holds ${jobs.length}`);
  const seen = new Set(), rows = [];
  for (const job of jobs) {
    const title = String(job.title || '').trim();
    if (!/^\d{6,25}$/.test(job.id || '') || !title || seen.has(job.id) || !Array.isArray(job.locations)) return fail(endpoint, observedAt, 'Invalid or duplicate job record');
    seen.add(job.id);
    const places = [...new Set(job.locations.map((place) => String(place || '').trim()).filter(Boolean))];
    const url = `https://www.metacareers.com/profile/job_details/${job.id}`;
    rows.push({ id: job.id, title, url, sourceUrl: endpoint, observedAt, sourceStatus: 'current', location: places[0] || '', secondaryLocations: places.slice(1),
      locations: places.map((raw) => ({ raw, sourceUrl: endpoint, observedAt, source: 'employer-public-page', confidence: 'published' })),
      locationStatus: places.length ? 'published' : 'unknown',
      department: [...new Set([...(job.teams || []), ...(job.sub_teams || [])].map((name) => String(name || '').trim()).filter(Boolean))].join(' · '), pay: null, payRanges: [] });
  }
  return finish(rows, endpoint, observedAt, 'local:meta-rendered', 'jobs in the careers search data');
}

// Keep what an earlier detail read established for the same posting (matched by its id, because a
// retitled Revolut role gets a new address), and keep the date we first saw it.
const CARRIED = ['pay', 'payRanges', 'publishedCompensationText', 'employmentType'];
const stableId = (role) => String(role.id || role.url || '').match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|\d{6,25}$/)?.[0] || role.url;
export function carryEarlierDetail(rows, previousRoles = []) {
  const earlier = new Map(previousRoles.map((role) => [stableId(role), role]));
  return rows.map((row) => {
    const old = earlier.get(stableId(row));
    if (!old) return row;
    const kept = {};
    for (const field of CARRIED) {
      const empty = (value) => value == null || value === '' || (Array.isArray(value) && !value.length);
      if (empty(row[field]) && !empty(old[field])) kept[field] = old[field];
    }
    const firstSeen = old.firstSeen || old.observedAt;
    return { ...row, ...kept, ...(Object.keys(kept).length ? { detailCarriedFrom: old.detailObservedAt || old.detailCarriedFrom || old.observedAt } : {}), ...(firstSeen ? { firstSeen } : {}) };
  });
}
