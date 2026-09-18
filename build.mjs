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
const list = out.map((g) => {
  const ep = g.episode ? `<li class="listen"><a href="${esc(g.episode.url)}" ${ext}>🎧 ${esc(g.episode.title)}</a></li>` : "";
  const lis = g.companies.map((c) => c.careers
    ? `<li><b>${esc(c.name)}</b> · <a href="${esc(c.careers)}" ${ext}>open roles</a></li>`
    : `<li><b>${esc(c.name)}</b><span class="note"> · ${esc(c.note)}</span></li>`).join("");
  return `<details><summary>${esc(g.name)}</summary><ul>${ep}${lis}</ul></details>`;
}).join("\n");
const companies = out.reduce((n, x) => n + x.companies.filter((c) => c.careers).length, 0);
const jsonld = {
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "WebSite", "@id": "https://senrajobs.com/#site", url: "https://senrajobs.com/", name: "Senra Jobs",
      description: "Work for the founders David Senra interviews. Learn from inside. Then build your own.", publisher: { "@id": "https://senrajobs.com/#org" } },
    { "@type": "Organization", "@id": "https://senrajobs.com/#org", name: "Senra Jobs", url: "https://senrajobs.com/",
      sameAs: ["https://github.com/adamtpang/senrajobs.com", "https://x.com/adamtpang"] },
    { "@type": "ItemList", name: "Founders interviewed on the David Senra podcast", numberOfItems: out.length,
      itemListElement: out.map((g, i) => ({ "@type": "ListItem", position: i + 1, item: { "@type": "Person", name: g.name,
        worksFor: g.companies.filter((c) => c.careers).map((c) => ({ "@type": "Organization", name: c.name, url: c.careers })) } })) }
  ]
};
const html = fs.readFileSync("template.html", "utf8")
  .replaceAll("__GUESTS__", out.length).replaceAll("__COMPANIES__", companies)
  .replace("__JSONLD__", JSON.stringify(jsonld).replace(/</g, "\u003c"))
  .replace("__LIST__", list);
fs.writeFileSync("index.html", html);
fs.writeFileSync("robots.txt", "User-agent: *\nAllow: /\n\nSitemap: https://senrajobs.com/sitemap.xml\n");
fs.writeFileSync("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://senrajobs.com/</loc><lastmod>${new Date().toISOString().slice(0, 10)}</lastmod></url></urlset>\n`);
fs.writeFileSync("llms.txt", `# Senra Jobs\n\n> Free directory of the ${out.length} living founders interviewed on the David Senra podcast, their companies, and careers links. Join a great founder, learn from inside, then build your own.\n\n` +
  out.map((g) => `## ${g.name}\n` + g.companies.map((c) => `- ${c.name}: ${c.careers || c.note}`).join("\n")).join("\n\n") + "\n");
