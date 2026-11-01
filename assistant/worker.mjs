import { loadConfig } from './config.mjs';
import { sql,initialize,claim,succeed,fail,cleanup } from './store.mjs';
import { engines } from './engine.mjs';
import { catalog } from './catalog.mjs';
import { loadContent } from './content.mjs';
loadConfig();loadContent();await initialize();
const version=catalog().version;
const beat=()=>sql()`INSERT INTO senra_ai_worker(id,seen_at,catalog) VALUES(1,now(),${version}) ON CONFLICT(id) DO UPDATE SET seen_at=now(),catalog=EXCLUDED.catalog`;
await beat();const timer=setInterval(()=>beat().catch(()=>console.error('Worker heartbeat unavailable')),15000);
let stopping=false;
for(const event of ['SIGINT','SIGTERM'])process.on(event,()=>{stopping=true;clearInterval(timer);});
console.log('Senra local worker ready; subscription inference only. Candidate content is never logged.');
while(!stopping) {
  try {
    await cleanup();const job=await claim();
    if(!job){await new Promise(resolve=>setTimeout(resolve,2500));continue;}
    console.log(`${job.id}: ${job.kind} started`);
    try {const result=await engines[job.kind](job.payload);await succeed(job.id,result);console.log(`${job.id}: completed`);}
    catch {await fail(job.id);console.error(`${job.id}: failed; credits refunded`);}
  }catch {console.error('Queue connection unavailable; retrying');await new Promise(resolve=>setTimeout(resolve,10000));}
}
await sql()`DELETE FROM senra_ai_worker WHERE id=1`;console.log('Worker stopped');
