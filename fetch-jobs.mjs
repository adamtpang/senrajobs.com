// Pull live roles for every company in guests.json from public job-board APIs, plus guest portraits
// from the show's Apple Podcasts episode artwork. Writes jobs.json and photos.json; build.mjs renders them.
// Run: node build.mjs && node fetch-jobs.mjs && node build.mjs
import fs from "node:fs";

const guests = JSON.parse(fs.readFileSync("guests.json", "utf8"));
const UA = { "user-agent": "Mozilla/5.0 (senrajobs.com job index)" };
const get = async (url, json = true) => {
  try {
    const r = await fetch(url, { headers: UA, redirect: "follow", signal: AbortSignal.timeout(15000) });
    if (!r.ok) return null;
    return json ? await r.json() : { url: r.url, text: await r.text() };
  } catch { return null; }
};

const PATTERNS = [
  ["greenhouse", /(?:boards|job-boards)(?:\.eu)?\.greenhouse\.io\/(?:embed\/job_board(?:\/js)?\?for=)?([a-z0-9_-]+)/i],
  ["greenhouse", /boards-api\.greenhouse\.io\/v1\/boards\/([a-z0-9_-]+)/i],
  ["lever", /jobs(?:\.eu)?\.lever\.co\/([a-z0-9_.-]+)/i],
  ["ashby", /jobs\.ashbyhq\.com\/([a-z0-9_.%-]+)/i],
  ["smartrecruiters", /(?:careers|jobs)\.smartrecruiters\.com\/([a-z0-9_-]+)/i],
  ["workable", /apply\.workable\.com\/([a-z0-9_-]+)/i],
  ["workday", /([a-z0-9-]+)\.(wd\d+)\.myworkdayjobs\.com\/(?:[a-z]{2}-[A-Z]{2}\/)?([A-Za-z0-9_-]+)/],
];
const NOT_SLUGS = new Set(["embed", "api", "v1", "js", "static", "assets", "jobs", "careers"]);

async function detect(careers) {
  for (const [kind, re] of PATTERNS) { const m = careers.match(re); if (m && !NOT_SLUGS.has(m[1].toLowerCase())) return { kind, slug: kind === "workday" ? `${m[1]}|${m[2]}|${m[3]}` : m[1] }; }
  const page = await get(careers, false);
  if (!page) return null;
  const hay = page.url + " " + page.text;
  for (const [kind, re] of PATTERNS) { const m = hay.match(re); if (m && !NOT_SLUGS.has(m[1].toLowerCase())) return { kind, slug: kind === "workday" ? `${m[1]}|${m[2]}|${m[3]}` : m[1] }; }
  return null;
}

const numberOrNull = (value) => (typeof value === "number" && Number.isFinite(value) ? value : null);
const posted = (value) => {
  if (value == null || value === "") return null;
  const raw = typeof value === "number" ? new Date(value).toISOString() : String(value);
  return Number.isFinite(Date.parse(raw)) ? raw : null;
};
const pay = (min, max, currency, period, text) => {
  const body = { min: numberOrNull(min), max: numberOrNull(max), currency: currency || null, period: period || null, text: text || null };
  return body.min == null && body.max == null && !body.text ? null : body;
};
function ashbyPay(job) {
  const c = job.compensation;
  if (!c || typeof c !== "object") return null;
  const tier = Array.isArray(c.compensationTiers) ? c.compensationTiers.find((t) => numberOrNull(t?.minValue) != null || numberOrNull(t?.maxValue) != null) : null;
  if (tier) return pay(tier.minValue, tier.maxValue, tier.currency || tier.currencyCode, tier.interval, null);
  const text = [c.scrapeableCompensationSalarySummary, c.compensationTierSummary].find((s) => typeof s === "string" && s.trim());
  return text ? pay(null, null, null, null, text.trim()) : null;
}
function asNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}
function greenhousePay(job) {
  // Only the board's own pay-transparency fields. Skip midpoints and other bands so we don't pick a number the posting didn't present as the range.
  const ranges = [];
  const notes = [];
  for (const meta of job.metadata || []) {
    const name = meta?.name || "";
    if (!/pay transparency|salary range|compensation range/i.test(name)) continue;
    const value = meta.value;
    if (typeof value === "string" && value.trim()) { notes.push(`${name}: ${value.trim()}`); continue; }
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const min = asNumber(value.min_value ?? value.min);
    const max = asNumber(value.max_value ?? value.max);
    if (min == null && max == null) continue;
    ranges.push({ name, min, max, currency: value.unit || value.currency || null });
  }
  if (ranges.length === 1 && notes.length === 0) return pay(ranges[0].min, ranges[0].max, ranges[0].currency, null, null);
  const text = [
    ...ranges.map((r) => `${r.name}: ${[r.currency, [r.min, r.max].filter((part) => part != null).join("–")].filter(Boolean).join(" ")}`),
    ...notes,
  ].join("; ");
  return text ? pay(null, null, null, null, text) : null;
}
const remoteFromText = (location) => (/\bremote\b/i.test(location || "") ? true : null);
const workplaceRemote = (value) => {
  const w = String(value || "").toLowerCase().replace(/[\s_]/g, "-");
  if (w === "remote") return true;
  if (w === "hybrid" || w === "on-site" || w === "onsite") return false;
  return null;
};

