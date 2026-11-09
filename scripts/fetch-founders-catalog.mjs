// Refresh data/founders-episodes.json from the public Founders RSS feed and sitemap.
// The feed is the show's own syndication file. The sitemap lists episode pages.
import fs from 'node:fs';
import { parseFeed, sitemapEpisodeUrls, attachOfficialUrls } from '../founders-catalog.mjs';

const FEED = 'https://feeds.megaphone.fm/DSLLC6297708582';
const SITEMAP = 'https://www.founderspodcast.com/sitemap.xml';

const fetchText = async url => {
  const response = await fetch(url, { headers: { 'user-agent': 'senrajobs-catalog/1.0 (+https://senrajobs.com)', accept: 'application/rss+xml, application/xml, text/xml, */*' } });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.text();
};

const [feed, sitemap] = await Promise.all([fetchText(FEED), fetchText(SITEMAP)]);
const parsed = parseFeed(feed);
const { episodes, warnings } = attachOfficialUrls(parsed, sitemapEpisodeUrls(sitemap));
const catalog = {
  fetchedOn: new Date().toISOString(),
  feed: FEED,
  sitemap: SITEMAP,
  show: 'https://www.founderspodcast.com/',
  warnings,
  episodes
};
fs.mkdirSync('data', { recursive: true });
fs.writeFileSync('data/founders-episodes.json', JSON.stringify(catalog, null, 2) + '\n');
const linked = episodes.filter(episode => episode.url).length;
console.log(`Wrote ${episodes.length} episodes, ${linked} with a sitemap episode page, ${warnings.length} ambiguous.`);
