import assert from 'node:assert/strict';
import {parseBeatsPage,fetchBeats,groupBeats,beatsPageUrl,BEATS_SEARCH,BEATS_PRODUCT,BEATS_BRAND} from '../beats-feed.mjs';
const at='2026-11-13T00:00:00Z';
const job=(id,title,slug,place='Cupertino',extra={})=>({id,positionId:id.split('-')[0],reqId:id,postingTitle:title,transformedPostingTitle:slug,postDateInGMT:'2026-11-09T22:55:35.808Z',team:{teamName:'Hardware',teamCode:'HRDWR'},locations:[{name:place,city:'',stateProvince:'',countryName:'United States of America'}],homeOffice:false,jobSummary:'must not project',...extra});
// Same shape as the live page: an escaped JSON string handed to JSON.parse in an inline script.
const html=(results,total,page=1,product=BEATS_PRODUCT)=>`<html><script>window.__staticRouterHydrationData = JSON.parse(${JSON.stringify(JSON.stringify({loaderData:{search:{searchResults:results,totalRecords:total,page,queryParams:{product},requestUrl:beatsPageUrl(page)}}}))});</script></html>`;

// Normal parse: two location records of one position group into one row, lowest record id first.
const one=parseBeatsPage(html([job('200690910-3749','Senior Firmware Engineer','senior-firmware-engineer','San Jose'),job('200690910-0836','Senior Firmware Engineer','senior-firmware-engineer'),job('200673548','Test Station DRI- Beats FATP &amp; R&#38;D','test-station-dri-beats-fatp','Shenzhen Metro Area',{team:{teamName:'Operations &amp; Supply Chain',teamCode:'OPMFG'},locations:[{name:'Shenzhen Metro Area',countryName:'China'}]})],3),at);
assert.equal(one.total,3);assert.equal(one.records.length,3);assert.equal(one.rows.length,2);
const [fw,test]=one.rows;
assert.equal(fw.id,'200690910');
assert.equal(fw.url,'https://jobs.apple.com/en-us/details/200690910-0836/senior-firmware-engineer?team=HRDWR');
assert.deepEqual(fw.alternateUrls,['https://jobs.apple.com/en-us/details/200690910-3749/senior-firmware-engineer?team=HRDWR']);
assert.equal(fw.location,'Cupertino, United States of America');assert.deepEqual(fw.secondaryLocations,['San Jose, United States of America']);
assert.deepEqual(fw.locations[0],{raw:'Cupertino, United States of America',country:'United States of America',sourceUrl:BEATS_SEARCH,observedAt:at,source:'employer-public-feed',confidence:'published'});
assert.equal(fw.locationStatus,'published');assert.equal(fw.locationSource,'employer-public-feed');assert.equal(fw.employerBrand,BEATS_BRAND);assert.ok(fw.associationBasis);
assert.equal(fw.department,'Hardware');assert.equal(fw.publishedAt,'2026-11-09T22:55:35.808Z');assert.equal(fw.sourceStatus,'current');assert.equal(fw.observedAt,at);assert.equal(fw.workplace,'');assert.equal(fw.employmentType,'');
assert.ok(!('pay' in fw));assert.ok(!JSON.stringify(one).includes('must not project'));
// Entities are decoded; a record id without a location suffix keeps Apple's own url form.
assert.equal(test.title,'Test Station DRI- Beats FATP & R&D');assert.equal(test.department,'Operations & Supply Chain');assert.equal(test.location,'Shenzhen Metro Area, China');
assert.equal(test.url,'https://jobs.apple.com/en-us/details/200673548/test-station-dri-beats-fatp?team=OPMFG');assert.ok(!('alternateUrls' in test));

// Duplicate and invalid records are skipped and counted; missing location is unknown, never invented.
const messy=parseBeatsPage(html([job('200000001-0836','A','a'),job('200000001-0836','A','a'),job('200000002-0836','','b'),job('200000003-0836','C','../evil'),{...job('200000004-0836','D','d'),positionId:'999'},job('200000005-0836','E','e','',{locations:[],postDateInGMT:'not a date',homeOffice:true})],6),at);
assert.equal(messy.rows.length,2);assert.equal(messy.duplicates,1);assert.equal(messy.invalid,3);
assert.equal(messy.rows[1].location,'');assert.equal(messy.rows[1].locationStatus,'unknown');assert.deepEqual(messy.rows[1].locations,[]);assert.equal(messy.rows[1].publishedAt,'');assert.equal(messy.rows[1].workplace,'Remote');
for(const row of messy.rows)assert.ok(row.url.startsWith('https://jobs.apple.com/en-us/details/'));
assert.equal(groupBeats(messy.records).length,2);
// A percent-encoded slug (title starting with the Apple logo glyph) is valid and keeps Apple's url bytes.
const glyph=parseBeatsPage(html([job('200680823-0836',' Speech Processing ML Algorithm Engineer','%EF%A3%BF-speech-processing-ml-algorithm-engineer')],1),at).rows[0];
assert.equal(glyph.title,'Speech Processing ML Algorithm Engineer');assert.equal(glyph.url,'https://jobs.apple.com/en-us/details/200680823-0836/%EF%A3%BF-speech-processing-ml-algorithm-engineer?team=HRDWR');

