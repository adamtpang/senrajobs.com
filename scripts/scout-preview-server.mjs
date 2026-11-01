import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {loadConfig} from '../assistant/config.mjs';
import profileHandler from '../api/profile.mjs';
import assistantHandler from '../api/assistant.mjs';
import {issuer} from '../assistant/scout-auth.mjs';
import {initializeProfiles,storageReady} from '../assistant/scout-store.mjs';
loadConfig();process.env.SENRA_DEV='1';
let profileDatabaseReady=false;
if(storageReady()){try{await initializeProfiles();profileDatabaseReady=true;}catch{console.error('Profile storage unavailable; directory remains available.');}}
const root=path.resolve('.cache/vision-preview-2026-10-18');
const allowed=new Set(['index.html','app.js','scout.js','style.css','data.js','d3.min.js','land.js','agents.md','llms.txt','roles.csv']);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.md':'text/plain; charset=utf-8','.txt':'text/plain; charset=utf-8','.csv':'text/csv; charset=utf-8','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml'};
http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://127.0.0.1:4187');
    if(url.pathname==='/api/profile')return await profileHandler(req,res);
    if(url.pathname==='/api/assistant')return await assistantHandler(req,res);
    res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
    if(req.method!=='GET'){res.writeHead(405);return res.end();}
    if(url.pathname==='/auth-config.json'){const key=process.env.CLERK_PUBLISHABLE_KEY||'';res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({publishableKey:/^pk_(test|live)_[A-Za-z0-9_-]+$/.test(key)?key:'',profileSync:profileDatabaseReady&&!!issuer()}));}
    const relative=decodeURIComponent(url.pathname).slice(1)||'index.html',file=path.resolve(root,relative);
    if(!file.startsWith(root+path.sep)||(!allowed.has(relative)&&!/^logos\/[a-zA-Z0-9_.-]+$/.test(relative)&&!/^descriptions\/\d+\.json$/.test(relative))||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end('Not found');}
    res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);
  }catch{res.writeHead(503);res.end('Temporarily unavailable');}
}).listen(4187,'127.0.0.1',()=>console.log('Scout preview http://127.0.0.1:4187/'));
