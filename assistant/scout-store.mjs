import {neon} from '@neondatabase/serverless';
import {randomBytes,createCipheriv,createDecipheriv} from 'node:crypto';
import {cleanProfile} from './profile.mjs';
let client;
const sql=()=>client ||= neon(process.env.SENRA_DATABASE_URL);
export function storageReady(){return Boolean(process.env.SENRA_DATABASE_URL)&&Buffer.from(process.env.SENRA_PROFILE_KEY||'','base64').length===32;}
export function validateContext(value){
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!['report','provider','profile','shortlist','search'].includes(k)))return null;
  if(typeof value.report!=='string'||value.report.length>30000||!['ChatGPT','Claude','Other'].includes(value.provider))return null;
  const profile=value.profile?cleanProfile(value.profile):null;if(value.profile&&!profile)return null;
  if(!Array.isArray(value.shortlist)||value.shortlist.length>40||value.shortlist.some(u=>typeof u!=='string'||u.length>1800||!/^https:\/\//.test(u)))return null;
  const search={};if(value.search){for(const k of ['view','q','location','guest','company']){if(value.search[k]!==undefined&&(typeof value.search[k]!=='string'||value.search[k].length>300))return null;if(value.search[k])search[k]=value.search[k];}}
  const output={report:value.report,provider:value.provider,profile,shortlist:[...new Set(value.shortlist)],search};return Buffer.byteLength(JSON.stringify(output))<=100000?output:null;
}
export function encryptContext(value,owner){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',Buffer.from(process.env.SENRA_PROFILE_KEY,'base64'),iv);cipher.setAAD(Buffer.from('scout-profile-v1:'+owner));const body=Buffer.concat([cipher.update(JSON.stringify(value)),cipher.final()]);return [iv,cipher.getAuthTag(),body].map(b=>b.toString('base64url')).join('.');}
export function decryptContext(value,owner){const [iv,tag,body]=value.split('.').map(s=>Buffer.from(s,'base64url'));const cipher=createDecipheriv('aes-256-gcm',Buffer.from(process.env.SENRA_PROFILE_KEY,'base64'),iv);cipher.setAAD(Buffer.from('scout-profile-v1:'+owner));cipher.setAuthTag(tag);return JSON.parse(Buffer.concat([cipher.update(body),cipher.final()]).toString());}
export async function initializeProfiles(){await sql()`CREATE TABLE IF NOT EXISTS senra_scout_profiles (owner text PRIMARY KEY, payload text, revision integer NOT NULL DEFAULT 1, updated_at timestamptz NOT NULL DEFAULT now())`;}
export async function readContext(owner){const rows=await sql()`SELECT payload,revision,updated_at FROM senra_scout_profiles WHERE owner=${owner}`;const row=rows[0];return row?{context:row.payload?decryptContext(row.payload,owner):null,version:row.revision,updatedAt:row.updated_at}:{context:null,version:0};}
export async function writeContext(owner,value,version){
  const payload=encryptContext(value,owner);
  const rows=version===0?await sql()`INSERT INTO senra_scout_profiles(owner,payload) VALUES(${owner},${payload}) ON CONFLICT(owner) DO NOTHING RETURNING revision,updated_at`:await sql()`UPDATE senra_scout_profiles SET payload=${payload},revision=revision+1,updated_at=now() WHERE owner=${owner} AND revision=${version} RETURNING revision,updated_at`;
  return rows[0]?{version:rows[0].revision,updatedAt:rows[0].updated_at}:null;
}
export async function deleteContext(owner,version){if(version===0)return (await readContext(owner)).version===0?{version:0}:null;const rows=await sql()`UPDATE senra_scout_profiles SET payload=NULL,revision=revision+1,updated_at=now() WHERE owner=${owner} AND revision=${version} RETURNING revision`;return rows[0]?{version:rows[0].revision}:null;}
