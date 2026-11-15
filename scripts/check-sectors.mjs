// Every current company has one reviewed sector, and the generated browse pages agree with it.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {SECTORS} from '../sector-pages.mjs';
const guests=JSON.parse(fs.readFileSync('guests.json','utf8'));
const labels=JSON.parse(fs.readFileSync('company-sectors.json','utf8'));
const slugs=new Set(SECTORS.map(([slug])=>slug));
const companies=[...new Set(guests.flatMap(g=>g.companies.filter(c=>c.note!=='acquired or closed').map(c=>c.name.split(' (')[0])))];
for(const name of companies){
 const label=labels[name];assert(label,`No sector for ${name}`);
 assert(slugs.has(label.sector)||label.sector==='unknown',`Unknown sector slug for ${name}: ${label.sector}`);
 assert(typeof label.basis==='string'&&label.basis.length>10&&label.basis.length<=160&&!label.basis.includes('—'),`Basis missing or malformed for ${name}`);
 assert(['GUESTS.md','employer-associations.json'].includes(label.source)||/^https:\/\//.test(label.source),`Source missing for ${name}`);
}
const pages=fs.readdirSync('sectors').filter(f=>f.endsWith('.html'));
assert(pages.length>=5,'Sector pages missing');
const seen=new Map();
for(const file of pages){
 const slug=file.replace('.html','');assert(slugs.has(slug),`Unexpected sector page ${file}`);
 const html=fs.readFileSync(`sectors/${file}`,'utf8');
 assert(html.includes(`<link rel="canonical" href="https://senrajobs.com/sectors/${slug}">`),`Canonical missing on ${file}`);
 assert(!html.includes('—'),`Em dash on ${file}`);
 for(const name of companies){
  const escaped=name.replace(/&/g,'&amp;');
  if(html.includes(`<span class="name">${escaped}<`)||html.includes(`<span class="name">${escaped}</span>`)){assert(!seen.has(name),`${name} appears on two sector pages`);seen.set(name,slug);}
 }
}
for(const name of companies){
 const expected=slugs.has(labels[name].sector)?labels[name].sector:'other';
 assert.equal(seen.get(name),expected,`${name} should be on the ${expected} page`);
}
const top=fs.readFileSync('companies/most-roles.html','utf8');
assert((top.match(/class="rank"/g)||[]).length<=25&&top.includes('class="rank">1<'),'Ranking page malformed');
const sitemap=fs.readFileSync('sitemap.xml','utf8');
for(const file of pages)assert(sitemap.includes(`https://senrajobs.com/sectors/${file.replace('.html','')}`),`Sitemap missing ${file}`);
assert(sitemap.includes('https://senrajobs.com/companies/most-roles'));
console.log(`PASS: ${companies.length} companies each on one of ${pages.length} sector pages; ranking page and sitemap agree.`);
