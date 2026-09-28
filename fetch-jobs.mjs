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

async function roles({ kind, slug }) {
  if (kind === "greenhouse") {
    const r = await get(`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs`);
    return r?.jobs?.map((j) => ({ title: j.title, url: j.absolute_url, location: j.location?.name || "" }));
  }
  if (kind === "lever") {
    const r = await get(`https://api.lever.co/v0/postings/${slug}?mode=json`);
    return Array.isArray(r) ? r.map((j) => ({ title: j.text, url: j.hostedUrl, location: j.categories?.location || "" })) : null;
  }
  if (kind === "ashby") {
    const r = await get(`https://api.ashbyhq.com/posting-api/job-board/${slug}`);
    return r?.jobs?.filter((j) => j.isListed !== false).map((j) => ({ title: j.title, url: j.jobUrl, location: j.location || "" }));
  }
  if (kind === "smartrecruiters") {
    const r = await get(`https://api.smartrecruiters.com/v1/companies/${slug}/postings?limit=100`);
    return r?.content?.map((j) => ({ title: j.name, url: `https://jobs.smartrecruiters.com/${slug}/${j.id}`, location: j.location?.city || "" }));
  }
  if (kind === "workable") {
    const r = await get(`https://apply.workable.com/api/v1/widget/accounts/${slug}`);
    return r?.jobs?.map((j) => ({ title: j.title, url: j.url || j.shortlink, location: j.city || j.country || "" }));
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
      out.push(...r.jobPostings.map((j) => ({ title: j.title, url: `${base}/${site}${j.externalPath}`, location: j.locationsText || "" })));
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
  jobs[c.name] = list?.length ? { source: `${src.kind}:${src.slug}`, fetched: new Date().toISOString(), roles: list } : null;
  console.log(`${c.name.padEnd(40)} ${list?.length ? `${list.length} roles (${src.kind})` : "no public API, link only"}`);
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
