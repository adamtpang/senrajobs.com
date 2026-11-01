// Compile GUESTS.md (research source of truth) into guests.json for the page.
import fs from "node:fs";
import { isInWindow, feedItem, formatPay, placeFlags, trackIds } from "./feed.mjs";
const out = [];
let g = null;
for (const line of fs.readFileSync("GUESTS.md", "utf8").split(/\r?\n/)) {
  const h = line.match(/^## (.+?) \(episodes?: (.+?), (\d{4}-\d{2}-\d{2}), (https?:[^\s)]+)/);
  if (h) { g = { name: h[1], episode: { title: `${h[2]} (${h[3]})`, url: h[4] }, companies: [] }; out.push(g); continue; }
  const c = line.match(/^- ([^:]+?): (.+)$/);
  if (!c || !g) continue;
  const url = (c[2].match(/https?:\/\/[^\s;)]+/) || [])[0];
  const dead = /404|no public careers|no careers/i.test(c[2]);
  if (url && !dead) g.companies.push({ name: c[1], careers: url });
  else if (/defunct|acquired|skipped/i.test(c[2])) g.companies.push({ name: c[1], note: "acquired or closed" });
  else g.companies.push({ name: c[1], note: "no public careers page yet" });
}
fs.writeFileSync("guests.json", JSON.stringify(out, null, 2) + "\n");
console.log(out.length, "guests,", out.reduce((n, x) => n + x.companies.filter(c => c.careers).length, 0), "careers links");

// Prerender the page so crawlers and assistants see the full list without JavaScript.
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const ext = 'target="_blank" rel="noopener"';
const jobs = fs.existsSync("jobs.json") ? JSON.parse(fs.readFileSync("jobs.json", "utf8")) : {};
const photos = fs.existsSync("photos.json") ? JSON.parse(fs.readFileSync("photos.json", "utf8")) : {};
const SHOW = 12; // roles inline per company; the rest live behind "all roles" to keep the page light
const initials = (n) => n.split(" ").map((w) => w[0]).slice(0, 2).join("");
const list = out.map((g) => {
  const photo = photos[g.name]
    ? `<img src="${esc(photos[g.name])}" alt="${esc(g.name)}" width="300" height="300" loading="lazy" decoding="async">`
    : `<span class="ph" aria-hidden="true">${esc(initials(g.name))}</span>`;
  const live = g.companies.reduce((n, c) => n + (jobs[c.name]?.roles.length || 0), 0);
  const meta = `${g.companies.length} compan${g.companies.length === 1 ? "y" : "ies"}${live ? ` · ${live} open roles` : ""}`;
  const cos = g.companies.map((c) => {
    const j = jobs[c.name];
    if (!c.careers) return `<div class="co off"><span class="tab">📁 ${esc(c.name)}</span><span class="note">${esc(c.note)}</span></div>`;
    if (!j) return `<div class="co"><a class="tab" href="${esc(c.careers)}" ${ext}>📁 ${esc(c.name)}</a><span class="note">roles on their careers site ↗</span></div>`;
    const rows = j.roles.slice(0, SHOW).map((r) => `<li><a href="${esc(r.url)}" ${ext}>${esc(r.title)}</a>${r.location ? `<span class="loc">${esc(r.location)}</span>` : ""}</li>`).join("");
    const more = j.roles.length > SHOW ? `<li class="more"><a href="${esc(c.careers)}" ${ext}>All ${j.roles.length} roles at ${esc(c.name)} ↗</a></li>` : "";
    return `<details class="co"><summary class="tab">📁 ${esc(c.name)}<span class="count">${j.roles.length}</span></summary><ul class="roles">${rows}${more}</ul></details>`;
  }).join("");
  const ep = g.episode ? `<a class="listen" href="${esc(g.episode.url)}" ${ext}>🎧 ${esc(g.episode.title)}</a>` : "";
  return `<details class="founder"><summary>${photo}<span class="who"><b>${esc(g.name)}</b><span class="meta">${meta}</span></span></summary><div class="inner">${ep}<div class="cos">${cos}</div></div></details>`;
}).join("");
const companies = new Set(out.flatMap((x) => x.companies.filter((c) => c.careers).map((c) => c.name.split(" (")[0]))).size;
const updated = new Date(Math.max(0, ...Object.values(jobs).filter(Boolean).map((j) => Date.parse(j.fetched)))).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const jsonld = {
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "WebSite", "@id": "https://senrajobs.com/#site", url: "https://senrajobs.com/", name: "Senra Jobs",
      description: "Work for the founders David Senra interviews. Learn from inside. Then build your own.",
      publisher: { "@id": "https://senrajobs.com/#org" }, author: { "@id": "https://senrajobs.com/#adam" },
      potentialAction: { "@type": "SearchAction", target: { "@type": "EntryPoint", urlTemplate: "https://senrajobs.com/?q={search_term_string}" }, "query-input": "required name=search_term_string" } },
    { "@type": "Organization", "@id": "https://senrajobs.com/#org", name: "Senra Jobs", url: "https://senrajobs.com/", logo: "https://senrajobs.com/og.png",
      sameAs: ["https://github.com/adamtpang/senrajobs.com", "https://x.com/adamtpang"] },
    { "@type": "Person", "@id": "https://senrajobs.com/#adam", name: "Adam Pang", sameAs: ["https://x.com/adamtpang", "https://github.com/adamtpang"] }
  ]
};
const html = fs.readFileSync("template.html", "utf8")
  .replaceAll("__GUESTS__", out.length).replaceAll("__COMPANIES__", companies).replaceAll("__UPDATED__", updated).replaceAll("__ROLES__", [...new Map(Object.values(jobs).filter(Boolean).map((j) => [j.source, j.roles.length])).values()].reduce((n, x) => n + x, 0).toLocaleString("en-US"))
  .replace("__JSONLD__", JSON.stringify(jsonld).replace(/</g, "\u003c"))
  .replace("__LIST__", list);
