import { sign } from '../assistant/crypto.mjs';
import { saveFeedback } from '../feedback/store.mjs';

export default async function handler(req,res) {
  for(const name of ['Cache-Control','CDN-Cache-Control','Vercel-CDN-Cache-Control'])res.setHeader(name,'no-store');
  const send=(status,body)=>{res.statusCode=status;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(body));};
  if(req.method!=='POST'){res.setHeader('Allow','POST');return send(405,{error:'Method not allowed'});}
  const origins=process.env.SENRA_DEV?['http://127.0.0.1:4173','http://localhost:4173']:['https://senrajobs.com','https://www.senrajobs.com'];
  if(!origins.includes(req.headers.origin)||!/^application\/json\b/i.test(req.headers['content-type']||''))return send(403,{error:'Please use the feedback form on SenraJobs.'});
  if(!process.env.SENRA_DATABASE_URL||!process.env.SENRA_QUEUE_KEY||!process.env.SENRA_SESSION_SECRET)return send(503,{error:'Feedback is unavailable. Please try again later.'});
  try {
    let body=req.body;
    if(!body){let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>12288)return send(413,{error:'Please keep feedback under 2,000 characters.'});}body=JSON.parse(raw);}
    if(typeof body==='string')body=JSON.parse(body);
    if(!body||typeof body!=='object'||Buffer.byteLength(JSON.stringify(body))>12288)return send(400,{error:'Please check your feedback.'});
    if(body.website)return send(200,{ok:true});
    const message=typeof body.message==='string'?body.message.trim():'';
    if(!message||message.length>2000||! /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(body.id||''))return send(400,{error:'Enter feedback of up to 2,000 characters.'});
    const address=String(req.headers['x-vercel-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].trim();
    const saved=await saveFeedback(body.id.toLowerCase(),sign(`feedback:${address}`),message);
    return send(saved?200:429,saved?{ok:true}:{error:'Please wait before sending more feedback.'});
  }catch(error){return send(error instanceof SyntaxError?400:503,{error:error instanceof SyntaxError?'Please check your feedback.':'Could not save feedback. Please try again.'});}
}