async function roles({ kind, slug }) {
  if (kind === "greenhouse") {
    const r = await get(`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs`);
    return r?.jobs?.map((j) => ({
      title: j.title,
      url: j.absolute_url,
      location: j.location?.name || "",
      remote: remoteFromText(j.location?.name),
      postedAt: posted(j.first_published),
      pay: greenhousePay(j),
    }));
  }
  if (kind === "lever") {
    const r = await get(`https://api.lever.co/v0/postings/${slug}?mode=json`);
    return Array.isArray(r) ? r.map((j) => {
      const flagged = workplaceRemote(j.workplaceType);
      return {
        title: j.text,
        url: j.hostedUrl,
        location: j.categories?.location || "",
        remote: flagged === null ? remoteFromText(j.categories?.location) : flagged,
        postedAt: posted(j.createdAt),
        pay: j.salaryRange ? pay(j.salaryRange.min, j.salaryRange.max, j.salaryRange.currency, j.salaryRange.interval, null) : null,
      };
    }) : null;
  }
  if (kind === "ashby") {
    const r = await get(`https://api.ashbyhq.com/posting-api/job-board/${slug}`);
    return r?.jobs?.filter((j) => j.isListed !== false).map((j) => ({
      title: j.title,
      url: j.jobUrl,
      location: j.location || "",
      remote: j.isRemote === true ? true : j.isRemote === false ? false : workplaceRemote(j.workplaceType),
      postedAt: posted(j.publishedAt),
      pay: ashbyPay(j),
    }));
  }
  if (kind === "smartrecruiters") {
    const r = await get(`https://api.smartrecruiters.com/v1/companies/${slug}/postings?limit=100`);
    return r?.content?.map((j) => ({
      title: j.name,
      url: `https://jobs.smartrecruiters.com/${slug}/${j.id}`,
      location: j.location?.city || "",
      remote: j.location?.remote === true ? true : remoteFromText(j.location?.city),
      postedAt: posted(j.releasedDate),
      pay: null,
    }));
  }
  if (kind === "workable") {
    const r = await get(`https://apply.workable.com/api/v1/widget/accounts/${slug}`);
    return r?.jobs?.map((j) => ({
      title: j.title,
      url: j.url || j.shortlink,
      location: [j.city, j.state || j.country].filter(Boolean).join(", "),
      remote: j.telecommuting === true ? true : j.telecommuting === false ? false : null,
      postedAt: posted(j.published_on || j.created_at),
      pay: null,
    }));
  }
  if (kind === "workday") {
    // Public Workday candidate API (the same JSON the careers page uses). Paged, capped at 200 roles.
    const [tenant, wd, site] = slug.split("|");
    const base = `https://${tenant}.${wd}.myworkdayjobs.com`;
    const out = [];
    let total = 0;
    for (let offset = 0; offset < 200; offset += 20) {
      let r;
      try {
        const res = await fetch(`${base}/wday/cxs/${tenant}/${site}/jobs`, { method: "POST", headers: { ...UA, "content-type": "application/json" },
          body: JSON.stringify({ appliedFacets: {}, limit: 20, offset, searchText: "" }), signal: AbortSignal.timeout(15000) });
        r = res.ok ? await res.json() : null;
      } catch { r = null; }
      if (!r?.jobPostings?.length) break;
      if (r.total) total = r.total; // Workday only reports the total on the first page
      out.push(...r.jobPostings.map((j) => ({
        title: j.title,
        url: `${base}/${site}${j.externalPath}`,
        location: j.locationsText || "",
        remote: workplaceRemote(j.remoteType) === null ? remoteFromText(j.locationsText) : workplaceRemote(j.remoteType),
        postedAt: posted(/\d{4}/.test(j.postedOn || "") ? j.postedOn : null),
        pay: null,
      })));
      if (out.length >= total) break;
    }
    return out.length ? out : null;
  }
  return null;
}

