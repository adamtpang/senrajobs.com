// Compile GUESTS.md (research source of truth) into guests.json for the page.
import fs from "node:fs";
import { compileRoles, compileCompanies } from './board-data.mjs';
import { discoveryReports } from './discovery-reports.mjs';
import { clientRole } from './client-data.mjs';
import { careerResearch } from './career-research.mjs';
import { createExtractPrompt } from './assistant/extract-prompt.mjs';
import {matchesLocation,displayLocation} from './location-utils.mjs';
import {applyCompanyConnections} from './company-connections.mjs';
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
applyCompanyConnections(out,JSON.parse(fs.readFileSync('company-connections.json','utf8')));
fs.writeFileSync("guests.json", JSON.stringify(out, null, 2) + "\n");
console.log(out.length, "guests,", out.reduce((n, x) => n + x.companies.filter(c => c.careers).length, 0), "careers links");

// Prerender the page so crawlers and assistants see the full list without JavaScript.
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const ext = 'target="_blank" rel="noopener"';
const jobs = fs.existsSync("jobs.json") ? JSON.parse(fs.readFileSync("jobs.json", "utf8")) : {};
const photos = fs.existsSync("photos.json") ? JSON.parse(fs.readFileSync("photos.json", "utf8")) : {};
const logos = fs.existsSync('company-logos.json') ? JSON.parse(fs.readFileSync('company-logos.json', 'utf8')) : {};
const boardRoles = compileRoles(out, jobs);
for (const role of boardRoles) role.logo = logos[role.company.split(' (')[0]]?.src || '';
const companyRows = compileCompanies(out, boardRoles, logos);
const discovery=discoveryReports(out,jobs,boardRoles);
fs.mkdirSync('data',{recursive:true});fs.mkdirSync('reports',{recursive:true});
fs.writeFileSync('data/texas-roles.json',JSON.stringify(discovery.inventory,null,2)+'\n');
const csvCell=value=>'"'+String(value??'').replace(/^[=+@-]/,"'$&").replaceAll('"','""')+'"';
const texasCsv=[['Title','Company','Guests','Austin','Published locations','Work arrangement','Official posting','Observed at','Source status','Coverage'],...boardRoles.filter(role=>matchesLocation(role,'Texas')).map(role=>[role.title,role.company.split(' (')[0],role.founders.map(f=>f.name).join('; '),matchesLocation(role,'Austin, Texas')?'Yes':'No',displayLocation(role),role.workplace||'Unknown',role.url,role.observedAt,role.sourceStatus,role.coverage.status])].map(row=>row.map(csvCell).join(',')).join('\r\n');
fs.writeFileSync('data/texas-roles.csv',texasCsv+'\r\n');
fs.writeFileSync('data/coverage.json',JSON.stringify(discovery.coverage,null,2)+'\n');
fs.writeFileSync('reports/coverage.md',discovery.markdown);
const initials = (n) => n.split(" ").map((w) => w[0]).slice(0, 2).join("");
const list = out.map((g) => {
  const photo = photos[g.name]
    ? `<img src="${esc(photos[g.name])}" alt="${esc(g.name)}" width="300" height="300" loading="lazy" decoding="async">`
    : `<span class="ph" aria-hidden="true">${esc(initials(g.name))}</span>`;
  const current = g.companies.filter(c => c.note !== 'acquired or closed');
  const marks = current.map(c => {
    const name=c.name.split(' (')[0],src=logos[name]?.src;
    return src ? `<img src="${esc(src)}" alt="${esc(name)}" title="${esc(name)}" width="28" height="28" loading="lazy" decoding="async">` : `<span class="guest-company-initials" role="img" aria-label="${esc(name)}" title="${esc(name)}">${esc(initials(name))}</span>`;
  }).join('');
  const href = `?view=companies&guest=${encodeURIComponent(g.name)}`;
  return `<a class="founder" data-guest="${esc(g.name)}" href="${esc(href)}" aria-label="Explore companies connected to ${esc(g.name)}"><span class="guest-photo">${photo}</span><span class="who"><b>${esc(g.name)}<span class="guest-arrow" aria-hidden="true">→</span></b><span class="guest-companies">${marks}</span></span></a>`;
}).join("");
const companies = new Set(out.flatMap((x) => x.companies.filter((c) => c.careers).map((c) => c.name.split(" (")[0]))).size;
const fetchedDates = Object.values(jobs).filter(Boolean).map(j => Date.parse(j.fetched)).filter(Number.isFinite);
const fetchedAt = fetchedDates.length ? new Date(Math.max(...fetchedDates)) : null;
const updatedIso = fetchedAt ? fetchedAt.toISOString() : "";
const updated = fetchedAt
  ? new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(fetchedAt)
  : "unavailable";
