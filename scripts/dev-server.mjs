import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from '../assistant/config.mjs';
import handler from '../api/assistant.mjs';
loadConfig();process.env.SENRA_DEV='1';
const root=process.cwd(),port=Number(process.env.PORT||4173);
const files=new Set(['index.html','research.html','about.html','privacy.html','interview-prompt.txt','robots.txt','sitemap.xml','llms.txt','og.png','guests.json','jobs.json']);
const mime={'.html':'text/html; charset=utf-8','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.webp':'image/webp','.js':'text/javascript','.xml':'application/xml','.txt':'text/plain'};
http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/api/assistant')return handler(req,res);
  let relative;try{relative=decodeURIComponent(url.pathname).replace(/^\//,'')||'index.html';}catch{res.writeHead(400);return res.end();}
  if(relative.split('/').some(part=>part==='..'||part.startsWith('.'))){res.writeHead(404);return res.end('Not found');}
  const resolved=path.resolve(root,relative);
  if(!resolved.startsWith(root+path.sep)||(!files.has(relative)&&!/^\b(?:assets|logos|data)\/[a-zA-Z0-9_./ -]+$/.test(relative))||!fs.existsSync(resolved)||!fs.statSync(resolved).isFile()){res.writeHead(404);return res.end('Not found');}
  res.writeHead(200,{'Content-Type':mime[path.extname(resolved)]||'application/octet-stream','Cache-Control':'no-store'});fs.createReadStream(resolved).pipe(res);
}).listen(port,'127.0.0.1',()=>console.log(`Senra Jobs: http://127.0.0.1:${port}/`));
