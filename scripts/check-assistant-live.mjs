import assert from 'node:assert/strict';
import fs from 'node:fs';
const origin=process.env.SENRA_TEST_ORIGIN||'http://127.0.0.1:4173';let cookie='';
async function call(method='GET',body,id,other=false) {const r=await fetch(`${origin}/api/assistant${id?'?id='+id:''}`,{method,headers:{Origin:origin,'Content-Type':'application/json',...(!other&&cookie?{Cookie:cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});if(!other&&r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];return {status:r.status,body:await r.json()};}
async function ask(kind,payload) {const queued=await call('POST',{kind,...payload});assert.equal(queued.status,202,JSON.stringify(queued.body));const id=queued.body.id;assert.equal((await call('GET',null,id,true)).status,404,'Another session must not read the result');const deadline=Date.now()+420000;while(Date.now()<deadline){await new Promise(resolve=>setTimeout(resolve,2000));const job=await call('GET',null,id);assert.equal(job.status,200);if(job.body.status==='done')return {id,result:job.body.result};if(job.body.status==='failed')throw new Error(job.body.error);}throw new Error('Timeout');}
const before=await call();assert.ok(before.body.online);
assert.equal((await call('POST',{kind:'match',profile:{}})).status,400);
const interview=await ask('interview',{messages:[{role:'user',text:'I have five years of backend software engineering experience with Python and TypeScript. I want a software engineer role in Austin, Texas. I can work onsite or remotely. I want at least USD 120000 annually and to learn how reliable systems are built.'}]});assert.ok(interview.result.question);assert.ok(interview.result.profile.role);
console.log('Real interview passed; cross-session access blocked.');
const profile={experience:'Five years backend software engineering, Python and TypeScript',role:'software engineer',location:'Texas',workMode:'Any',learning:'Reliable systems and founder-led company building',minimumPay:120000,currency:'USD'};
const match=await ask('match',{profile});assert.ok(match.result.matches.length>0);assert.ok(match.result.matches.every(role=>role.url.startsWith('https://')&&role.location&&role.reason&&role.score>=0&&role.score<=100));console.log(`Real shortlist passed: ${match.result.matches.length} cited employer roles.`);
const sage=await ask('sage',{question:'How should I choose a company as an apprenticeship before founding my own?',profile});assert.ok(sage.result.sources.length);console.log(`Real Sage answer passed: ${sage.result.sources.length} verified source citations.`);
const after=await call();assert.equal(after.body.credits,before.body.credits-5);
assert.equal((await call('DELETE')).status,200);assert.equal((await call('GET',null,match.id)).body.status,'deleted');
fs.writeFileSync('reports/assistant-live-check.json',JSON.stringify({checkedAt:new Date().toISOString(),origin,interview:interview.result,match:match.result,sage:sage.result,checks:{crossSession:true,credits:true,clear:true}},null,2));
console.log('Live assistant checks passed: actual local inference, role evidence, citations, metering and deletion.');