fs.writeFileSync("index.html", html);
fs.writeFileSync("robots.txt", "User-agent: *\nAllow: /\n\nSitemap: https://senrajobs.com/sitemap.xml\n");
fs.writeFileSync("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://senrajobs.com/</loc><lastmod>${new Date().toISOString().slice(0, 10)}</lastmod></url></urlset>\n`);
fs.writeFileSync("llms.txt", `# Senra Jobs\n\n> Free directory of the ${out.length} living founders interviewed on the David Senra podcast, their companies, and careers links. Join a great founder, learn from inside, then build your own.\n\nNew roles, first seen or posted in the 48 hours before the last fetch: https://senrajobs.com/new.json (RSS: https://senrajobs.com/new.xml, page: https://senrajobs.com/new). Pay is included only when the company's board posted it.\n\n` +
  out.map((g) => `## ${g.name}\n` + g.companies.map((c) => `- ${c.name}: ${c.careers || c.note}`).join("\n")).join("\n\n") + "\n");

const fetchedTimes = Object.values(jobs).filter(Boolean).map((j) => Date.parse(j.fetched)).filter((n) => Number.isFinite(n));
const generatedAt = new Date(fetchedTimes.length ? Math.max(...fetchedTimes) : Date.now());
const seen = new Map();
for (const [company, entry] of Object.entries(jobs)) {
  if (!entry?.roles) continue;
  for (const role of entry.roles) {
    if (!role?.url || seen.has(role.url) || !isInWindow(role, generatedAt.getTime())) continue;
    seen.set(role.url, feedItem(company, role));
  }
}
const fresh = [...seen.values()].sort((a, b) => (Date.parse(b.postedAt || b.firstSeen) || 0) - (Date.parse(a.postedAt || a.firstSeen) || 0) || a.title.localeCompare(b.title));
const feedDoc = { generatedAt: generatedAt.toISOString(), windowHours: 48, page: "https://senrajobs.com/new", json: "https://senrajobs.com/new.json", rss: "https://senrajobs.com/new.xml", roles: fresh };
fs.writeFileSync("new.json", JSON.stringify(feedDoc) + "\n");
const xmlEsc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const items = fresh.map((role) => {
  const payText = formatPay(role.pay);
  const bits = [role.location, role.remote === true ? "Remote" : "", payText ? `Pay posted: ${payText}` : "", `First seen ${role.firstSeen}`, role.postedAt ? `Posted ${role.postedAt}` : ""].filter(Boolean);
  const when = role.postedAt || role.firstSeen;
  return `  <item>\n    <title>${xmlEsc(role.company + " — " + role.title)}</title>\n    <link>${xmlEsc(role.url)}</link>\n    <guid isPermaLink="true">${xmlEsc(role.url)}</guid>\n    <pubDate>${xmlEsc(new Date(when).toUTCString())}</pubDate>\n    <description>${xmlEsc(bits.join(" · "))}</description>\n  </item>`;
}).join("\n");
fs.writeFileSync("new.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0">\n<channel>\n  <title>Senra Jobs — new roles</title>\n  <link>https://senrajobs.com/new</link>\n  <description>Roles first seen or posted in the 48 hours before ${xmlEsc(generatedAt.toISOString())}.</description>\n  <lastBuildDate>${xmlEsc(generatedAt.toUTCString())}</lastBuildDate>\n${items}\n</channel>\n</rss>\n`);
const generatedLabel = new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(generatedAt);
const rows = fresh.map((role) => {
  const flags = placeFlags(role);
  const tracks = trackIds(role.title).join(" ");
  const payText = formatPay(role.pay);
  const sub = [role.company, role.location, role.remote === true ? "Remote" : "", `First seen ${role.firstSeen.slice(0, 10)}`, role.postedAt ? `Posted ${String(role.postedAt).slice(0, 10)}` : ""].filter(Boolean).join(" · ");
  return `<li data-austin="${flags.austinTexas ? "1" : "0"}" data-remote="${flags.remote ? "1" : "0"}" data-tracks="${esc(tracks)}"><a href="${esc(role.url)}" ${ext}>${esc(role.title)}</a><span class="sub">${esc(sub)}</span>${payText ? `<span class="pay">${esc(payText)}</span>` : ""}</li>`;
}).join("");
const newHtml = fs.readFileSync("new-template.html", "utf8").replaceAll("__COUNT__", fresh.length.toLocaleString("en-US")).replaceAll("__GENERATED__", esc(generatedLabel)).replace("__LIST__", rows);
fs.writeFileSync("new.html", newHtml);
fs.writeFileSync("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://senrajobs.com/</loc><lastmod>${generatedAt.toISOString().slice(0, 10)}</lastmod></url><url><loc>https://senrajobs.com/new</loc><lastmod>${generatedAt.toISOString().slice(0, 10)}</lastmod></url></urlset>\n`);