// Guess a Greenhouse board by name only when the board's own name matches the company (no wrong-company roles).
async function guessGreenhouse(name) {
  const slug = name.toLowerCase().replace(/\(.*?\)/g, "").replace(/[^a-z0-9]/g, "");
  const board = await get(`https://boards-api.greenhouse.io/v1/boards/${slug}`);
  const norm = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  return board && norm(board.name).startsWith(slug.slice(0, 5)) ? { kind: "greenhouse", slug } : null;
}

// Boards found by hand (slug checked against the company) where the careers page hides the ATS.
const OVERRIDES = {
  OpenAI: { kind: "ashby", slug: "openai" },
  ElevenLabs: { kind: "ashby", slug: "elevenlabs" },
  "Base Power": { kind: "ashby", slug: "base-power" },
  "Neko Health": { kind: "ashby", slug: "neko-health" },
  Snap: { kind: "workday", slug: "snapchat|wd1|snap" },
  "Nvidia (Ross joined as Chief Software Architect, 2026)": { kind: "workday", slug: "nvidia|wd5|NVIDIAExternalCareerSite" },
};

const jobs = {};
const previous = fs.existsSync("jobs.json") ? JSON.parse(fs.readFileSync("jobs.json", "utf8")) : {};
const prevByUrl = new Map();
for (const entry of Object.values(previous)) {
  if (!entry?.roles) continue;
  for (const role of entry.roles) {
    if (role?.url && !prevByUrl.has(role.url)) prevByUrl.set(role.url, role.firstSeen || entry.fetched || null);
  }
}
const seenNow = new Date().toISOString();
const stamp = (role) => {
  if (!role?.title || !role?.url) return null;
  return {
    title: role.title,
    url: role.url,
    location: role.location || "",
    remote: role.remote === true ? true : role.remote === false ? false : null,
    pay: role.pay || null,
    postedAt: role.postedAt || null,
    firstSeen: prevByUrl.get(role.url) || seenNow,
  };
};
const tasks = guests.flatMap((g) => g.companies.filter((c) => c.careers).map((c) => c));
const byCareers = new Map(); // one fetch per board, shared by guests who list the same company
await Promise.all(tasks.map(async (c) => {
  if (!byCareers.has(c.careers)) byCareers.set(c.careers, (async () => {
  let src = OVERRIDES[c.name] || (await detect(c.careers));
  let list = src && (await roles(src));
  if (!list?.length) { const g = await guessGreenhouse(c.name); if (g) { src = g; list = await roles(g); } }
  return { src, list };
  })());
  const { src, list } = await byCareers.get(c.careers);
  if (list == null && previous[c.name]?.roles?.length) {
    jobs[c.name] = previous[c.name];
    console.log(`${c.name.padEnd(40)} kept ${previous[c.name].roles.length} previous roles (fetch failed)`);
  } else if (list?.length) {
    jobs[c.name] = { source: `${src.kind}:${src.slug}`, fetched: seenNow, roles: list.map(stamp).filter(Boolean) };
    console.log(`${c.name.padEnd(40)} ${jobs[c.name].roles.length} roles (${src.kind})`);
  } else {
    jobs[c.name] = null;
    console.log(`${c.name.padEnd(40)} no public API, link only`);
  }
}));
fs.writeFileSync("jobs.json", JSON.stringify(jobs, null, 1) + "\n");

// Portraits: the show's episode artwork is a portrait of each guest. Match by Apple episode id.
const feed = await get("https://itunes.apple.com/lookup?id=1836497887&entity=podcastEpisode&limit=200");
const byId = Object.fromEntries((feed?.results || []).filter((x) => x.trackId).map((x) => [String(x.trackId), x.artworkUrl600]));
const photos = {};
for (const g of guests) {
  const id = g.episode?.url?.match(/[?&]i=(\d+)/)?.[1];
  if (id && byId[id]) photos[g.name] = byId[id].replace("600x600bb", "300x300bb");
}
fs.writeFileSync("photos.json", JSON.stringify(photos, null, 1) + "\n");
const withRoles = Object.values(jobs).filter(Boolean);
console.log(`\n${withRoles.length}/${tasks.length} companies with live roles, ${withRoles.reduce((n, j) => n + j.roles.length, 0)} roles total, ${Object.keys(photos).length}/${guests.length} photos`);
