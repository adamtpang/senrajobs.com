// Static browse pages: one per sector, plus a ranking of companies by indexed open roles.
// The main directory is drawn by script, so these plain HTML pages are what a search engine
// or an assistant can land on. Sector labels come from the reviewed company-sectors.json.
import fs from 'node:fs';

export const SECTORS = [
  ['ai-software', 'AI and software', 'AI labs, AI products, developer and enterprise software, security and defense technology.'],
  ['consumer', 'Consumer and health', 'Consumer apps, marketplaces, platforms, and consumer health.'],
  ['finance', 'Finance and investing', 'Fintech, payments, crypto, wealth management, venture capital and private investment firms.'],
  ['hardware-energy-space', 'Hardware, energy and space', 'Vehicles, chips, computers, electronics, energy, space, robotics and biotech.'],
  ['logistics-industrial', 'Logistics and industrial', 'Freight, logistics, equipment rental, building products and aviation services.'],
  ['food-retail', 'Food and retail', 'Restaurants, grocery, food brands, kitchens and retail.'],
  ['media-sports-entertainment', 'Sports, media and entertainment', 'Sports, talent agencies, music, film, games, publishing and communications.'],
  ['other', 'Other', 'Companies that do not fit one of the sectors above.'],
];
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const ext = 'target="_blank" rel="noopener"';
const day = (iso) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const initials = (name) => name.split(/\s+/).slice(0, 2).map((w) => w[0]).join('');

function row(company, rank) {
  const mark = company.logo
    ? `<img class="logo" src="${esc(company.logo)}" alt="" width="40" height="40" loading="lazy">`
    : `<span class="logo initials" aria-hidden="true">${esc(initials(company.name))}</span>`;
  const guests = company.guests.length ? `<small>${esc(company.guests.join(', '))}</small>` : '';
  const count = company.roles.length;
  const checked = count && company.checked ? `<small${company.stale ? ' class="stale"' : ''}>${company.stale ? `Last checked ${day(company.checked)}, may be out of date` : `Checked ${day(company.checked)}`}</small>` : '';
  const facts = count ? `${count.toLocaleString('en-US')} roles${checked}` : company.careers ? 'Careers page' : 'No public careers page';
  const inner = `${rank ? `<span class="rank">${rank}</span>` : ''}${mark}<span class="name">${esc(company.name)}${guests}</span><span class="facts">${facts}</span>`;
  if (count) return `<li><a class="row" href="/?view=roles&amp;company=${encodeURIComponent(company.name)}">${inner}<span class="arrow" aria-hidden="true">→</span></a></li>`;
  if (company.careers) return `<li><a class="row" href="${esc(company.careers)}" ${ext}>${inner}<span class="arrow" aria-hidden="true">↗</span></a></li>`;
  return `<li><span class="row">${inner}</span></li>`;
}

