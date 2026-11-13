import assert from 'node:assert/strict';
import {excludeCrossPosts,fetchCiFinancial,CI_SOURCE,CORIENT_SOURCE} from '../ci-feed.mjs';
const row=(id)=>({id,title:'Role '+id,url:'https://ci.wd3.myworkdayjobs.com/CI_FINANCIAL_EXTERNAL_CAREER-SITE/job/x/'+id});
const split=excludeCrossPosts([row('JR1'),row('JR2'),row('JR3')],[{id:'JR2'},{id:'JR9'}]);
assert.deepEqual(split.rows.map(r=>r.id),['JR1','JR3']);assert.deepEqual(split.excluded.map(r=>r.id),['JR2']);
assert.equal(excludeCrossPosts([{title:'no id'}],[{id:''}]).rows.length,1);
const boards=(ci,corient)=>async source=>source.slug===CI_SOURCE.slug?ci:source.slug===CORIENT_SOURCE.slug?corient:assert.fail('unexpected source');
const ok={rows:[row('JR1'),row('JR2')],status:'complete',total:2,pages:1,endpoint:'e',reason:''};
const done=await fetchCiFinancial({observedAt:'2026-11-13T00:00:00Z',fetchBoard:boards(ok,{rows:[{id:'JR2'}],status:'complete'})});
assert.equal(done.status,'complete');assert.equal(done.rows.length,1);assert.equal(done.excluded.length,1);assert.match(done.reason,/1 requisition cross-posted/);
const noCorient=await fetchCiFinancial({observedAt:'2026-11-13T00:00:00Z',fetchBoard:boards(ok,{rows:[],status:'partial'})});
assert.equal(noCorient.status,'failed');assert.equal(noCorient.rows.length,0);
const ciDown=await fetchCiFinancial({observedAt:'2026-11-13T00:00:00Z',fetchBoard:boards({rows:[],status:'failed',reason:'HTTP 500'},ok)});
assert.equal(ciDown.status,'failed');assert.equal(ciDown.reason,'HTTP 500');
if(process.argv.includes('--live')){
 const {requestPublic,fetchBoard}=await import('../ats.mjs');void fetchBoard;
 const atsModule=await import('../ats.mjs');
 const live=await fetchCiFinancial({request:requestPublic,mapJob:atsModule.mapATSJob,observedAt:new Date().toISOString()});
 console.log(`live: ${live.rows.length} rows, advertised ${live.total}, ${live.status}; ${live.reason}`);
}
console.log('PASS: CI Financial cross-post exclusion, incomplete Corient board and failed CI board.');
