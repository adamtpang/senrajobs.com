import { neon } from '@neondatabase/serverless';
import { encrypt } from '../assistant/crypto.mjs';
let client,ready;
const sql=()=>client ||= neon(process.env.SENRA_DATABASE_URL);
export function initializeFeedback() {
  return ready ||= (async()=>{
    await sql()`CREATE TABLE IF NOT EXISTS senra_feedback (id uuid PRIMARY KEY, ip_hash text NOT NULL, message text NOT NULL, created_at timestamptz NOT NULL DEFAULT now())`;
    await sql()`CREATE TABLE IF NOT EXISTS senra_feedback_limits (ip_hash text PRIMARY KEY, hour timestamptz NOT NULL, used integer NOT NULL DEFAULT 1)`;
  })().catch(error=>{ready=null;throw error;});
}
export async function saveFeedback(id,ip,message) {
  await initializeFeedback();
  const prior=await sql()`SELECT id FROM senra_feedback WHERE id=${id} AND ip_hash=${ip}`;
  if(prior.length)return true;
  const rows=await sql()`WITH allowance AS (
    INSERT INTO senra_feedback_limits(ip_hash,hour,used) VALUES (${ip},date_trunc('hour',now()),1)
    ON CONFLICT(ip_hash) DO UPDATE SET hour=date_trunc('hour',now()),used=CASE WHEN senra_feedback_limits.hour<date_trunc('hour',now()) THEN 1 ELSE senra_feedback_limits.used+1 END
    WHERE senra_feedback_limits.hour<date_trunc('hour',now()) OR senra_feedback_limits.used<5 RETURNING ip_hash
  ) INSERT INTO senra_feedback(id,ip_hash,message) SELECT ${id},ip_hash,${encrypt({message},id)} FROM allowance ON CONFLICT(id) DO NOTHING RETURNING id`;
  if(!rows.length){const retry=await sql()`SELECT id FROM senra_feedback WHERE id=${id} AND ip_hash=${ip}`;return !!retry.length;}
  await sql()`DELETE FROM senra_feedback_limits WHERE hour<now()-interval '7 days'`;
  return true;
}