const career = careerResearch(JSON.parse(fs.readFileSync('reports/guest-career-history.json', 'utf8')));
fs.writeFileSync('research.html', career.html);
const jsonld = {
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "WebSite", "@id": "https://senrajobs.com/#site", url: "https://senrajobs.com/", name: "Senra Jobs",
      description: "Find jobs at David Senra’s guests’ companies. Free, independent fan project.",
      publisher: { "@id": "https://senrajobs.com/#org" }, author: { "@id": "https://senrajobs.com/#adam" },
      potentialAction: { "@type": "SearchAction", target: { "@type": "EntryPoint", urlTemplate: "https://senrajobs.com/?view=roles&q={search_term_string}" }, "query-input": "required name=search_term_string" } },
    { "@type": "Organization", "@id": "https://senrajobs.com/#org", name: "Senra Jobs", url: "https://senrajobs.com/", logo: "https://senrajobs.com/og.png",
      sameAs: ["https://github.com/adamtpang/senrajobs.com", "https://x.com/adamtpang"] },
    { "@type": "Person", "@id": "https://senrajobs.com/#adam", name: "Adam Pang", sameAs: ["https://x.com/adamtpang", "https://github.com/adamtpang"] }
  ]
};
const html = fs.readFileSync("template.html", "utf8")
  .replaceAll('__CAREER_CONFIRMED__', career.confirmed).replaceAll('__CAREER_COHORT__', career.cohort).replaceAll('__CAREER_PERCENT__', career.percent)
  .replaceAll("__GUESTS__", out.length).replaceAll("__COMPANIES__", companies).replaceAll("__UPDATED_ISO__", updatedIso).replaceAll("__UPDATED__", updated).replaceAll("__ROLES__", boardRoles.length.toLocaleString("en-US"))
  .replace("__JSONLD__", JSON.stringify(jsonld).replace(/</g, "\u003c"))
  .replace('__NO_SCRIPT__', companyRows.filter(c => c.careers).map(c => `<li><a href="${esc(c.careers)}" ${ext}>${esc(c.name)} careers ↗</a>${c.connections.map(connection=>` · <a href="${esc(connection.source)}" ${ext}>${esc(connection.label)}</a>`).join('')}</li>`).join(''))
  .replace("__LIST__", list);
// Keep controls and data in one response so preview caches cannot mix releases.
const clientScript = ['job-utils.mjs','role-emoji.mjs','location-utils.mjs','board.js'].map(file => fs.readFileSync(file,'utf8').replace(/^\uFEFF/, '').replace(/^import .*;\r?\n/gm,'').replace(/^export /gm,'')).join('\n');
const rendered = html
  .replace('__ROLE_DATA__', () => JSON.stringify(boardRoles.map(clientRole)).replace(/</g, '\\u003c'))
  .replace('__COMPANY_DATA__', () => JSON.stringify(companyRows.map(({ roles, ...company }) => ({ ...company, roleUrls:roles.map(role => role.url) }))).replace(/</g, '\\u003c'))
  .replace('__GUEST_DATA__', () => JSON.stringify(out.map(guest => ({name:guest.name, episode:guest.episode, photo:photos[guest.name] || '', companies:guest.companies.filter(c => c.note !== 'acquired or closed').map(c => c.name.split(' (')[0])}))).replace(/</g,'\\u003c'))
  .replace('__COVERAGE_DATA__',()=>JSON.stringify(discovery.coverage).replace(/</g,'\\u003c'))
  .replace('__BOARD_SCRIPT__', () => `(() => {\n${clientScript}\n})();`.replace(/<\/script/gi,'<\\/script'))
  .replace('__ASSISTANT_SCRIPT__', () => `(() => {\n${['assistant/profile.mjs','assistant/interview-guide.mjs','assistant-ui.js'].map(file=>fs.readFileSync(file,'utf8').replace(/^import .*;\r?\n/gm,'').replace(/^export /gm,'')).join('\n')}\n})();`.replace(/<\/script/gi,'<\\/script'));
fs.writeFileSync("index.html", rendered);
fs.writeFileSync('interview-prompt.txt',createExtractPrompt()+'\n');
// Keep .js helpers available for direct board.js module debugging.
fs.mkdirSync('assets', { recursive:true });
fs.copyFileSync('job-utils.mjs', 'assets/job-utils.js');
fs.copyFileSync('role-emoji.mjs', 'assets/role-emoji.js');
fs.writeFileSync("robots.txt", "User-agent: *\nAllow: /\n\nSitemap: https://senrajobs.com/sitemap.xml\n");
fs.writeFileSync("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://senrajobs.com/</loc><lastmod>${new Date().toISOString().slice(0, 10)}</lastmod></url></urlset>\n`);
fs.writeFileSync("llms.txt", `# Senra Jobs\n\n> Free directory of the ${out.length} guests interviewed on the David Senra podcast, including founders and company leaders, their associated companies, and careers links. Join a great company, learn from inside, then build your own.\n\n` +
  out.map((g) => `## ${g.name}\n` + g.companies.map((c) => `- ${c.name}: ${c.careers || c.note}`).join("\n")).join("\n\n") + "\n");
