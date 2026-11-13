// Fetch a small brand mark for each company that has none, from the company's own domain.
// Companies not in DOMAINS, or whose icon cannot be fetched, keep the initials tile.
// Run: node scripts/fetch-logos.mjs && node build.mjs
import fs from 'node:fs';

const DOMAINS = {
  'Robinhood': 'robinhood.com', 'Harmonic': 'harmonic.fun', 'Palo Alto Networks': 'paloaltonetworks.com',
  'U.S. Office of Personnel Management': 'opm.gov', 'Flexjet': 'flexjet.com', 'Sentient Jet': 'sentient.com',
  'Corporate Wings': 'corporatewings.com', 'Flexjet Technical Services': 'flexjet.com',
  'Directional Aviation': 'directionalaviation.com', 'Corient': 'corient.com', 'CI Financial': 'cifinancial.com',
  'Medici Brands': 'davidprotein.com', 'Epogee': 'epogee.com', 'Atoms': 'atoms.co', 'Pronto AI': 'pronto.ai',
  'Lab37': 'lab37.us', 'Otter': 'tryotter.com', 'Picnic': 'trypicnic.com', 'TrailRunner International': 'trailrunnerint.com',
  'OnePay': 'onepay.com', 'NODE Foundation': 'nodefoundation.com', 'UnitedMasters / Translation': 'unitedmasters.com',
  'Crystal Dynamics': 'crystaldynamics.com', '20th Century Studios': '20thcenturystudios.com',
  'Scribe Media': 'scribemedia.com', 'Tesla': 'tesla.com', 'SpaceX / Starlink': 'spacex.com', 'Neuralink': 'neuralink.com',
  'xAI / X': 'x.ai', 'The Boring Company': 'boringcompany.com', 'PayPal': 'paypal.com', 'ResearchHub': 'researchhub.com',
  'USC Iovine and Young Academy': 'iovine-young.usc.edu', "O'Shaughnessy Asset Management": 'osam.com',
  'DFO Management': 'dellfamilyoffice.com', 'Michael & Susan Dell Foundation': 'dell.org', 'ZMC': 'zmclp.com',
};
const logos = JSON.parse(fs.readFileSync('company-logos.json', 'utf8'));
const isPng = (b) => b.length > 300 && b[0] === 0x89 && b[1] === 0x50;
let added = 0;
for (const [name, domain] of Object.entries(DOMAINS)) {
  if (logos[name]?.src) continue;
  const file = `logos/${domain}.png`;
  if (!fs.existsSync(file)) {
    try {
      const res = await fetch(`https://www.google.com/s2/favicons?domain=${domain}&sz=128`, { signal: AbortSignal.timeout(15000) });
      const buf = Buffer.from(await res.arrayBuffer());
      // A 404 from this service still returns a tiny default globe; skip those and non-PNG replies.
      if (!res.ok || !isPng(buf) || buf.readUInt32BE(16) < 32) { console.log(`skip  ${name} (${domain}): no usable icon`); continue; }
      fs.writeFileSync(file, buf);
    } catch (err) { console.log(`skip  ${name} (${domain}): ${err.message}`); continue; }
  }
  logos[name] = { src: `/${file}`, domain };
  added++;
  console.log(`added ${name} -> ${file}`);
}
fs.writeFileSync('company-logos.json', JSON.stringify(logos, null, 1) + '\n');
console.log(`${added} logos added`);
