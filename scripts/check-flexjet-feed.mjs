import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseFlexjetPage,fetchFlexjet,flexjetJobUrl,isFlexjetTechnical,FLEXJET_SEARCH,FLEXJET_UNSPECIFIED} from '../flexjet-feed.mjs';
import {requestPublic,retainBoard} from '../ats.mjs';
const at='2026-11-13T00:00:00Z';
const MX='Aircraft Maintenance and Support',CORP='Corporate, Operations and Owner Support';
const job=(id,title,category=CORP,extra={})=>({jobId:String(id),reqId:String(id),title,category,type:'Full Time',location:'Cleveland, OH, US, 44143',multi_location:['Cleveland, OH, US, 44143'],city:'Cleveland',postedDate:'2026-06-16T20:14:06.753+0000',applyUrl:'http://flexjet.clearcompany.com/careers/jobs/9d25c794-f24f-5db4-8028-673842d03ec3/apply',descriptionTeaser:'must not project {"}',...extra});
const html=(jobs,totalHits,categories)=>`<html><script>var phApp=phApp||{};phApp.ddo = {"other":{"a":1},"eagerLoadRefineSearch":${JSON.stringify({status:200,hits:jobs.length,totalHits,data:{jobs,aggregations:categories?[{field:'country',value:{US:1}},{field:'category',value:categories}]:[]},eid:'x'})},"after":{}}; phApp.x={};</script></html>`;

// Normal parse: url format, published fields only, brand default and explicit brand.
const tech=job(869,'PMA Kitting & Harness Technician- Flexjet Technical Services (EMS)',MX);
const page=parseFlexjetPage(html([job(1051,'Part 145 Stores Operative','EU Aircraft Engineering and Support',{location:'GB',multi_location:['GB','Farnborough, GB, GU146FG']}),tech,job(7,'Sales Director',CORP,{brand:'Sentient Jet'}),job(8,'Quiet Role',CORP,{location:'',multi_location:[],applyUrl:''})],142,{[MX]:1}),at);
assert.equal(page.total,142);assert.equal(page.rows.length,4);assert.equal(page.invalid,0);assert.equal(page.duplicates,0);
const [a,b,c,d]=page.rows;
assert.equal(a.url,'https://careers.flexjet.com/us/en/job/1051/Part-145-Stores-Operative');
assert.equal(b.url,'https://careers.flexjet.com/us/en/job/869/PMA-Kitting-Harness-Technician-Flexjet-Technical-Services-EMS');
assert.equal(flexjetJobUrl('1121','Captain (Must reside within 2 hours of KDAL)'),'https://careers.flexjet.com/us/en/job/1121/Captain-Must-reside-within-2-hours-of-KDAL');
assert.deepEqual([a.id,a.location,a.secondaryLocations,a.locationStatus,a.department,a.employmentType,a.workplace,a.publishedAt,a.sourceStatus,a.observedAt],['1051','GB',['Farnborough, GB, GU146FG'],'published','EU Aircraft Engineering and Support','Full Time','','2026-06-16T20:14:06.753+0000','current',at]);
assert.deepEqual(a.locations[0],{raw:'GB',sourceUrl:FLEXJET_SEARCH,observedAt:at,source:'employer-public-feed',confidence:'published'});
assert.equal(a.locationSource,'employer-public-feed');assert.equal(a.sourceUrl,FLEXJET_SEARCH);
assert.equal(a.employerBrand,FLEXJET_UNSPECIFIED);assert.equal(c.employerBrand,'Sentient Jet');
assert.equal(a.sourceApplyUrl,'https://flexjet.clearcompany.com/careers/jobs/9d25c794-f24f-5db4-8028-673842d03ec3/apply');assert.equal(a.sourceJobIdentity,'clearcompany:9d25c794-f24f-5db4-8028-673842d03ec3');
assert.deepEqual([d.location,d.locations,d.locationStatus,d.sourceApplyUrl],['',[],'unknown',undefined]);
assert.ok(!JSON.stringify(page).includes('must not project'));assert.ok(!('pay' in a));
assert.equal(a.alternateUrls,undefined);
assert.deepEqual(parseFlexjetPage(html([job(973,'Aircraft Maintenance Technician (TEB)',MX,{jobSeqNo:'OJAOJCUS973EXTERNALENUS'})],1),at).rows[0].alternateUrls,['https://careers.flexjet.com/us/en/job/OJAOJCUS973EXTERNALENUS/Aircraft-Maintenance-Technician-TEB']);
assert.equal(isFlexjetTechnical(b),true);assert.equal(isFlexjetTechnical(a),false);

