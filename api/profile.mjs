import {authenticate,issuer,allowedOrigins} from '../assistant/scout-auth.mjs';
import {storageReady,validateContext,readContext,writeContext,deleteContext} from '../assistant/scout-store.mjs';
export function createProfileHandler({auth=authenticate,ready=()=>storageReady()&&!!issuer(),read=readContext,write=writeContext,remove=deleteContext}={}){return async(req,res)=>{
  for(const name of ['Cache-Control','CDN-Cache-Control','Vercel-CDN-Cache-Control'])res.setHeader(name,name==='Cache-Control'?'private, no-store':'no-store');res.setHeader('Vary','Authorization, Origin');
  const send=(status,body)=>{res.statusCode=status;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(body));};
  if(!['GET','PUT','DELETE'].includes(req.method)){res.setHeader('Allow','GET, PUT, DELETE');return send(405,{error:'Method not allowed'});}
  if((req.headers.origin&&!allowedOrigins().includes(req.headers.origin))||(req.method!=='GET'&&!allowedOrigins().includes(req.headers.origin)))return send(403,{error:'Use Scout on SenraJobs.'});
  if(!ready())return send(503,{error:'Account saving is not configured yet. Your report remains in this page.'});
  let owner;try{owner=await auth(req);}catch{return send(401,{error:'Please sign in again to access your saved context.'});}
  try{
    if(req.method==='GET')return send(200,await read(owner));
    const header=req.headers['if-match'];if(typeof header!=='string'||!/^\d{1,9}$/.test(header))return send(428,{error:'Load your saved context before updating it.'});const version=Number(header);
    if(req.method==='DELETE'){const result=await remove(owner,version);return result?send(200,{deleted:true,...result}):send(409,{error:'Your context changed in another tab. Reload before deleting.'});}
    if(!/^application\/json\b/i.test(req.headers['content-type']||''))return send(415,{error:'JSON required'});
    let body=req.body;if(body===undefined){let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>120000)return send(413,{error:'Report is too large.'});}try{body=JSON.parse(raw);}catch{return send(400,{error:'Invalid report'});}}
    if(typeof body==='string'){if(Buffer.byteLength(body)>120000)return send(413,{error:'Report is too large.'});try{body=JSON.parse(body);}catch{return send(400,{error:'Invalid report'});}}
    if(Buffer.byteLength(JSON.stringify(body))>120000)return send(413,{error:'Report is too large.'});const value=validateContext(body);if(!value)return send(400,{error:'Check your report and try again.'});
    const result=await write(owner,value,version);return result?send(200,{saved:true,...result}):send(409,{error:'A newer report was saved in another tab. Your draft is still here; reload before replacing it.'});
  }catch{return send(503,{error:'Your saved context is temporarily unavailable. Your draft remains in this page.'});}
};}
export default createProfileHandler();
