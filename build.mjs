// Compile GUESTS.md (research source of truth) into guests.json for the page.
import fs from "node:fs";
import { createHash } from "node:crypto";
import { compileRoles, compileCompanies } from './board-data.mjs';
import { discoveryReports } from './discovery-reports.mjs';
import { clientRole } from './client-data.mjs';
import { careerResearch } from './career-research.mjs';
import { createExtractPrompt } from './assistant/extract-prompt.mjs';
import {matchesLocation,displayLocation} from './location-utils.mjs';
import {applyCompanyConnections} from './company-connections.mjs';
import { isInWindow, feedItem, formatPay, trackIds, isRemote } from './feed.mjs';
import { matchCatalog, normalize } from './founders-catalog.mjs';
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
const targets = fs.existsSync('targets.json') ? JSON.parse(fs.readFileSync('targets.json','utf8')) : [];
const knownUrls = new Set(boardRoles.map(role => role.url));
for (const target of targets) {
  const board = jobs[target.name];
  if (!board?.roles?.length) continue;
  for (const role of board.roles) {
    if (!role?.url || knownUrls.has(role.url)) continue;
    knownUrls.add(role.url);
    const { pageReceipts, partitionReceipt, ...roleCoverage } = board.coverage || { status: 'complete' };
    boardRoles.push({ ...role, company: target.name, careers: target.careers || board.careersUrl || '', founders: [], companyAssociations: [target.name], coverage: role.coverage?.status ? role.coverage : roleCoverage, fetched: board.fetched, observedAt: role.observedAt || board.fetched, sourceUrl: role.sourceUrl || board.sourceUrl || role.url, sourceStatus: role.sourceStatus || 'current' });
  }
}
for (const role of boardRoles) role.logo = logos[role.company.split(' (')[0]]?.src || '';
const companyRows = compileCompanies(out, boardRoles, logos);
for (const target of targets) {
  const board = jobs[target.name];
  if (!board?.roles?.length || companyRows.some(row => row.name === target.name)) continue;
  companyRows.push({ name: target.name, logo: '', guests: [], connections: [], careers: target.careers || '', note: target.boardName ? `Board name: ${target.boardName}` : 'Target company', roles: boardRoles.filter(role => role.company === target.name) });
}
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
  const photoUrl = photos[g.name] ? photos[g.name].replace(/\/\d+x\d+bb(\.[a-z]+)?/i, "/200x200bb$1") : "";
  const photo = photoUrl
    ? `<img src="${esc(photoUrl)}" alt="${esc(g.name)}" width="200" height="200" loading="lazy" decoding="async">`
    : `<span class="ph" aria-hidden="true">${esc(initials(g.name))}</span>`;
  const current = g.companies.filter(c => c.note !== 'acquired or closed');
  const marks = current.map(c => {
    const name=c.name.split(' (')[0],src=logos[name]?.src;
    return src ? `<img src="${esc(src)}" alt="${esc(name)}" title="${esc(name)}" width="32" height="32" loading="lazy" decoding="async">` : `<span class="guest-company-initials" role="img" aria-label="${esc(name)}" title="${esc(name)}">${esc(initials(name))}</span>`;
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
// Keep controls and data in one content-hashed script so preview caches cannot mix releases,
// while the HTML document stays small enough for crawlers and fast first paint.
const stripModule = file => fs.readFileSync(file,'utf8').replace(/^\uFEFF/, '').replace(/^import .*;\r?\n/gm,'').replace(/^export /gm,'');
const clientScript = ['job-utils.mjs','role-emoji.mjs','location-utils.mjs','board.js'].map(stripModule).join('\n');
const boardData = {
  'role-data': boardRoles.map(clientRole),
  'company-data': companyRows.map(({ roles, ...company }) => ({ ...company, roleUrls:roles.map(role => role.url) })),
  'coverage-data': discovery.coverage
};
const assistantScript = ['assistant/profile.mjs','assistant/interview-guide.mjs','assistant-ui.js'].map(stripModule).join('\n');
const appBundle = `(() => {\nconst __senraData = ${JSON.stringify(boardData)};\n${clientScript}\n})();\n(() => {\n${assistantScript}\n})();\n`;
const appHash = createHash('sha256').update(appBundle).digest('hex').slice(0, 16);
fs.rmSync('assets/app', { recursive: true, force: true });
fs.mkdirSync('assets/app', { recursive: true });
fs.writeFileSync(`assets/app/app.${appHash}.js`, appBundle);
const rendered = html
  .replace('__GUEST_DATA__', () => JSON.stringify(out.map(guest => ({name:guest.name, episode:guest.episode, photo:photos[guest.name] ? photos[guest.name].replace(/\/\d+x\d+bb(\.[a-z]+)?/i, "/200x200bb$1") : '', companies:guest.companies.filter(c => c.note !== 'acquired or closed').map(c => c.name.split(' (')[0])}))).replace(/</g,'\\u003c'))
  .replace('__APP_SCRIPT__', `/assets/app/app.${appHash}.js`);
// The CSP in vercel.json allows the inline analytics loader by hash. Fail the build if they drift.
const csp = JSON.parse(fs.readFileSync('vercel.json','utf8')).headers.flatMap(rule => rule.headers).find(h => h.key === 'Content-Security-Policy')?.value || '';
const analyticsInline = rendered.match(/<script data-posthog-fleet>([\s\S]*?)<\/script>/)?.[1];
if (analyticsInline !== undefined) {
  const analyticsHash = `'sha256-${createHash('sha256').update(analyticsInline).digest('base64')}'`;
  if (!csp.includes(analyticsHash)) throw new Error(`vercel.json Content-Security-Policy must allow the analytics loader: ${analyticsHash}`);
}
const themeBoot = 'try{var t=localStorage.getItem("senrajobs-theme");if(t==="senra"||t==="founders")document.documentElement.setAttribute("data-theme",t);}catch(e){}';
const themeHash = `'sha256-${createHash('sha256').update(themeBoot).digest('base64')}'`;
if (!rendered.includes(themeBoot)) throw new Error('Theme boot script missing from the page');
if (!csp.includes(themeHash)) throw new Error(`vercel.json Content-Security-Policy must allow the theme boot script: ${themeHash}`);
fs.writeFileSync("index.html", rendered);
fs.writeFileSync('interview-prompt.txt',createExtractPrompt()+'\n');
// Keep .js helpers available for direct board.js module debugging.
fs.mkdirSync('assets', { recursive:true });
fs.copyFileSync('job-utils.mjs', 'assets/job-utils.js');
fs.copyFileSync('role-emoji.mjs', 'assets/role-emoji.js');
fs.writeFileSync("robots.txt", "User-agent: *\nAllow: /\n\nSitemap: https://senrajobs.com/sitemap.xml\n");
const anchorMs = Math.max(0, ...boardRoles.map(role => Date.parse(role.observedAt || role.fetched || role.firstSeen || "")).filter(Number.isFinite), ...Object.values(jobs).filter(Boolean).map(board => Date.parse(board.fetched)).filter(Number.isFinite));
const anchor = new Date(anchorMs || Date.now());
const seenUrls = new Set();
const fresh = [];
for (const role of boardRoles) {
  if (!role?.url || seenUrls.has(role.url) || !isInWindow(role, anchor.getTime())) continue;
  seenUrls.add(role.url);
  fresh.push(feedItem(role));
}
fresh.sort((a, b) => (Date.parse(b.postedAt || b.firstSeen) || 0) - (Date.parse(a.postedAt || a.firstSeen) || 0) || a.company.localeCompare(b.company) || a.title.localeCompare(b.title));
fs.writeFileSync("new.json", JSON.stringify({ generatedAt: anchor.toISOString(), windowHours: 48, page: "https://senrajobs.com/new", json: "https://senrajobs.com/new.json", rss: "https://senrajobs.com/new.xml", roles: fresh }) + "\n");
const xmlEsc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const rssItems = fresh.map((role) => {
  const payText = formatPay(role.pay);
  const bits = [role.location, role.remote === true ? "Remote" : "", payText ? `Pay posted: ${payText}` : "", role.firstSeen ? `First seen ${role.firstSeen}` : "", role.postedAt ? `Posted ${role.postedAt}` : ""].filter(Boolean);
  const when = role.postedAt || role.firstSeen || anchor.toISOString();
  return `  <item>\n    <title>${xmlEsc(`${role.company} — ${role.title}`)}</title>\n    <link>${xmlEsc(role.url)}</link>\n    <guid isPermaLink="true">${xmlEsc(role.url)}</guid>\n    <pubDate>${xmlEsc(new Date(when).toUTCString())}</pubDate>\n    <description>${xmlEsc(bits.join(" · "))}</description>\n  </item>`;
}).join("\n");
fs.writeFileSync("new.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0">\n<channel>\n  <title>Senra Jobs — new roles</title>\n  <link>https://senrajobs.com/new</link>\n  <description>Roles first seen or posted in the 48 hours before ${xmlEsc(anchor.toISOString())}.</description>\n  <lastBuildDate>${xmlEsc(anchor.toUTCString())}</lastBuildDate>\n${rssItems}\n</channel>\n</rss>\n`);
const generatedLabel = new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(anchor);
const rows = fresh.map((role) => {
  const austin = /\baustin\b|\btexas\b|\btx\b/i.test(role.location || "");
  const tracks = trackIds(role.title).join(" ");
  const payText = formatPay(role.pay);
  const sub = [role.company, role.location, role.remote === true ? "Remote" : "", role.firstSeen ? `First seen ${String(role.firstSeen).slice(0, 10)}` : "", role.postedAt ? `Posted ${String(role.postedAt).slice(0, 10)}` : ""].filter(Boolean).join(" · ");
  return `<li data-austin="${austin ? "1" : "0"}" data-remote="${role.remote === true ? "1" : "0"}" data-tracks="${esc(tracks)}"><a href="${esc(role.url)}" ${ext}>${esc(role.title)}</a><span class="sub">${esc(sub)}</span>${payText ? `<span class="pay">${esc(payText)}</span>` : ""}</li>`;
}).join("");
fs.writeFileSync("new.html", fs.readFileSync("new-template.html","utf8").replaceAll("__COUNT__", fresh.length.toLocaleString("en-US")).replaceAll("__GENERATED__", esc(generatedLabel)).replace("__LIST__", rows));
const foundersCatalog = JSON.parse(fs.readFileSync('data/founders-episodes.json', 'utf8'));
const foundersEpisodes = matchCatalog(foundersCatalog.episodes, out);
const foundersDate = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' });
const durationLabel = seconds => {
  if (!seconds) return '';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} hr ${minutes % 60} min`;
};
const foundersList = foundersEpisodes.map(episode => {
  const when = episode.published ? `<time datetime="${esc(episode.published)}">${esc(foundersDate.format(new Date(episode.published)))}</time>` : '';
  const length = durationLabel(episode.durationSeconds);
  const meta = [when, length].filter(Boolean).join(' · ');
  const official = episode.url
    ? `<a href="${esc(episode.url)}" ${ext}>Episode page ↗</a>`
    : `<a href="${esc(foundersCatalog.show)}" ${ext}>Show page ↗</a><span class="ep-gap">No episode page in the public sitemap.</span>`;
  const people = episode.guests.map(name => `<a href="/?view=companies&amp;guest=${encodeURIComponent(name)}">${esc(name)} on the board</a>`);
  const companies = episode.companies.map(company => `<a href="/?view=roles&amp;company=${encodeURIComponent(company.name)}">${esc(company.name)} roles</a>`);
  const board = episode.companies.length ? '1' : '0';
  const search = normalize([episode.number, episode.title, episode.subject, episode.summary, ...episode.guests, ...episode.companies.map(company => company.name)].filter(Boolean).join(' '));
  return `<article class="episode" data-board="${board}" data-search="${esc(search)}"><p class="ep-num">${episode.number ? esc(String(episode.number)) : '—'}</p><div class="episode-body"><h2>${esc(episode.subject)}</h2>${meta ? `<p class="ep-meta">${meta}</p>` : ''}${episode.summary ? `<p class="ep-summary">${esc(episode.summary)}</p>` : ''}<p class="ep-links">${official}${people.join('')}${companies.join('')}</p></div></article>`;
}).join('');
const foundersFetched = foundersCatalog.fetchedOn ? foundersDate.format(new Date(foundersCatalog.fetchedOn)) : 'the catalog date';
fs.writeFileSync('founders.html', fs.readFileSync('founders-template.html', 'utf8')
  .replaceAll('__COUNT__', foundersEpisodes.length.toLocaleString('en-US'))
  .replaceAll('__LINKED__', foundersEpisodes.filter(episode => episode.url).length.toLocaleString('en-US'))
  .replaceAll('__FETCHED__', esc(foundersFetched))
  .replaceAll('__FEED__', esc(foundersCatalog.feed))
  .replace('__LIST__', foundersList));
fs.writeFileSync("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://senrajobs.com/</loc><lastmod>${anchor.toISOString().slice(0, 10)}</lastmod></url><url><loc>https://senrajobs.com/founders</loc><lastmod>${(foundersCatalog.fetchedOn || anchor.toISOString()).slice(0, 10)}</lastmod></url><url><loc>https://senrajobs.com/new</loc><lastmod>${anchor.toISOString().slice(0, 10)}</lastmod></url><url><loc>https://senrajobs.com/about.html</loc></url><url><loc>https://senrajobs.com/privacy.html</loc></url><url><loc>https://senrajobs.com/research.html</loc></url></urlset>\n`);
fs.writeFileSync("llms.txt", `# Senra Jobs\n\n> Free directory of the ${out.length} guests interviewed on the David Senra podcast, including founders and company leaders, their associated companies, and careers links. Join a great company, learn from inside, then build your own. Independent fan project, not affiliated with David Senra or Founders.\n\nFounders podcast episodes, linked to jobs only when the episode title names a person or company already on this board: https://senrajobs.com/founders\n\nNew roles from the 48 hours before the latest observation: https://senrajobs.com/new.json (page https://senrajobs.com/new, RSS https://senrajobs.com/new.xml). Pay is included only when the board posted it.\n\n` +
  out.map((g) => `## ${g.name}\n` + g.companies.map((c) => `- ${c.name}: ${c.careers || c.note}`).join("\n")).join("\n\n") +
  (targets.length ? `\n\n## Target companies\n` + targets.map((t) => `- ${t.name}: ${t.careers}${t.boardName ? ` (board name: ${t.boardName})` : ""}`).join("\n") : "") + "\n");
