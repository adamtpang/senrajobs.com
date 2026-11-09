import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseFeed, sitemapEpisodeUrls, attachOfficialUrls, matchCatalog, normalize } from '../founders-catalog.mjs';

const feed = `<?xml version="1.0"?><rss><channel>
<item><title>#436 Ari Emanuel's Autobiography</title><pubDate>Mon, 05 Oct 2026 10:00:00 -0000</pubDate><itunes:episode>436</itunes:episode><itunes:duration>4185</itunes:duration><description>What I learned from reading Ari Emanuel. Made possible by: AppLovin: https://applovin.com</description><guid>ari</guid></item>
<item><title>How Shopify's Tobi Lutke works</title><pubDate>Mon, 01 Jan 2024 00:00:00 -0000</pubDate><description>A note.</description><guid>tobi</guid></item>
<item><title>#1 No sitemap page</title><description>Hello.</description><guid>old</guid></item>
<item><title>#98 Enzo Ferrari</title><description>The man and the machine.</description><guid>enzo</guid></item>
<item><title>#83 Nikola Tesla and the Race to Electrify</title><description>History.</description><guid>nikola</guid></item>
<item><title>#12 How Tesla Will Change The World</title><description>Cars.</description><guid>cars</guid></item>
</channel></rss>`;
const sitemap = `<?xml version="1.0"?><urlset>
<url><loc>https://www.founderspodcast.com/episodes/436-ari-emanuels-autobiography</loc></url>
<url><loc>https://www.founderspodcast.com/</loc></url>
</urlset>`;
const parsed = parseFeed(feed);
assert.equal(parsed.length, 6);
assert.equal(parsed[0].number, 436);
assert.equal(parsed[0].subject, "Ari Emanuel's Autobiography");
assert.ok(!/applovin/i.test(parsed[0].summary), 'Sponsor copy after “Made possible by” must not be kept');
assert.equal(parsed[0].durationSeconds, 4185);
const attached = attachOfficialUrls(parsed, sitemapEpisodeUrls(sitemap));
assert.equal(attached.warnings.length, 0);
assert.equal(attached.episodes.find(episode => episode.number === 436).url, 'https://www.founderspodcast.com/episodes/436-ari-emanuels-autobiography');
assert.equal(attached.episodes.find(episode => episode.guid === 'old').url, null);

const guests = [
  { name: 'Ari Emanuel', companies: [{ name: 'WME Group', careers: 'https://example.com/wme' }] },
  { name: 'Adam Foroughi', companies: [{ name: 'AppLovin', careers: 'https://example.com/app' }] },
  { name: 'Tobi Lutke', companies: [{ name: 'Shopify', careers: 'https://example.com/shop' }] },
  { name: 'Luca Ferrari', companies: [{ name: 'Bending Spoons', careers: 'https://example.com/spoons' }] },
  { name: 'Someone Else', companies: [{ name: 'Ramp', careers: 'https://example.com/ramp' }, { name: 'Tesla', careers: 'https://example.com/tesla' }] }
];
const matched = matchCatalog(attached.episodes, guests);
const ari = matched.find(episode => episode.number === 436);
assert.deepEqual(ari.guests, ['Ari Emanuel']);
assert.ok(ari.companies.some(company => company.name === 'WME Group' && company.via === 'guest'));
assert.ok(!ari.companies.some(company => company.name === 'AppLovin'), 'A sponsor named only in the notes must not become a company link');
const tobi = matched.find(episode => episode.guid === 'tobi');
assert.ok(tobi.guests.includes('Tobi Lutke') || tobi.companies.some(company => company.name === 'Shopify'));
assert.equal(matched.find(episode => episode.guid === 'old').companies.length, 0);
assert.equal(matched.find(episode => episode.guid === 'enzo').companies.length, 0, 'Enzo Ferrari must not inherit Luca Ferrari’s companies');
assert.equal(matched.find(episode => episode.guid === 'nikola').companies.length, 0, 'Nikola Tesla must not match the car company');
assert.ok(matched.find(episode => episode.guid === 'cars').companies.some(company => company.name === 'Tesla'));