// Missing or unreadable payload, missing total, and a search that lost its Beats scope all throw.
assert.throws(()=>parseBeatsPage('<html>No data</html>',at),/payload missing/);
assert.throws(()=>parseBeatsPage('<script>window.__staticRouterHydrationData = JSON.parse("{broken");</script>',at),/unreadable/);
assert.throws(()=>parseBeatsPage(html([job('200000001-0836','A','a')],1).replace('"totalRecords\\":1','"totalRecordsX\\":1'),at),/totalRecords missing/);
assert.throws(()=>parseBeatsPage(html([job('200000001-0836','A','a')],1,1,'all-apple'),at),/refusing to widen/);

// Pagination to completion with a stub request: a position split across pages still becomes one row.
const all=[job('200000001-0836','A','a'),job('200000002-0836','B','b'),job('200000003-3749','C','c','San Jose'),job('200000003-0836','C','c'),job('200000004-0836','D','d')];
const pagesOf=(list,total=list.length)=>p=>html(list.slice((p-1)*3,p*3),list.slice((p-1)*3,p*3).length?total:0,p);
const stub=(render,calls=[])=>Object.assign(async url=>{calls.push(url);const p=Number(new URL(url).searchParams.get('page'))||1;const text=render(p);return text==null?{ok:false,status:500,url,error:'HTTP 500'}:{ok:true,status:200,url,text};},{calls});
const request=stub(pagesOf(all));
const done=await fetchBeats({request,observedAt:at});
assert.equal(done.status,'complete');assert.equal(done.total,5);assert.equal(done.postings,5);assert.equal(done.rows.length,4);assert.equal(done.pages,2);
assert.deepEqual(request.calls,[BEATS_SEARCH,`${BEATS_SEARCH}&page=2`]);assert.equal(done.endpoint,BEATS_SEARCH);assert.equal(done.observedAt,at);
assert.deepEqual(done.pageReceipts.map(p=>[p.page,p.rows,p.total]),[[1,3,5],[2,2,5]]);
const split=done.rows.find(r=>r.id==='200000003');assert.ok(split.url.includes('200000003-0836'));assert.equal(split.alternateUrls.length,1);assert.equal(split.secondaryLocations.length,1);
assert.equal(new Set(done.rows.map(r=>r.url)).size,done.rows.length);

// A failed later page keeps what was collected and reports partial.
const partial=await fetchBeats({observedAt:at,request:stub(p=>p===2?null:pagesOf(all)(p))});
assert.equal(partial.status,'partial');assert.equal(partial.rows.length,3);assert.match(partial.reason,/Page 2 failed: HTTP 500/);
// Fewer records than advertised, an invalid record, a repeated page and the page bound are all partial.
assert.equal((await fetchBeats({observedAt:at,request:stub(pagesOf(all,9))})).status,'partial');
assert.equal((await fetchBeats({observedAt:at,request:stub(pagesOf([...all.slice(0,4),job('200000009-0836','','x')]))})).status,'partial');
const repeat=await fetchBeats({observedAt:at,request:stub(()=>html(all.slice(0,3),5))});assert.equal(repeat.status,'partial');assert.match(repeat.reason,/repeated a page/);assert.equal(repeat.pages,2);
const bounded=await fetchBeats({observedAt:at,maxPages:1,request:stub(pagesOf(all))});assert.equal(bounded.status,'partial');assert.match(bounded.reason,/Bounded pagination/);
// Nothing usable is failed with no rows.
for(const bad of [stub(()=>null),stub(()=>'<html>blocked</html>'),stub(()=>html(all,5,1,'other-product'))]){const failed=await fetchBeats({observedAt:at,request:bad});assert.equal(failed.status,'failed');assert.deepEqual(failed.rows,[]);assert.ok(failed.reason);}

if(process.argv.includes('--live')){
 const {requestPublic}=await import('../ats.mjs');
 const live=await fetchBeats({request:requestPublic,observedAt:new Date().toISOString()});
 for(const row of live.rows)console.log(`${row.id} | ${row.title} | ${[row.location,...row.secondaryLocations].join('; ')||'(location unknown)'} | ${row.url}${row.alternateUrls?` (+${row.alternateUrls.length} alternate)`:''}`);
 console.log(`LIVE Beats: status ${live.status}; advertised total ${live.total}; posting records ${live.postings}; rows ${live.rows.length}; pages ${live.pages}; invalid ${live.invalid}; duplicates ${live.duplicates}`);
 console.log(`LIVE reason: ${live.reason}`);
}
console.log('PASS: Beats product-scoped parse, position grouping with alternate urls, entity decoding, duplicate and invalid counting, scope and payload guards, pagination to the advertised total, partial and failed outcomes.');
