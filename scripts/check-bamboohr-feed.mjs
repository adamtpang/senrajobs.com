import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseBambooHr,fetchBambooHr,bambooIdentity} from '../bamboohr-feed.mjs';
const at='2026-11-13T00:00:00Z',slug='trailrunner',endpoint='https://trailrunner.bamboohr.com/careers/list';
const job=(id,name,extra={})=>({id,jobOpeningName:name,departmentId:null,departmentLabel:null,employmentStatusLabel:'Intern',employmentType:null,location:{city:'New York',state:'New York'},atsLocation:{country:null,state:null,province:null,city:null},isRemote:null,locationType:'0',internalNote:'must not project',...extra});
const payload=(list,total=list.length)=>({meta:{totalCount:total},result:list});
// Normal parse: url format, published location, entity decoding and workplace codes.
const parsed=parseBambooHr(payload([job('147','New York City 2027 Internship'),job('148','Research &amp; Strategy Associate',{departmentLabel:'Advisory',location:{city:null,state:null},atsLocation:{city:'Dallas',state:'Texas',country:'United States'},locationType:'2'}),job(149,'Remote Analyst',{location:null,atsLocation:null,isRemote:true,locationType:null})]),slug,at);
assert.equal(parsed.rows.length,3);assert.equal(parsed.total,3);assert.equal(parsed.invalid,0);assert.equal(parsed.endpoint,endpoint);
const [a,b,c]=parsed.rows;
assert.equal(a.url,'https://trailrunner.bamboohr.com/careers/147');assert.equal(a.id,'147');assert.equal(a.location,'New York, New York');
assert.deepEqual(a.locations,[{raw:'New York, New York',sourceUrl:endpoint,observedAt:at,source:'employer-public-feed',confidence:'published'}]);
assert.equal(a.locationStatus,'published');assert.equal(a.employmentType,'Intern');assert.equal(a.workplace,'On-site');assert.equal(a.publishedAt,'');assert.ok(!('pay' in a));
assert.equal(b.title,'Research & Strategy Associate');assert.equal(b.location,'Dallas, Texas, United States');assert.equal(b.department,'Advisory');assert.equal(b.workplace,'Hybrid');
assert.equal(c.id,'149');assert.equal(c.location,'');assert.equal(c.locationStatus,'unknown');assert.deepEqual(c.locations,[]);assert.equal(c.workplace,'Remote');
assert.equal(parseBambooHr(payload([job('150','A',{location:{city:'Dallas',state:'Texas'}})]),slug,at).rows[0].location,'Dallas, Texas');
assert.equal(parseBambooHr(payload([job('151','A',{locationType:'9'})]),slug,at).rows[0].workplace,'');
assert.ok(!JSON.stringify(parsed).includes('must not project'));
// Duplicates and invalid records are skipped and counted.
const messy=parseBambooHr(payload([job('147','A'),job('147','A'),job('../admin','B'),job('152',''),null]),slug,at);
assert.equal(messy.rows.length,1);assert.equal(messy.duplicates,1);assert.equal(messy.invalid,3);
// Missing payload and malformed subdomain throw.
assert.throws(()=>parseBambooHr({},slug,at));assert.throws(()=>parseBambooHr(undefined,slug,at));
assert.throws(()=>bambooIdentity('evil.example.com/x'));assert.throws(()=>bambooIdentity(''));
// Fetch sends the JSON accept header and is complete when the single payload is clean.
let seen;const ok=(data,url=endpoint)=>({ok:true,status:200,url,data});
const complete=await fetchBambooHr({slug},{observedAt:at,request:async(url,options)=>{seen={url,options};return ok(payload([job('147','A'),job('148','B')]));}});
assert.equal(seen.url,endpoint);assert.equal(seen.options.headers.accept,'application/json');
assert.equal(complete.status,'complete');assert.equal(complete.total,2);assert.equal(complete.rows.length,2);assert.equal(complete.pages,1);assert.equal(complete.pageReceipts[0].rows,2);assert.equal(complete.observedAt,at);
// No advertised total is still complete when every record is valid; the reason says what was exhausted.
const untotalled=await fetchBambooHr({slug},{observedAt:at,request:async()=>ok({result:[job('147','A')]})});
assert.equal(untotalled.status,'complete');assert.equal(untotalled.total,null);assert.match(untotalled.reason,/exhausted/);
// Invalid record or a total mismatch: partial with a reason.
const partial=await fetchBambooHr({slug},{observedAt:at,request:async()=>ok(payload([job('147','A'),job('x','B')]))});
assert.equal(partial.status,'partial');assert.equal(partial.rows.length,1);assert.match(partial.reason,/1 invalid/);
assert.equal((await fetchBambooHr({slug},{observedAt:at,request:async()=>ok(payload([job('147','A')],4))})).status,'partial');
// Failed request, HTML instead of JSON, redirect to another host, nothing usable and bad slug: failed with no rows.
for(const request of [async()=>({ok:false,status:500,error:'HTTP 500'}),async()=>({ok:true,status:200,url:endpoint,text:'<html>'}),async()=>ok(payload([job('147','A')]),'https://www.bamboohr.com/'),async()=>ok(payload([job('x','A')]))]){
 const failed=await fetchBambooHr({slug},{observedAt:at,request});assert.equal(failed.status,'failed');assert.deepEqual(failed.rows,[]);assert.ok(failed.reason);
}
assert.equal((await fetchBambooHr({slug:'a/b'},{observedAt:at,request:async()=>{throw Error('must not request');}})).status,'failed');
// A verifiably empty board (advertised total 0) is complete, not failed.
assert.equal((await fetchBambooHr({slug},{observedAt:at,request:async()=>ok(payload([]))})).status,'complete');
if(process.argv.includes('--live')){
 const {requestPublic}=await import('../ats.mjs');
 const live=await fetchBambooHr({slug},{request:requestPublic,observedAt:new Date().toISOString()});
 let known=[];try{const jobs=JSON.parse(readFileSync(new URL('../jobs.json',import.meta.url),'utf8'));known=Object.entries(jobs).filter(([k])=>k.startsWith('TrailRunner')).flatMap(([,b])=>b.roles.map(r=>r.url));}catch{}
 for(const r of live.rows)console.log(`${r.id} | ${r.title} | ${r.location||'(location unknown)'} | ${r.employmentType} | ${r.workplace} | ${r.url}`);
 console.log(`LIVE TrailRunner BambooHR: rows ${live.rows.length}, advertised total ${live.total}, status ${live.status}`);
 console.log(`reason: ${live.reason}`);
 console.log(`existing jobs.json urls reproduced: ${known.filter(u=>live.rows.some(r=>r.url===u)).length} of ${known.length}`);
 assert.notEqual(live.status,'failed');
}
console.log('PASS: BambooHR public list parse, url identity, published-only location, duplicate and invalid handling, host pinning, completeness and failure paths.');
