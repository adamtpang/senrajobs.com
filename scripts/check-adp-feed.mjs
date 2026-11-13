import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseAdp,fetchAdp,adpIdentity} from '../adp-feed.mjs';
const at='2026-11-13T00:00:00Z',slug='17763c3e-6689-4e44-8e0b-eac90764d9d5|9200392115678_2';
const careers='https://workforcenow.adp.com/mascsr/default/mdf/recruitment/recruitment.html?cid=17763c3e-6689-4e44-8e0b-eac90764d9d5&ccId=9200392115678_2&lang=en_US';
const req=(id,title,extra={})=>({itemID:'x_'+id,clientRequisitionID:'11'+id.slice(-2),requisitionTitle:title,postDate:'2026-11-12T02:59:00',workLevelCode:{shortName:'Part Time'},requisitionLocations:[{nameCode:{shortName:' El Segundo, CA, US'}}],customFieldGroup:{codeFields:[{codeValue:'HR',nameCode:{codeValue:'SalaryType'},shortName:'Hourly'}],stringFields:[{nameCode:{codeValue:'ExternalJobID'},stringValue:id},{nameCode:{codeValue:'SalaryRange'},stringValue:' 30 to 40 (USD) Hourly'}]},payGradeRange:{minimumRate:{amountValue:30,currencyCode:'USD'},maximumRate:{amountValue:40,currencyCode:'USD'}},applicantSecret:'must not project',...extra});
const payload=(list,total=list.length)=>({meta:{startSequence:1,totalNumber:total},jobRequisitions:list});
// Normal parse: url format, published location, pay and entity decoding.
const upTo=req('470002','Cafe &amp; Bar Team Member',{payGradeRange:{minimumRate:{amountValue:0,currencyCode:'USD'},maximumRate:{amountValue:22,currencyCode:'USD'}}});
const noPay=req('470003','Physician',{payGradeRange:undefined,requisitionLocations:[],customFieldGroup:{stringFields:[{nameCode:{codeValue:'ExternalJobID'},stringValue:'470003'}]}});
const parsed=parseAdp(payload([req('470001','DEXA Technician'),upTo,noPay]),slug,at);
assert.equal(parsed.rows.length,3);assert.equal(parsed.total,3);assert.equal(parsed.invalid,0);
const [a,b,c]=parsed.rows;
assert.equal(a.url,careers+'&jobId=470001');assert.equal(a.id,'470001');assert.equal(a.requisitionId,'1101');
assert.equal(a.location,'El Segundo, CA, US');assert.equal(a.locationStatus,'published');
assert.deepEqual(a.locations,[{raw:'El Segundo, CA, US',sourceUrl:parsed.endpoint,observedAt:at,source:'employer-public-feed',confidence:'published'}]);
assert.deepEqual(a.pay,{min:30,max:40,currency:'USD',period:'hour'});assert.equal(a.compensationText,'30 to 40 (USD) Hourly');
assert.equal(a.employmentType,'Part Time');assert.equal(a.publishedAt,'2026-11-12T02:59:00');assert.equal(a.sourceStatus,'current');
assert.equal(b.title,'Cafe & Bar Team Member');assert.deepEqual(b.pay,{min:null,max:22,currency:'USD',period:'hour'});
assert.ok(!('pay' in c));assert.equal(c.location,'');assert.equal(c.locationStatus,'unknown');assert.deepEqual(c.locations,[]);
assert.ok(!JSON.stringify(parsed).includes('must not project'));
// Unknown pay period or mixed currencies never produce a figure.
assert.ok(!('pay' in parseAdp(payload([req('470004','A',{customFieldGroup:{stringFields:[{nameCode:{codeValue:'ExternalJobID'},stringValue:'470004'}]}})]),slug,at).rows[0]));
assert.ok(!('pay' in parseAdp(payload([req('470005','A',{payGradeRange:{minimumRate:{amountValue:1,currencyCode:'CAD'},maximumRate:{amountValue:2,currencyCode:'USD'}}})]),slug,at).rows[0]));
// Duplicates and invalid records are skipped and counted.
const messy=parseAdp(payload([req('470001','A'),req('470001','A'),req('../evil','B'),req('470006','  '),null]),slug,at);
assert.equal(messy.rows.length,1);assert.equal(messy.duplicates,1);assert.equal(messy.invalid,3);
// Missing payload and malformed identity throw.
assert.throws(()=>parseAdp({},slug,at));assert.throws(()=>parseAdp(null,slug,at));
assert.throws(()=>adpIdentity('not-a-cid|1_2'));assert.throws(()=>adpIdentity(slug+'|extra'));assert.throws(()=>adpIdentity(slug.replace('_2','&x=1')));
// Fetch: complete only when unique rows equal the advertised total.
const ok=data=>({ok:true,status:200,data});
const complete=await fetchAdp({slug},{observedAt:at,request:async()=>ok(payload([req('470001','A'),req('470002','B')]))});
assert.equal(complete.status,'complete');assert.equal(complete.total,2);assert.equal(complete.rows.length,2);assert.equal(complete.pages,1);assert.equal(complete.pageReceipts[0].rows,2);assert.equal(complete.observedAt,at);
// Pagination follows the 1-based $skip sequence and deduplicates overlap.
const calls=[];
const paged=await fetchAdp({slug},{observedAt:at,request:async url=>{calls.push(url);return ok(url.includes('$skip=3')?payload([req('470002','B'),req('470003','C')],3):payload([req('470001','A'),req('470002','B')],3));}});
assert.equal(calls.length,2);assert.ok(calls[0].endsWith('&$top=50'));assert.ok(calls[1].endsWith('&$top=50&$skip=3'));
assert.equal(paged.rows.length,3);assert.equal(paged.status,'complete');assert.equal(paged.pages,2);
// Advertised total not reached, an invalid record, or a later page failing: partial with a reason.
const short=await fetchAdp({slug},{observedAt:at,request:async()=>ok(payload([req('470001','A'),req('bad','B')],2))});
assert.equal(short.status,'partial');assert.equal(short.rows.length,1);assert.match(short.reason,/1 invalid/);
let n=0;const broken=await fetchAdp({slug},{observedAt:at,request:async()=>n++?{ok:false,error:'HTTP 500'}:ok(payload([req('470001','A')],5))});
assert.equal(broken.status,'partial');assert.match(broken.reason,/HTTP 500/);
// Failed request, missing payload and bad slug: failed with no rows.
for(const request of [async()=>({ok:false,status:404,error:'HTTP 404'}),async()=>ok({unexpected:true}),async()=>ok(payload([req('bad','A')],1))]){
 const failed=await fetchAdp({slug},{observedAt:at,request});assert.equal(failed.status,'failed');assert.deepEqual(failed.rows,[]);assert.ok(failed.reason);
}
assert.equal((await fetchAdp({slug:'nope'},{observedAt:at,request:async()=>{throw Error('must not request');}})).status,'failed');
// A verifiably empty board (advertised total 0) is complete, not failed.
assert.equal((await fetchAdp({slug},{observedAt:at,request:async()=>ok(payload([]))})).status,'complete');
if(process.argv.includes('--live')){
 const {requestPublic}=await import('../ats.mjs');
 const live=await fetchAdp({slug},{request:requestPublic,observedAt:new Date().toISOString()});
 let known=[];try{const jobs=JSON.parse(readFileSync(new URL('../jobs.json',import.meta.url),'utf8'));known=Object.entries(jobs).filter(([k])=>k.startsWith('Love.Life')).flatMap(([,b])=>b.roles.map(r=>r.url));}catch{}
 for(const r of live.rows)console.log(`${r.id} | ${r.title} | ${r.location||'(location unknown)'} | ${r.employmentType} | ${r.pay?JSON.stringify(r.pay):'no pay'} | ${r.url}`);
 console.log(`LIVE Love.Life ADP: rows ${live.rows.length}, advertised total ${live.total}, status ${live.status}, pages ${live.pages}`);
 console.log(`reason: ${live.reason}`);
 console.log(`existing jobs.json urls reproduced: ${known.filter(u=>live.rows.some(r=>r.url===u)).length} of ${known.length}`);
 assert.notEqual(live.status,'failed');
}
console.log('PASS: ADP public feed parse, url identity, published-only pay and location, duplicate and invalid handling, pagination, advertised-total completeness and failure paths.');
