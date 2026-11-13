import assert from 'node:assert/strict';
import {parsePayPal,fetchPayPal,paypalPageUrl,PAYPAL_SEARCH} from '../paypal-feed.mjs';
const at='2026-11-13T00:00:00Z';
const job=(n,extra={})=>({id:274900000000+n,displayJobId:'R'+String(n).padStart(7,'0'),name:'Engineer '+n,locations:['Austin, Texas, United States of America','Chicago, Illinois, United States of America'],standardizedLocations:['Austin, TX, US'],postedTs:1794528000,department:'Software Engineering',workLocationOption:'hybrid',atsJobId:'R'+String(n).padStart(7,'0'),positionUrl:'/careers/job/'+(274900000000+n),secretHR:'must not project',...extra});
const body=(positions,count)=>({status:200,data:{positions,count,filterDef:{private:'must not project'}}});

// Normal parse: url format, field names and public-only projection.
const one=parsePayPal(body([job(1)],1),at);
assert.equal(one.rows.length,1);assert.equal(one.total,1);assert.equal(one.invalid,0);assert.equal(one.endpoint,PAYPAL_SEARCH);
const r=one.rows[0];
assert.equal(r.id,'R0000001');assert.equal(r.url,'https://paypal.eightfold.ai/careers/job/274900000001');assert.equal(r.title,'Engineer 1');
assert.equal(r.location,'Austin, Texas, United States of America');assert.deepEqual(r.secondaryLocations,['Chicago, Illinois, United States of America']);
assert.deepEqual(r.locations[0],{raw:'Austin, Texas, United States of America',sourceUrl:paypalPageUrl(0),observedAt:at,source:'employer-public-feed',confidence:'published'});
assert.equal(r.locations.length,2);assert.equal(r.locationStatus,'published');assert.equal(r.locationSource,'employer-public-feed');
assert.equal(r.department,'Software Engineering');assert.equal(r.workplace,'Hybrid');assert.equal(r.publishedAt,'2026-11-13T00:00:00.000Z');
assert.equal(r.sourceStatus,'current');assert.equal(r.observedAt,at);assert.equal(r.employerBrand,'PayPal');assert.equal(r.sourceUrl,paypalPageUrl(0));
assert.ok(!('pay' in r));assert.ok(!JSON.stringify(one).includes('must not project'));

// Never invent location, dates or pay; project pay only when the feed publishes a figure.
const bare=parsePayPal(body([job(2,{locations:[],postedTs:null,workLocationOption:'onsite',department:null})],1),at).rows[0];
assert.equal(bare.location,'');assert.deepEqual(bare.locations,[]);assert.equal(bare.locationStatus,'unknown');assert.equal(bare.publishedAt,'');assert.equal(bare.workplace,'');assert.equal(bare.department,'');
assert.equal(parsePayPal(body([job(3,{workLocationOption:'remote_local'})],1),at).rows[0].workplace,'Remote');
assert.deepEqual(parsePayPal(body([job(4,{salaryRange:{min:100000,max:150000,currency:'USD',period:'year'}})],1),at).rows[0].pay,{min:100000,max:150000,currency:'USD',period:'year'});
assert.ok(!('pay' in parsePayPal(body([job(5,{salaryRange:{min:100000,max:150000}})],1),at).rows[0]));

// Duplicates and invalid records are skipped and counted.
const mixed=parsePayPal(body([job(1),job(1),job(2,{id:'not-a-number'}),job(3,{name:'  '}),job(4,{positionUrl:'https://example.com/careers/job/274900000004'}),job(5,{positionUrl:'/careers/job/999'}),job(6,{displayJobId:'bad id!',atsJobId:null}),null,job(7,{positionUrl:undefined})],9),at);
assert.deepEqual(mixed.rows.map(x=>x.id),['R0000001','R0000007']);assert.equal(mixed.duplicates,1);assert.equal(mixed.invalid,6);assert.equal(mixed.raw,9);
assert.ok(mixed.rows.every(x=>new URL(x.url).protocol==='https:'&&new URL(x.url).hostname==='paypal.eightfold.ai'));

// Missing array throws.
assert.throws(()=>parsePayPal({},at));assert.throws(()=>parsePayPal({data:{count:3}},at));assert.throws(()=>parsePayPal(null,at));

