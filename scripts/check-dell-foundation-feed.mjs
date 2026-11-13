import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseDellFoundation,fetchDellFoundation,DELL_FOUNDATION_CAREERS} from '../dell-foundation-feed.mjs';
const at='2026-11-13T00:00:00Z',base='https://www.dell.org/careers/job-description/?gnk=job&#038;gni=';
const A='8a7885a89f8b940c019fcaa4e6ce2603',B='8a78859fa0f425c801a0f7dabfbf5193',C='8a78879e9de07184019df46825dd584a';
const row=(location,href,title)=>`<tr>\n<td class="body--l">${location}</td>\n<td class="body--l"><a href="${href}" target="_blank" rel="noopener noreferrer">${title}</a></td>\n</tr>`;
const page=(rows,head='<thead><tr><th class="caps--m">Location</th><th class="caps--m">Position</th></tr></thead>')=>`<html><head><title>Careers | Michael &amp; Susan Dell Foundation</title></head><body><a href="${base}${C}">nav link outside the listing</a><section class="careers-list relative"><div class="container relative"><table>${head}${rows.join('')}</table></div></section></body></html>`;
// Normal parse: canonical url, header-mapped location, entity decoding.
const parsed=parseDellFoundation(page([row('Austin, TX',base+A,'Head of Insights &amp; Impact'),row('Tel Aviv, Israel',base+B,'Manager, Program Financial Operations, Israel')]),at);
assert.equal(parsed.rows.length,2);assert.equal(parsed.total,null);assert.equal(parsed.invalid,0);assert.equal(parsed.raw,2);
const [a,b]=parsed.rows;
assert.equal(a.url,'https://www.dell.org/careers/job-description/?gnk=job&gni='+A);assert.equal(a.id,A);assert.equal(a.title,'Head of Insights & Impact');
assert.equal(a.location,'Austin, TX');assert.equal(a.locationStatus,'published');
assert.deepEqual(a.locations,[{raw:'Austin, TX',sourceUrl:DELL_FOUNDATION_CAREERS,observedAt:at,source:'employer-public-feed',confidence:'published'}]);
assert.equal(a.sourceUrl,DELL_FOUNDATION_CAREERS);assert.equal(a.employerBrand,'Michael & Susan Dell Foundation');assert.ok(!('pay' in a));assert.equal(a.publishedAt,'');
assert.equal(b.location,'Tel Aviv, Israel');
// Links outside the listing table are ignored.
assert.ok(!parsed.rows.some(r=>r.id===C));
// A team column is read only when the header names it; column order follows the header.
const teamed=parseDellFoundation(page([`<tr><td><a href="${base+A}">Senior Engineer</a></td><td>Technology</td><td>Austin, TX</td></tr>`],'<tr><th>Position</th><th>Team</th><th>Location</th></tr>'),at).rows[0];
assert.equal(teamed.department,'Technology');assert.equal(teamed.location,'Austin, TX');
// Without a Location header the adjacent text is not assumed to be a location.
const unlabelled=parseDellFoundation(page([row('Austin, TX',base+A,'Senior Engineer')],''),at).rows[0];
assert.equal(unlabelled.location,'');assert.equal(unlabelled.locationStatus,'unknown');assert.deepEqual(unlabelled.locations,[]);
// Duplicates and invalid records (wrong host, http, bad id, empty title) are skipped and counted.
const messy=parseDellFoundation(page([row('Austin, TX',base+A,'A'),row('Austin, TX',base+A,'A'),row('X','https://evil.example/careers/job-description/?gnk=job&gni='+B,'B'),row('X','http://www.dell.org/careers/job-description/?gnk=job&gni='+B,'B'),row('X',base+'123','B'),row('X',base+B,' ')]),at);
assert.equal(messy.rows.length,1);assert.equal(messy.duplicates,1);assert.equal(messy.invalid,4);assert.equal(messy.raw,6);
// Missing payload throws.
assert.throws(()=>parseDellFoundation('<html><body>No listing here</body></html>',at));assert.throws(()=>parseDellFoundation(undefined,at));
// Fetch: complete when the single table parses with no invalid rows; total stays null.
const ok=text=>({ok:true,status:200,url:DELL_FOUNDATION_CAREERS,text});
const complete=await fetchDellFoundation({observedAt:at,request:async url=>{assert.equal(url,DELL_FOUNDATION_CAREERS);return ok(page([row('Austin, TX',base+A,'A'),row('Delhi, India',base+B,'B')]));}});
assert.equal(complete.status,'complete');assert.equal(complete.total,null);assert.equal(complete.rows.length,2);assert.equal(complete.pages,1);assert.equal(complete.pageReceipts[0].rows,2);assert.match(complete.reason,/exhausted/);assert.equal(complete.observedAt,at);
const partial=await fetchDellFoundation({observedAt:at,request:async()=>ok(page([row('Austin, TX',base+A,'A'),row('X',base+'zz','B')]))});
assert.equal(partial.status,'partial');assert.equal(partial.rows.length,1);assert.match(partial.reason,/1 invalid/);
// Failed request, changed identity, missing table, empty table and off-site redirect: failed with no rows.
for(const request of [async()=>({ok:false,status:403,error:'HTTP 403'}),async()=>ok('<html><section class="careers-list"><table></table></section></html>'),async()=>ok('<html>Michael &amp; Susan Dell Foundation</html>'),async()=>ok(page([])),async()=>({...ok(page([row('Austin, TX',base+A,'A')])),url:'https://example.com/careers/'})]){
 const failed=await fetchDellFoundation({observedAt:at,request});assert.equal(failed.status,'failed');assert.deepEqual(failed.rows,[]);assert.ok(failed.reason);
}
if(process.argv.includes('--live')){
 const {requestPublic}=await import('../ats.mjs');
 const live=await fetchDellFoundation({request:requestPublic,observedAt:new Date().toISOString()});
 let known=[];try{const jobs=JSON.parse(readFileSync(new URL('../jobs.json',import.meta.url),'utf8'));known=Object.entries(jobs).filter(([k])=>k.startsWith('Michael & Susan Dell Foundation')).flatMap(([,b])=>b.roles.map(r=>r.url));}catch{}
 for(const r of live.rows)console.log(`${r.id} | ${r.title} | ${r.location||'(location unknown)'} | ${r.url}`);
 console.log(`LIVE Michael & Susan Dell Foundation: rows ${live.rows.length}, advertised total ${live.total}, status ${live.status}`);
 console.log(`reason: ${live.reason}`);
 console.log(`existing jobs.json urls reproduced: ${known.filter(u=>live.rows.some(r=>r.url===u)).length} of ${known.length}`);
 assert.notEqual(live.status,'failed');
}
console.log('PASS: Dell Foundation listing parse, canonical url identity, header-mapped location, duplicate and invalid handling, scope pinning, completeness and failure paths.');
