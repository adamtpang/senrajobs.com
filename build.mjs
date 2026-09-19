// Compile GUESTS.md (research source of truth) into guests.json for the page.
import fs from "node:fs";
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
  .replaceAll("__GUESTS__", out.length).replaceAll("__COMPANIES__", companies).replaceAll("__UPDATED__", updated).replaceAll("__ROLES__", Object.values(jobs).reduce((n, j) => n + (j?.roles.length || 0), 0).toLocaleString("en-US"))
  .replace("__JSONLD__", JSON.stringify(jsonld).replace(/</g, "\u003c"))
  .replace("__LIST__", list);
fs.writeFileSync("index.html", html);
fs.writeFileSync("robots.txt", "User-agent: *\nAllow: /\n\nSitemap: https://senrajobs.com/sitemap.xml\n");
fs.writeFileSync("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://senrajobs.com/</loc><lastmod>${new Date().toISOString().slice(0, 10)}</lastmod></url></urlset>\n`);
fs.writeFileSync("llms.txt", `# Senra Jobs\n\n> Free directory of the ${out.length} living founders interviewed on the David Senra podcast, their companies, and careers links. Join a great founder, learn from inside, then build your own.\n\n` +
  out.map((g) => `## ${g.name}\n` + g.companies.map((c) => `- ${c.name}: ${c.careers || c.note}`).join("\n")).join("\n\n") + "\n");
