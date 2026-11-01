import assert from 'node:assert/strict';
import {fetchBoard,retainBoard} from '../ats.mjs';
const source={kind:'workday',slug:'example|wd5|External'};
const item=i=>({title:`Engineer ${i}`,externalPath:`/job/Austin/Engineer_${i}`,locationsText:'Austin, TX'});
function fixture({capped=false,fail=false,malformed=false,drift=false,repeated=false,uncorroborated=false}={}){
 let roots=0;
 return async(url,options)=>{
  const q=JSON.parse(options.body),key=q.appliedFacets.category?.[0];
  const size=capped?(key==='a'?1100:key==='b'?910:2000):43;
  const start=key==='b'?1100:0;
  if(fail&&q.offset===20)return {ok:false,status:503,error:'HTTP 503'};
  let offset=repeated&&q.offset?0:q.offset;
  const jobs=Array.from({length:Math.min(20,Math.max(0,size-offset))},(_,i)=>item(start+offset+i));
  if(malformed&&q.offset===20)jobs[0]={title:'No URL'};
  if(!key)roots++;
  const facets=capped?[{facetParameter:'category',values:[{id:'a',count:1100},{id:'b',count:drift&&roots>1?911:910}]},...(!uncorroborated?[{facetParameter:'time',values:[{id:'full',count:2010}]}]:[])]:[];
  return {ok:true,status:200,data:{total:q.offset?0:size,jobPostings:jobs,facets}};
 };
}
let r=await fetchBoard(source,{request:fixture()});assert.equal(r.status,'complete');assert.equal(r.rows.length,43);assert.equal(r.pages,3);
r=await fetchBoard(source,{request:fixture({capped:true})});assert.equal(r.status,'complete');assert.equal(r.rows.length,2010);assert.equal(r.total,2010);assert.equal(r.partitionReceipt.unfilteredTotal,2000);assert.equal(r.pages,103);
const board=retainBoard(null,{...r,source:'workday:example|wd5|External'},r.observedAt);assert.equal(board.coverage.partitionReceipt.expectedTotal,2010);assert.deepEqual(board.coverage.pageReceipts[1].appliedFacets,{category:['a']});
for(const options of [{fail:true},{malformed:true},{repeated:true},{capped:true,drift:true},{capped:true,uncorroborated:true}]){r=await fetchBoard(source,{request:fixture(options)});assert.equal(r.status,'partial',JSON.stringify(options));assert.ok(r.reason);}
r=await fetchBoard(source,{request:fixture({capped:true}),maxPages:4});assert.equal(r.status,'partial');assert.match(r.reason,/Page limit/);
r=await fetchBoard(source,{request:async()=>({ok:true,data:{total:0,jobPostings:[]}})});assert.equal(r.status,'complete');assert.equal(r.rows.length,0);
console.log('Workday: pagination, capped facet union, receipts, missing evidence, drift, malformed/repeated pages and limits passed.');
