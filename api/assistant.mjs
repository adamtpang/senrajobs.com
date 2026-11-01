import { randomBytes } from 'node:crypto';
import { sign,verify } from '../assistant/crypto.mjs';
import { availability,balance,enqueue,getJob,forget,cleanup } from '../assistant/store.mjs';
import { validateRequest } from '../assistant/contracts.mjs';

export default async function handler(req,res) {
  res.setHeader('Cache-Control','private, no-store');res.setHeader('CDN-Cache-Control','no-store');res.setHeader('Vercel-CDN-Cache-Control','no-store');res.setHeader('Vary','Cookie');
  const send=(status,body)=>{res.statusCode=status;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(body));};
  if(!process.env.SENRA_DATABASE_URL||!process.env.SENRA_QUEUE_KEY||!process.env.SENRA_SESSION_SECRET)return send(503,{error:'The assistant is temporarily unavailable. You can still browse every role.'});
  try {
    const cookie=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('senra_ai='))?.slice(9)||'';
    let [session,signature]=cookie.split('.');
    if(!/^[a-f0-9]{48}$/.test(session||'')||!verify(session,signature)) {
      session=randomBytes(24).toString('hex');
      res.setHeader('Set-Cookie',`senra_ai=${session}.${sign(session)}; Path=/api/assistant; HttpOnly; SameSite=Strict; Max-Age=2592000${process.env.SENRA_DEV?'':'; Secure'}`);
    }
    if(req.method==='GET') {
      const url=new URL(req.url,'https://senrajobs.com'),id=url.searchParams.get('id');
      if(id) { if(!/^[a-f0-9-]{36}$/.test(id))return send(400,{error:'Invalid request'});const job=await getJob(id,session);return send(job?200:404,job||{error:'This session has no such request.'}); }
      await cleanup();
      return send(200,{online:!!await availability(),credits:await balance(session),daily:5,welcome:12,costs:{interview:1,match:3,sage:1}});
    }
    const allowedOrigins=process.env.SENRA_DEV?['http://127.0.0.1:4173','http://localhost:4173','http://127.0.0.1:4187','http://localhost:4187']:['https://senrajobs.com','https://www.senrajobs.com'];
    if(!allowedOrigins.includes(req.headers.origin)||!/^application\/json\b/i.test(req.headers['content-type']||''))return send(403,{error:'Please use the assistant on Senra Jobs.'});
    if(req.method==='DELETE') {await forget(session);return send(200,{deleted:true});}
    if(req.method!=='POST') {res.setHeader('Allow','GET, POST, DELETE');return send(405,{error:'Method not allowed'});}
    let body=req.body;
    if(!body) {let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>65536)return send(413,{error:'Please shorten your answers.'});}try{body=JSON.parse(raw);}catch{return send(400,{error:'Invalid request'});}}
    if(typeof body==='string') {try{body=JSON.parse(body);}catch{return send(400,{error:'Invalid request'});}}
    if(Buffer.byteLength(JSON.stringify(body))>65536)return send(413,{error:'Please shorten your answers.'});
    const request=validateRequest(body);
    if(!request)return send(400,{error:'Please check your answers and try again.'});
    if(!await availability())return send(503,{error:'The assistant is temporarily unavailable. Your answers stay in this page.'});
    // Hash transport address, never retain a raw address or send it to a model.
    const address=String(req.headers['x-vercel-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].trim();
    const id=await enqueue(session,sign(`ip:${address}`),request.kind,request.payload);
    if(!id)return send(429,{error:'You have reached the beta allowance, or a request is already running. Please try again later.',credits:await balance(session)});
    return send(202,{id,credits:await balance(session)});
  } catch {return send(503,{error:'The assistant connection is unavailable. Please try again later.'});}
}