function page({ path, title, heading, lede, rows, nav, generated, analytics, count }) {
  const url = `https://senrajobs.com/${path}`;
  const jsonld = { '@context': 'https://schema.org', '@type': 'CollectionPage', name: title, url, isPartOf: { '@type': 'WebSite', name: 'Senra Jobs', url: 'https://senrajobs.com/' } };
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} · senrajobs.com</title>
<link rel="canonical" href="${url}">
<meta name="description" content="${esc(lede)}">
<meta property="og:title" content="${esc(title)} · senrajobs.com">
<meta property="og:description" content="${esc(lede)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${url}">
<meta property="og:image" content="https://senrajobs.com/og.png?v=20261007">
<meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g, '\\u003c')}</script>
<link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🪜</text></svg>">
<link rel="preconnect" href="https://cdn.prod.website-files.com" crossorigin>
<link rel="stylesheet" href="https://use.typekit.net/qcy7obf.css">
<style>
  @font-face { font-family:"Schmalfette Grotesk"; src:url("https://cdn.prod.website-files.com/68a3314e7e1c857e33d93b10/68b94590f437128b666278c3_SchmalfetteGrotesk.woff2") format("woff2"); font-weight:400; font-style:normal; font-display:swap; }
  :root { --muted:#666; --line:#e3e3e3; --text-1:13px; --text-2:15px; --text-3:18px; --text-4:20px; --text-5:24px; }
  * { box-sizing:border-box; }
  body { margin:0; color:#000; background:#fff; font:var(--text-3)/1.4 "tt-commons-pro",Arial,sans-serif; -webkit-font-smoothing:antialiased; }
  main { max-width:860px; margin:auto; padding:40px 40px 96px; }
  a { color:inherit; text-underline-offset:4px; }
  :focus-visible { outline:2px solid #000; outline-offset:3px; }
  .wordmark { display:inline-flex; align-items:center; min-height:44px; font:400 36px/.9 "Schmalfette Grotesk",Impact,sans-serif; letter-spacing:-.01em; text-decoration:none; }
  .independence { margin:6px 0 0; color:var(--muted); font-size:var(--text-1); }
  .back { display:inline-flex; align-items:center; min-height:44px; margin-top:12px; font-size:var(--text-2); text-decoration:none; }
  .back:hover { text-decoration:underline; }
  h1 { font-size:var(--text-5); font-weight:500; line-height:1.1; margin:8px 0 0; }
  .lede { margin:8px 0 0; color:var(--muted); font-size:var(--text-2); max-width:640px; }
  .count { margin:20px 0 12px; color:var(--muted); font-size:var(--text-1); }
  ul { list-style:none; margin:0; padding:0; }
  .row { display:flex; align-items:center; gap:16px; min-height:76px; padding:14px 0; border-top:1px solid var(--line); text-decoration:none; }
  a.row:hover .name { text-decoration:underline; }
  .rank { width:28px; flex-shrink:0; color:var(--muted); font-size:var(--text-1); font-variant-numeric:tabular-nums; }
  .logo { width:40px; height:40px; flex-shrink:0; object-fit:contain; }
  .initials { display:grid; place-items:center; background:#f3f3f3; font-size:var(--text-1); font-weight:600; }
  .name { flex:1; min-width:0; font-size:var(--text-4); font-weight:500; overflow-wrap:anywhere; }
  .name small { display:block; margin-top:3px; color:var(--muted); font-size:var(--text-1); font-weight:400; }
  .facts { color:var(--muted); font-size:var(--text-2); text-align:right; flex-shrink:0; max-width:46%; }
  .facts small { display:block; margin-top:2px; font-size:var(--text-1); }
  .facts small.stale { color:#000; }
  .arrow { font-size:var(--text-4); flex-shrink:0; }
  nav.sectors { display:flex; flex-wrap:wrap; gap:0 20px; margin-top:40px; padding-top:16px; border-top:1px solid var(--line); font-size:var(--text-2); }
  nav.sectors a { display:inline-flex; align-items:center; min-height:44px; min-width:44px; }
  nav.sectors a[aria-current="page"] { text-decoration:none; font-weight:600; }
  footer { margin-top:24px; color:var(--muted); font-size:var(--text-1); }
  @media(max-width:650px) { main { padding:28px 16px 96px; } .row { gap:12px; } .facts { font-size:var(--text-1); max-width:40%; } }
</style>
${analytics}
</head>
<body>
<main>
  <a class="wordmark" href="/">senrajobs.com</a>
  <p class="independence">Independent fan project. Not affiliated with David Senra or Founders.</p>
  <a class="back" href="/">← Guests</a>
  <h1>${esc(heading)}</h1>
  <p class="lede">${esc(lede)}</p>
  <p class="count">${esc(count)}</p>
  <ul>${rows}</ul>
  <nav class="sectors" aria-label="Browse by sector">${nav}</nav>
  <footer>Role counts are indexed postings from each company's public job board, not a complete hiring total. Updated ${esc(generated)}.</footer>
</main>
</body>
</html>
`;
}

// Returns the public paths written and the home page link row. Writes nothing when no labels exist.
export function buildSectorPages({ companyRows, labels, generated, analytics = '' }) {
  if (!labels) return { paths: [], homeLinks: '', missing: [] };
  const rows = companyRows.filter((c) => c.guests.length);
  const missing = rows.filter((c) => !labels[c.name]).map((c) => c.name);
  const bySector = new Map(SECTORS.map(([slug]) => [slug, []]));
  for (const company of rows) {
    const slug = labels[company.name]?.sector;
    bySector.get(bySector.has(slug) ? slug : 'other').push(company);
  }
  const order = (a, b) => b.roles.length - a.roles.length || a.name.localeCompare(b.name);
  const live = SECTORS.filter(([slug]) => bySector.get(slug).length);
  const navFor = (current) => live.map(([slug, label]) => `<a href="/sectors/${slug}"${slug === current ? ' aria-current="page"' : ''}>${esc(label)}</a>`).join('') + `<a href="/companies/most-roles"${current === 'most-roles' ? ' aria-current="page"' : ''}>Most open roles</a>`;
  fs.rmSync('sectors', { recursive: true, force: true });
  fs.mkdirSync('sectors', { recursive: true });
  fs.mkdirSync('companies', { recursive: true });
  const paths = [];
  for (const [slug, label, blurb] of live) {
    const list = bySector.get(slug).sort(order);
    const roles = list.reduce((n, c) => n + c.roles.length, 0);
    fs.writeFileSync(`sectors/${slug}.html`, page({
      path: `sectors/${slug}`, title: `${label} companies from the David Senra podcast`, heading: label,
      lede: `${blurb} Companies that guests of the David Senra podcast founded, lead or helped build, with their open roles.`,
      rows: list.map((c) => row(c)).join(''), nav: navFor(slug), generated, analytics,
      count: `${list.length} ${list.length === 1 ? 'company' : 'companies'} · ${roles.toLocaleString('en-US')} indexed roles`,
    }));
    paths.push(`sectors/${slug}`);
  }
  const top = rows.filter((c) => c.roles.length).sort(order).slice(0, 25);
  fs.writeFileSync('companies/most-roles.html', page({
    path: 'companies/most-roles', title: 'Companies with the most open roles', heading: 'Most open roles',
    lede: 'The 25 companies on Senra Jobs with the most indexed open roles, across every sector.',
    rows: top.map((c, i) => row(c, i + 1)).join(''), nav: navFor('most-roles'), generated, analytics,
    count: `Top ${top.length} of ${rows.filter((c) => c.roles.length).length} companies with indexed roles`,
  }));
  paths.push('companies/most-roles');
  return { paths, homeLinks: navFor(''), missing };
}