// Pagination to completion with a stub request.
const all=Array.from({length:25},(_,i)=>job(i+1));
const stub=(positions,{count=positions.length,fail=[]}={})=>{const calls=[];const request=async url=>{calls.push(url);const start=Number(new URL(url).searchParams.get('start'));if(fail.includes(start))return {ok:false,status:503,error:'HTTP 503'};return {ok:true,status:200,data:body(positions.slice(start,start+10),count)};};request.calls=calls;return request;};
const okRequest=stub(all),full=await fetchPayPal({request:okRequest,observedAt:at,delayMs:0});
assert.equal(full.status,'complete');assert.equal(full.rows.length,25);assert.equal(full.total,25);assert.equal(full.pages,3);assert.equal(full.endpoint,PAYPAL_SEARCH);assert.equal(full.observedAt,at);
assert.equal(full.pageReceipts.length,3);assert.deepEqual(okRequest.calls,[0,10,20].map(paypalPageUrl));assert.equal(full.rows[24].sourceUrl,paypalPageUrl(20));
assert.equal(new Set(full.rows.map(x=>x.url)).size,25);

// A failed page gives partial, keeps the other pages and says why.
const flaky=stub(all,{fail:[10]}),partial=await fetchPayPal({request:flaky,observedAt:at,delayMs:0});
assert.equal(partial.status,'partial');assert.equal(partial.rows.length,15);assert.equal(partial.total,25);assert.equal(partial.pages,2);
assert.match(partial.reason,/page\(s\) 2 failed/);assert.equal(partial.pageReceipts.filter(x=>!x.ok).length,1);assert.equal(flaky.calls.filter(u=>u===paypalPageUrl(10)).length,2);

// Total mismatch: the board advertises more than it returns.
const short=await fetchPayPal({request:stub(all,{count:30}),observedAt:at,delayMs:0});
assert.equal(short.status,'partial');assert.equal(short.rows.length,25);assert.equal(short.total,30);assert.match(short.reason,/25 unique rows against an advertised total of 30/);
// Repeated records across pages are deduplicated and cannot reach 'complete'.
const repeat=await fetchPayPal({request:stub([...all.slice(0,10),...all.slice(0,10)]),observedAt:at,delayMs:0});
assert.equal(repeat.status,'partial');assert.equal(repeat.rows.length,10);assert.equal(repeat.duplicates,10);
// Page cap.
const capped=await fetchPayPal({request:stub(all),observedAt:at,delayMs:0,maxPages:2});
assert.equal(capped.status,'partial');assert.equal(capped.rows.length,20);assert.match(capped.reason,/2-page cap/);

// Nothing usable gives failed with no rows.
const down=await fetchPayPal({request:async()=>({ok:false,error:'HTTP 403'}),observedAt:at,delayMs:0});
assert.equal(down.status,'failed');assert.deepEqual(down.rows,[]);assert.match(down.reason,/HTTP 403/);
const changed=await fetchPayPal({request:async()=>({ok:true,data:{message:'Not authorized'}}),observedAt:at,delayMs:0});
assert.equal(changed.status,'failed');assert.deepEqual(changed.rows,[]);
const thrown=await fetchPayPal({request:async()=>{throw Error('socket closed');},observedAt:at,delayMs:0});
assert.equal(thrown.status,'failed');assert.deepEqual(thrown.rows,[]);
console.log('PASS: PayPal public-field projection, url identity, duplicate and invalid exclusion, pagination to completion, failed-page partial, total mismatch, page cap and failed source.');

if(process.argv.includes('--live')){
 const {requestPublic}=await import('../ats.mjs');
 const live=await fetchPayPal({request:requestPublic,observedAt:new Date().toISOString()});
 console.log(`LIVE: rows ${live.rows.length}, advertised total ${live.total}, status ${live.status}, pages ${live.pages}`);
 console.log(`LIVE reason: ${live.reason}`);
 if(live.rows[0])console.log('LIVE sample:',JSON.stringify(live.rows[0]));
 console.log(`LIVE unknown locations: ${live.rows.filter(x=>x.locationStatus==='unknown').length}, with pay: ${live.rows.filter(x=>x.pay).length}`);
}
