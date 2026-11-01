import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {neon} from '@neondatabase/serverless';
import {loadConfig} from '../assistant/config.mjs';
import {sign,decrypt} from '../assistant/crypto.mjs';
import handler from '../api/feedback.mjs';
loadConfig();process.env.SENRA_DEV='1';
const db=neon(process.env.SENRA_DATABASE_URL),address=`feedback-test-${randomUUID()}`,ip=sign(`feedback:${address}`);
async function call(body,extra={}) {
  const req={method:'POST',headers:{origin:'http://127.0.0.1:4173','content-type':'application/json'},socket:{remoteAddress:address},body,...extra};
  let output;const headers={};const res={setHeader:(name,value)=>headers[name]=value,end:value=>output=JSON.parse(value)};
  await handler(req,res);return {status:res.statusCode,body:output,headers};
}
const message='Synthetic feedback fixture: the company logos help navigation.',id=randomUUID();
try {
  assert.equal((await call({id,message},{method:'GET'})).status,405);
  assert.equal((await call({id,message},{headers:{origin:'https://example.com','content-type':'application/json'}})).status,403);
  assert.equal((await call({id,message:''})).status,400);
  assert.equal((await call({id,message:'x'.repeat(2001)})).status,400);
  const saved=await call({id,message});assert.equal(saved.status,200);assert.equal(saved.headers['Cache-Control'],'no-store');
  assert.equal((await call({id,message})).status,200,'Retry must not create duplicate feedback');
  assert.equal((await call({id:id.toUpperCase(),message})).status,200,'UUID casing must not change encryption identity');
  const stored=await db`SELECT message FROM senra_feedback WHERE id=${id}`;
  assert.equal(stored.length,1);assert.ok(!stored[0].message.includes(message));assert.equal(decrypt(stored[0].message,id).message,message);
  const rejectedBots=await call({id:randomUUID(),message,website:'bot.example'});assert.equal(rejectedBots.status,200);
  const requests=await Promise.all(Array.from({length:6},()=>call({id:randomUUID(),message})));
  assert.equal(requests.filter(result=>result.status===200).length,4,'Atomic quota permits only four additional feedback entries');
  assert.equal(requests.filter(result=>result.status===429).length,2);
  const count=await db`SELECT count(*)::integer AS count FROM senra_feedback WHERE ip_hash=${ip}`;assert.equal(count[0].count,5);
  console.log('Feedback checks passed: validation, origin, encryption, retry deduplication and concurrent rate limit. Fictional records removed.');
}finally{await db`DELETE FROM senra_feedback WHERE ip_hash=${ip}`;await db`DELETE FROM senra_feedback_limits WHERE ip_hash=${ip}`;}
