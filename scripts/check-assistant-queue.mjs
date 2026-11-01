import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { loadConfig } from '../assistant/config.mjs';
import { sql,initialize,enqueue,balance,fail,forget } from '../assistant/store.mjs';
loadConfig();await initialize();const session='test-'+randomUUID(),ip='test-'+randomUUID();
const profile={experience:'Synthetic Python experience',role:'software engineer',location:'Texas',workMode:'Any',learning:'Systems',minimumPay:0,currency:''};
try {
  const requests=await Promise.all([enqueue(session,ip,'match',{profile}),enqueue(session,ip,'match',{profile})]);
  assert.equal(requests.filter(Boolean).length,1,'Concurrent requests must accept only one active job');
  const id=requests.find(Boolean),row=(await sql()`SELECT input FROM senra_ai_jobs WHERE id=${id}`)[0];assert.ok(!row.input.includes('Synthetic'));
  assert.equal(await balance(session),14,'Only the successful reservation is charged');
  await fail(id);await fail(id);assert.equal(await balance(session),17,'Repeated failure must refund exactly once');
  const next=await enqueue(session,ip,'match',{profile});assert.ok(next);
  await forget(session);assert.equal(await balance(session),17,'Clearing pending work refunds its reservation');
  assert.equal((await sql()`SELECT input,result,status FROM senra_ai_jobs WHERE id=${next}`)[0].input,null);
  console.log('Queue checks passed: concurrent admission, encrypted payloads, atomic debit, idempotent refund and cancellation.');
}finally {await sql()`DELETE FROM senra_ai_jobs WHERE session_id=${session}`;await sql()`DELETE FROM senra_ai_sessions WHERE id=${session}`;}