const catalog = JSON.parse(fs.readFileSync('data/founders-episodes.json', 'utf8'));
assert.ok(catalog.episodes.length > 100, 'The public feed snapshot should cover the show');
assert.equal(catalog.feed, 'https://feeds.megaphone.fm/DSLLC6297708582');
assert.ok(catalog.episodes.every(episode => episode.url === null || episode.url.startsWith('https://www.founderspodcast.com/episodes/')));
assert.equal(new Set(catalog.episodes.map(episode => episode.guid).filter(Boolean)).size, catalog.episodes.filter(episode => episode.guid).length);
const live = matchCatalog(catalog.episodes, JSON.parse(fs.readFileSync('guests.json', 'utf8')));
const liveAri = live.find(episode => episode.number === 436);
assert.ok(liveAri && liveAri.guests.includes('Ari Emanuel'), 'Episode 436 should meet the Ari Emanuel guest record');
assert.ok(liveAri.companies.some(company => company.name === 'WME Group'));
assert.ok(!live.some(episode => episode.summary && /made possible by/i.test(episode.summary)));

const pages = ['index.html', 'about.html', 'privacy.html', 'research.html', 'new.html', 'founders.html'];
const boot = 'localStorage.getItem("senrajobs-theme")';
for (const page of pages) {
  const html = fs.readFileSync(page, 'utf8');
  assert.ok(html.includes('data-theme="senra"'), page);
  assert.ok(html.includes(boot), page);
  assert.ok(html.includes('/assets/theme.css'), page);
  assert.ok(html.includes('/assets/theme.js'), page);
  assert.ok(/not affiliated with/i.test(html) && /David Senra/.test(html) && /Founders/.test(html), page);
  assert.ok(html.includes('data-set-theme="senra"') && html.includes('data-set-theme="founders"'), page);
}
const foundersPage = fs.readFileSync('founders.html', 'utf8');
assert.ok(foundersPage.includes('Episode page') || foundersPage.includes('Show page'));
assert.ok(foundersPage.includes('Ari Emanuel'));
assert.ok(foundersPage.includes('https://www.founderspodcast.com/episodes/'));
assert.ok(!foundersPage.includes('__COUNT__') && !foundersPage.includes('__LIST__'));
assert.equal((foundersPage.match(/class="episode"/g) || []).length, catalog.episodes.length);

const theme = fs.readFileSync('assets/theme.css', 'utf8');
assert.ok(theme.includes('html[data-theme="senra"]') && theme.includes('html[data-theme="founders"]'));
assert.ok(theme.includes('--accent: #006bff') && theme.includes('--foreground') === false);
assert.ok(theme.includes('#4cbb17') && theme.includes('Anton') && theme.includes('Libre Baskerville'));
assert.ok(!theme.includes('Schmalfette') && !theme.includes('typekit'));
const contrast = (hex, other = '#ffffff') => {
  const lin = channel => { const c = channel / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const lum = value => { const h = value.slice(1); const channels = [0, 2, 4].map(index => lin(parseInt(h.slice(index, index + 2), 16))); return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]; };
  const a = lum(hex), b = lum(other); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
};
assert.ok(contrast('#006bff') >= 4.5, 'Founders accent must be readable on white');
assert.ok(contrast('#595959') >= 4.5);
assert.ok(contrast('#171717') >= 7);
assert.ok(contrast('#000000') >= 7);
assert.ok(contrast('#4cbb17') < 3, 'Senra green is decorative and must not be treated as text');

const index = fs.readFileSync('index.html', 'utf8');
assert.ok(index.includes('id="list"') && index.includes('data-guest='));
assert.ok(normalize('Tobi Lütke') === 'tobi lutke');
console.log(`Founders checks passed: ${catalog.episodes.length} episodes, ${catalog.episodes.filter(episode => episode.url).length} sitemap links, ${live.filter(episode => episode.companies.length).length} tied to the board.`);