// Duplicate and invalid records are skipped and counted.
const messy=parseFlexjetPage(html([job(1,'Engineer'),job(1,'Engineer'),{...job(2,'Engineer'),title:'  '},{...job(3,'Engineer'),jobId:'../3'},{title:'No id'},null,job(4,'Planner')],5),at);
assert.deepEqual([messy.rows.map(r=>r.id),messy.duplicates,messy.invalid,messy.raw],[['1','4'],1,4,7]);

// Missing or unusable payload throws instead of returning an empty board.
assert.throws(()=>parseFlexjetPage('<html>No jobs here</html>',at),/payload missing/);
assert.throws(()=>parseFlexjetPage('<script>{"eagerLoadRefineSearch":{"totalHits":3,"data":{}}}</script>',at),/jobs array/);
assert.throws(()=>parseFlexjetPage('<script>{"eagerLoadRefineSearch":{"totalHits":3,"data":{"jobs":[',at),/truncated/);

// Stub board: five roles, two per page.
const board=[job(11,'Avionics Technician- Flexjet Technical Services (EMS)',MX),job(12,'Aircraft Maintenance Technician (CLE)',MX),job(13,'Owner Experience Concierge'),job(14,'Flexjet Technical Services Recruiter'),job(15,'Dedicated Inspector- Flexjet Technical Services (EMS)',MX)];
const counts={[MX]:3,[CORP]:2};
const stub=({pagesOf=list=>list,fail=()=>false,categories=counts,log=[]}={})=>Object.assign(async url=>{
 log.push(url);const u=new URL(url),from=Number(u.searchParams.get('from')||0),category=u.searchParams.get('category');
 assert.equal(u.origin+u.pathname,FLEXJET_SEARCH);assert.equal(u.searchParams.get('sortBy'),'Most recent');
 if(fail(url,from,category))return {ok:false,status:503,url,error:'HTTP 503'};
 const list=category?board.filter(j=>j.category===category):pagesOf(board);
 return {ok:true,status:200,url,text:html(list.slice(from,from+2),category?list.length:board.length,categories)};
},{log});

// Pagination to completion.
const request=stub();
const full=await fetchFlexjet({slug:'flexjet'},{request,observedAt:at,delayMs:0});
assert.deepEqual([full.status,full.total,full.rows.length,full.pages,full.endpoint,full.observedAt],['complete',5,5,3,FLEXJET_SEARCH,at]);
assert.deepEqual(request.log.map(u=>new URL(u).searchParams.get('from')),[null,'2','4']);
assert.deepEqual(full.pageReceipts.map(p=>[p.offset,p.status,p.total,p.rows]),[[0,'observed',5,2],[2,'observed',5,2],[4,'observed',5,1]]);
assert.equal(new Set(full.rows.map(r=>r.url)).size,5);

// Unstable ordering repeats one role and hides another; the category counts recover it.
const shuffled=stub({pagesOf:list=>[list[0],list[1],list[1],list[3],list[4]]});
const healed=await fetchFlexjet({slug:'flexjet'},{request:shuffled,observedAt:at,delayMs:0});
assert.deepEqual([healed.status,healed.rows.length,healed.duplicates>0],['complete',5,true]);
assert.ok(shuffled.log.some(u=>u.includes('category=Corporate%2C%20Operations')));assert.ok(!shuffled.log.some(u=>u.includes('category=Aircraft')));
// Without counts to reconcile against, the same gap stays an honest partial.
const gap=await fetchFlexjet({slug:'flexjet'},{request:stub({pagesOf:list=>[list[0],list[1],list[1],list[3],list[4]],categories:null}),observedAt:at,delayMs:0});
assert.deepEqual([gap.status,gap.rows.length,gap.total],['partial',4,5]);

