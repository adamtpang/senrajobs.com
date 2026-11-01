import assert from 'node:assert/strict';
import fs from 'node:fs';
import {catalog} from '../assistant/catalog.mjs';
import {cleanProfile} from '../assistant/profile.mjs';
const origin=process.env.SENRA_TEST_ORIGIN||'http://127.0.0.1:4173';let cookie='';
async function call(method='GET',body,id){const response=await fetch(`${origin}/api/assistant${id?'?id='+id:''}`,{method,headers:{Origin:origin,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});if(response.headers.get('set-cookie'))cookie=response.headers.get('set-cookie').split(';')[0];return {status:response.status,data:await response.json()};}
async function ask(payload){const queued=await call('POST',{kind:'match',...payload});assert.equal(queued.status,202,JSON.stringify(queued.data));for(let i=0;i<210;i++){await new Promise(r=>setTimeout(r,1800));const job=await call('GET',null,queued.data.id);if(job.data.status==='failed')return {failed:true};if(job.data.status==='done')return job.data.result;}throw new Error('Inference timed out');}
const profile=cleanProfile(JSON.parse(fs.readFileSync('scripts/fixtures/professional-profile.json'))),target=catalog().roles.find(r=>r.company==='Base Power'&&r.title==='Software Engineer, Backend');assert.ok(target);
const initial=(await call()).data.credits;
assert.ok((await ask({profile,targetUrl:'https://example.invalid/not-a-catalog-role'})).failed,'Untrusted URLs never reach the source fetcher');
assert.equal((await call()).data.credits,initial,'Outside-catalog request must be refunded');
const result=await ask({profile,targetUrl:target.url});assert.equal(result.matches.length,1);const fit=result.matches[0];assert.equal(fit.url,target.url);assert.equal(fit.criteria.length,5);assert.ok(fit.scoreRange&&fit.scoreRange[0]<=fit.scoreRange[1]);assert.equal(fit.criteria.find(c=>c.key==='practical').rating,null,'Unverified minimum-pay compatibility cannot receive a fabricated practical score');
assert.equal((await call()).data.credits,initial-3);await call('DELETE');
fs.writeFileSync('reports/target-fit-check.json',JSON.stringify({checkedAt:new Date().toISOString(),origin,result,checks:{catalogOnly:true,refund:true,correctRole:true,weightedCriteria:true,unknownSalary:true,credits:true}},null,2));console.log('Target-role check passed: actual local AI, catalog-only sources, refund, criteria, uncertainty and credits.');
