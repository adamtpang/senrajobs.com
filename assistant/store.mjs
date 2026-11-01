import { neon } from '@neondatabase/serverless';
import { randomUUID } from 'node:crypto';
import { encrypt, decrypt } from './crypto.mjs';
let client;
export function sql() { return client ||= neon(process.env.SENRA_DATABASE_URL); }
export const costs={interview:1,match:3,sage:1};
export async function initialize() {
  const db=sql();
  await db`CREATE TABLE IF NOT EXISTS senra_ai_sessions (id text PRIMARY KEY, ip_hash text NOT NULL, welcome integer NOT NULL DEFAULT 12, daily integer NOT NULL DEFAULT 5, day date NOT NULL DEFAULT CURRENT_DATE, created_at timestamptz NOT NULL DEFAULT now(), touched_at timestamptz NOT NULL DEFAULT now())`;
  await db`CREATE TABLE IF NOT EXISTS senra_ai_jobs (id uuid PRIMARY KEY, session_id text NOT NULL, kind text NOT NULL, status text NOT NULL DEFAULT 'pending', input text, result text, error text, welcome_cost integer NOT NULL DEFAULT 0, daily_cost integer NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now(), claimed_at timestamptz, finished_at timestamptz)`;
  await db`CREATE INDEX IF NOT EXISTS senra_ai_jobs_pending ON senra_ai_jobs(status,created_at)`;
  await db`CREATE UNIQUE INDEX IF NOT EXISTS senra_ai_one_active_session ON senra_ai_jobs(session_id) WHERE status IN ('pending','working')`;
  await db`CREATE TABLE IF NOT EXISTS senra_ai_worker (id integer PRIMARY KEY, seen_at timestamptz NOT NULL, catalog text NOT NULL)`;
}
export async function availability() { const rows=await sql()`SELECT seen_at, catalog FROM senra_ai_worker WHERE id=1 AND seen_at > now()-interval '90 seconds'`; return rows[0] || null; }
export async function balance(session) { const rows=await sql()`SELECT welcome+CASE WHEN day=CURRENT_DATE THEN daily ELSE 5 END AS credits FROM senra_ai_sessions WHERE id=${session}`; return rows[0]?.credits ?? 17; }
export async function enqueue(session, ip, kind, payload) {
  const db=sql(), id=randomUUID(), cost=costs[kind];
  await db`INSERT INTO senra_ai_sessions(id,ip_hash) VALUES (${session},${ip}) ON CONFLICT(id) DO NOTHING`;
  // All checks, debit and insertion happen under one locked session row. No browser counter authority.
  let rows;
  try {rows=await db`WITH account AS (
    SELECT *, CASE WHEN day=CURRENT_DATE THEN daily ELSE 5 END AS available_daily FROM senra_ai_sessions WHERE id=${session} FOR UPDATE
  ), allowed AS (
    SELECT * FROM account WHERE welcome+available_daily>=${cost}
    AND NOT EXISTS (SELECT 1 FROM senra_ai_jobs WHERE session_id=${session} AND status IN ('pending','working'))
    AND (SELECT COUNT(*) FROM senra_ai_jobs j JOIN senra_ai_sessions s ON j.session_id=s.id WHERE s.ip_hash=${ip} AND j.created_at > now()-interval '24 hours')<60
    AND (SELECT COUNT(*) FROM senra_ai_jobs WHERE created_at>now()-interval '24 hours')<150
  ), debit AS (
    UPDATE senra_ai_sessions s SET welcome=a.welcome-LEAST(a.welcome,${cost}), daily=a.available_daily-GREATEST(0,${cost}-a.welcome), day=CURRENT_DATE,touched_at=now() FROM allowed a WHERE s.id=a.id RETURNING LEAST(a.welcome,${cost}) AS wc,GREATEST(0,${cost}-a.welcome) AS dc
  ) INSERT INTO senra_ai_jobs(id,session_id,kind,input,welcome_cost,daily_cost) SELECT ${id},${session},${kind},${encrypt(payload,id)},wc,dc FROM debit RETURNING id`;}catch(error){if(error.code==='23505')return null;throw error;}
  return rows[0]?.id || null;
}
export async function getJob(id,session) { const rows=await sql()`SELECT id,status,result,error,kind FROM senra_ai_jobs WHERE id=${id} AND session_id=${session} AND created_at>now()-interval '24 hours'`; const row=rows[0]; if(!row)return null; return {id:row.id,status:row.status,kind:row.kind,...(row.result?{result:decrypt(row.result,row.id)}:{}),...(row.error?{error:row.error}:{})}; }
export async function claim() { const rows=await sql()`UPDATE senra_ai_jobs SET status='working',claimed_at=now() WHERE id=(SELECT id FROM senra_ai_jobs WHERE status='pending' ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING id,kind,input,session_id`; const row=rows[0]; return row?{...row,payload:decrypt(row.input,row.id)}:null; }
export async function succeed(id,result) { await sql()`UPDATE senra_ai_jobs SET status='done',input=NULL,result=${encrypt(result,id)},finished_at=now() WHERE id=${id} AND status='working'`; }
export async function fail(id,message='The assistant could not finish. Your credits were returned.') {
  await sql()`WITH failed AS (UPDATE senra_ai_jobs SET status='failed',input=NULL,result=NULL,error=${message},finished_at=now() WHERE id=${id} AND status IN ('pending','working') RETURNING session_id,welcome_cost,daily_cost,created_at)
    UPDATE senra_ai_sessions s SET welcome=welcome+f.welcome_cost,daily=CASE WHEN s.day=CURRENT_DATE AND f.created_at::date=CURRENT_DATE THEN daily+f.daily_cost ELSE daily END FROM failed f WHERE s.id=f.session_id`;
}
export async function forget(session) {
  const active=await sql()`SELECT id FROM senra_ai_jobs WHERE session_id=${session} AND status IN ('pending','working')`;
  for(const row of active)await fail(row.id);
  await sql()`UPDATE senra_ai_jobs SET status='deleted',input=NULL,result=NULL,error=NULL WHERE session_id=${session}`;
}
export async function cleanup() {
  const expired=await sql()`SELECT id FROM senra_ai_jobs WHERE (status='working' AND claimed_at<now()-interval '7 minutes') OR (status='pending' AND created_at<now()-interval '10 minutes')`;
  for(const row of expired)await fail(row.id);
  await sql()`DELETE FROM senra_ai_jobs WHERE created_at<now()-interval '24 hours'`;
  await sql()`DELETE FROM senra_ai_sessions WHERE touched_at<now()-interval '30 days' AND NOT EXISTS(SELECT 1 FROM senra_ai_jobs WHERE session_id=senra_ai_sessions.id)`;
}
