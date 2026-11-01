import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { loadConfig } from '../assistant/config.mjs';
import { initialize } from '../assistant/store.mjs';

if(!fs.existsSync('.env.worker.local')) {
  const source=fs.readFileSync(path.resolve('../skill.supply/.env.local'),'utf8');
  const match=source.match(/^DATABASE_URL\s*=\s*(.*)$/m);
  if(!match)throw new Error('Existing queue database configuration missing');
  const database=match[1].trim().replace(/^(["'])(.*)\1$/,'$2');
  fs.writeFileSync('.env.worker.local',JSON.stringify({SENRA_DATABASE_URL:database,SENRA_QUEUE_KEY:randomBytes(32).toString('base64'),SENRA_SESSION_SECRET:randomBytes(48).toString('base64url'),SENRA_LOCAL_PROVIDERS:'claude_local,codex_local'},null,2),{mode:0o600});
}
loadConfig();await initialize();console.log('Isolated Senra queue schema ready. Credentials kept in the ignored local configuration.');
if(process.argv.includes('--production')) {
  for(const name of ['SENRA_DATABASE_URL','SENRA_QUEUE_KEY','SENRA_SESSION_SECRET']) {
    await new Promise((resolve,reject)=>{
      const child=spawn(process.execPath,[path.join(process.env.APPDATA,'npm','node_modules','vercel','dist','index.js'),'env','add',name,'production','--sensitive','--yes','--scope','adamtpangs-projects'],{cwd:process.cwd(),windowsHide:true,stdio:['pipe','pipe','pipe']});
      let out='';child.stdout.on('data',x=>out+=x);child.stderr.on('data',x=>out+=x);child.on('error',reject);child.on('close',code=>code===0?resolve():reject(new Error(`Could not configure ${name}. ${out.replaceAll(process.env[name],'[redacted]').slice(-1000)}`)));child.stdin.end(process.env[name]+'\n');
    });console.log(`${name}: configured as sensitive in Production`);
  }
}