// A failed page gives partial, a failed first page gives failed, a page limit gives partial.
const broken=await fetchFlexjet({slug:'flexjet'},{request:stub({fail:(url,from)=>from===2,categories:null}),observedAt:at,delayMs:0});
assert.deepEqual([broken.status,broken.rows.length,broken.total],['partial',3,5]);assert.match(broken.reason,/3 unique of 5 advertised/);
assert.ok(broken.pageReceipts.some(p=>p.status==='failed'&&p.offset===2&&p.reason==='HTTP 503'));
// When the category listings still answer, the roles behind a failed page are recovered and counted.
const recovered=await fetchFlexjet({slug:'flexjet'},{request:stub({fail:(url,from,category)=>from===2&&!category}),observedAt:at,delayMs:0});
assert.deepEqual([recovered.status,recovered.rows.length,recovered.pageReceipts.filter(p=>p.status==='failed').length],['complete',5,1]);
const down=await fetchFlexjet({slug:'flexjet'},{request:stub({fail:()=>true}),observedAt:at,delayMs:0});
assert.deepEqual([down.status,down.rows,down.reason],['failed',[],'HTTP 503']);
const changed=await fetchFlexjet({slug:'flexjet'},{request:async url=>({ok:true,status:200,url,text:'Changed page'}),observedAt:at,delayMs:0});
assert.deepEqual([changed.status,changed.rows.length],['failed',0]);
const limited=await fetchFlexjet({slug:'flexjet'},{request:stub(),observedAt:at,delayMs:0,maxPages:2});
assert.deepEqual([limited.status,limited.rows.length,limited.pages],['partial',4,2]);assert.match(limited.reason,/page limit 2/);

// Technical Services slug: only the maintenance category with the division named in the title.
const technical=await fetchFlexjet({slug:'flexjet-technical'},{request:stub(),observedAt:at,delayMs:0});
assert.deepEqual([technical.status,technical.rows.map(r=>r.id),technical.total,technical.groupTotal],['complete',['11','15'],2,5]);
const technicalPartial=await fetchFlexjet({slug:'flexjet-technical'},{request:stub({fail:(url,from)=>from===4,categories:null}),observedAt:at,delayMs:0});
assert.deepEqual([technicalPartial.status,technicalPartial.rows.map(r=>r.id),technicalPartial.total],['partial',['11'],null]);
const bare=board.map(j=>({...j,category:undefined}));
const undecidable=await fetchFlexjet({slug:'flexjet-technical'},{request:async url=>({ok:true,status:200,url,text:html(bare.slice(Number(new URL(url).searchParams.get('from')||0)).slice(0,2),5)}),observedAt:at,delayMs:0});
assert.deepEqual([undecidable.status,undecidable.rows],['failed',[]]);assert.match(undecidable.reason,/without guessing/);
const unknown=await fetchFlexjet({slug:'sentient-jet'},{request:stub(),observedAt:at,delayMs:0});assert.equal(unknown.status,'failed');

// A complete refresh keeps role identity by url and drops roles the board no longer lists.
const previous={roles:[{id:'11',url:full.rows[0].url,title:'old',observedAt:'2026-10-28T00:00:00Z'},{id:'9',url:flexjetJobUrl('9','Closed Role'),title:'Closed Role'}]};
const kept=retainBoard(previous,full,at);
assert.equal(kept.roles.length,5);assert.equal(kept.roles.find(r=>r.id==='11').firstSeen,'2026-10-28T00:00:00Z');assert.equal(kept.coverage.status,'complete');
assert.equal(retainBoard(previous,broken,at).roles.some(r=>r.id==='9'&&r.sourceStatus==='retained-previous'),true);

if(process.argv.includes('--live')){
 const observedAt=new Date().toISOString(),existing=JSON.parse(fs.readFileSync(new URL('../jobs.json',import.meta.url),'utf8'));
 for(const [slug,label] of [['flexjet','Flexjet (chairman)'],['flexjet-technical','Flexjet Technical Services (Nextant Aerospace / Constant Aviation operations)']]){
  const result=await fetchFlexjet({slug},{request:requestPublic,observedAt});
  const urls=new Set(result.rows.map(r=>r.url)),old=existing[label]?.roles||[];
  const alternates=new Set(result.rows.flatMap(r=>r.alternateUrls||[]));
  console.log(`LIVE ${slug}: rows ${result.rows.length}, advertised total ${result.total}${result.groupTotal!=null?` (group ${result.groupTotal})`:''}, status ${result.status}, pages ${result.pages}, existing urls reproduced ${old.filter(r=>urls.has(r.url)).length}/${old.length}, matched only as alternate ${old.filter(r=>!urls.has(r.url)&&alternates.has(r.url)).length}`);
  console.log(`  ${result.reason}`);
 }
}
console.log('PASS: Flexjet page parse, url identity, duplicate and invalid skipping, missing payload, pagination, unstable-order reconciliation, failed-page partial, page limit and Technical Services scoping.');
