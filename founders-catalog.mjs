// Public Founders podcast catalog. Titles, dates and official page URLs come from
// the show's RSS feed and sitemap. Nothing here is invented.

const STOP = new Set(['translation','group','studios','studio','market','records','academy','foundation','company','brands','protein','financial','logistics','interactive','rentals','management','services','media','foods','food','health','power','holdings','technologies','technology','international','life','love','the','and','for','inc','young','boring','capital','partners','of']);

export function decodeXml(value) {
  return String(value || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, num) => String.fromCodePoint(Number(num)))
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}

export function tagText(block, tag) {
  const match = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'i'));
  return match ? decodeXml(match[1]).trim() : '';
}

export function normalize(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/['’]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function slugify(value) {
  return normalize(value).replace(/ /g, '-');
}

export function subjectOf(title) {
  return String(title || '').replace(/^\s*#\s*\d+\s*/, '').replace(/^\s*episode\s+\d+\s*[:.\-–—]?\s*/i, '').trim();
}

export function numberOf(title, itunesEpisode) {
  const fromTag = Number(itunesEpisode);
  if (Number.isInteger(fromTag) && fromTag > 0) return fromTag;
  const fromTitle = String(title || '').match(/^\s*#\s*(\d+)\b/) || String(title || '').match(/^\s*episode\s+(\d+)\b/i);
  return fromTitle ? Number(fromTitle[1]) : null;
}

export function summaryOf(description) {
  const text = decodeXml(description).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const cut = text.split(/made possible by/i)[0].trim();
  return cut.slice(0, 360);
}

export function parseFeed(xml) {
  const episodes = [];
  for (const block of String(xml || '').split(/<item\b/i).slice(1)) {
    const title = tagText(block, 'title').replace(/\s+/g, ' ').trim();
    if (!title) continue;
    const publishedRaw = tagText(block, 'pubDate');
    const publishedMs = Date.parse(publishedRaw);
    const duration = Number(tagText(block, 'itunes:duration'));
    episodes.push({
      number: numberOf(title, tagText(block, 'itunes:episode')),
      title,
      subject: subjectOf(title) || title,
      published: Number.isFinite(publishedMs) ? new Date(publishedMs).toISOString() : null,
      durationSeconds: Number.isFinite(duration) && duration > 0 ? Math.round(duration) : null,
      summary: summaryOf(tagText(block, 'description') || tagText(block, 'itunes:summary')),
      guid: tagText(block, 'guid'),
      url: null
    });
  }
  episodes.sort((a, b) => (b.number || 0) - (a.number || 0) || (Date.parse(b.published || '') || 0) - (Date.parse(a.published || '') || 0) || a.title.localeCompare(b.title));
  return episodes;
}

export function sitemapEpisodeUrls(xml) {
  return [...String(xml || '').matchAll(/<loc>\s*(https:\/\/www\.founderspodcast\.com\/episodes\/[^<\s]+)\s*<\/loc>/gi)].map(match => decodeXml(match[1]));
}

export function attachOfficialUrls(episodes, urls) {
  const byPath = new Map();
  for (const url of urls) {
    let path = '';
    try { path = decodeURIComponent(new URL(url).pathname.replace(/\/$/, '')); } catch { continue; }
    const base = path.split('/').pop();
    if (base) byPath.set(base, url);
  }
  const warnings = [];
  const linked = episodes.map(episode => {
    const subjectSlug = slugify(episode.subject);
    const numbered = episode.number ? `${episode.number}-${subjectSlug}` : '';
    const candidates = [numbered, subjectSlug, slugify(episode.title)].filter(Boolean);
    const hits = [...new Set(candidates.map(candidate => byPath.get(candidate)).filter(Boolean))];
    if (hits.length === 1) return { ...episode, url: hits[0] };
    const numberedHit = numbered && byPath.get(numbered);
    if (numberedHit) return { ...episode, url: numberedHit };
    if (hits.length > 1) warnings.push({ number: episode.number, title: episode.title, urls: hits });
    return { ...episode, url: null };
  });
  return { episodes: linked, warnings };
}

function hasPhrase(hay, phrase) {
  if (!phrase || phrase.length < 3) return false;
  // A trailing s covers possessives after apostrophes are removed: "Emanuel's" -> "emanuels".
  const pattern = phrase.split(' ').map(word => `${word}s?`).join(' ');
  return new RegExp(`(?:^| )${pattern}(?: |$)`).test(` ${hay} `);
}

function companyPhrases(name) {
  const phrases = [normalize(name)];
  for (const segment of String(name).split(/\s*\/\s*/)) {
    const phrase = normalize(segment);
    if (phrase.length >= 3 && !STOP.has(phrase)) phrases.push(phrase);
  }
  return [...new Set(phrases.filter(phrase => phrase.length >= 3 && !STOP.has(phrase)))];
}

function guestPhrases(name) {
  // Full names only. A shared surname such as Ferrari would otherwise attach
  // Enzo Ferrari's episode to a different person on the board.
  return [normalize(name)];
}

export function boardIndex(guests) {
  const people = (guests || []).map(guest => ({
    name: guest.name,
    phrases: guestPhrases(guest.name),
    companies: (guest.companies || []).filter(company => company.careers).map(company => company.name.split(' (')[0])
  }));
  const companies = [];
  const seen = new Set();
  for (const guest of guests || []) {
    for (const company of guest.companies || []) {
      if (!company.careers) continue;
      const name = company.name.split(' (')[0];
      if (seen.has(name)) continue;
      seen.add(name);
      companies.push({ name, phrases: companyPhrases(name) });
    }
  }
  return { people, companies };
}

// A guest match links the companies already on the board for that person.
// A company match requires the episode title to name that company. Show notes
// are ignored so sponsor mentions are not treated as the episode subject.
export function matchEpisode(episode, index) {
  const hay = normalize(episode.subject || episode.title);
  // "Nikola Tesla" is the inventor, not the car company listed on the board.
  const companyHay = hay.replace(/\bnikola teslas?\b/g, ' ');
  const guests = index.people.filter(person => person.phrases.some(phrase => hasPhrase(hay, phrase)));
  const named = index.companies.filter(company => company.phrases.some(phrase => hasPhrase(companyHay, phrase)));
  const companies = [];
  const seen = new Set();
  for (const guest of guests) {
    for (const name of guest.companies) {
      if (seen.has(name)) continue;
      seen.add(name);
      companies.push({ name, via: 'guest', guest: guest.name });
    }
  }
  for (const company of named) {
    if (seen.has(company.name)) continue;
    seen.add(company.name);
    companies.push({ name: company.name, via: 'title', guest: null });
  }
  return { guests: guests.map(guest => guest.name), companies };
}

export function matchCatalog(episodes, guests) {
  const index = boardIndex(guests);
  return episodes.map(episode => ({ ...episode, ...matchEpisode(episode, index) }));
}
