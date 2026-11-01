import {neon} from '@neondatabase/serverless';
import {loadConfig} from '../assistant/config.mjs';
import {decrypt} from '../assistant/crypto.mjs';
loadConfig();
const sql=neon(process.env.SENRA_DATABASE_URL);
const rows=await sql`SELECT id,message,created_at FROM senra_feedback ORDER BY created_at DESC LIMIT 100`;
console.log(JSON.stringify(rows.map(row=>({id:row.id,createdAt:row.created_at,message:decrypt(row.message,row.id).message})),null,2));
