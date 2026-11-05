import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
fs.mkdirSync('.cache',{recursive:true});
const destination=fs.mkdtempSync(path.resolve('.cache','public-deploy-'));
for(const file of ['index.html','research.html','about.html','privacy.html','interview-prompt.txt','og.png','robots.txt','sitemap.xml','llms.txt','guests.json','jobs.json','vercel.json'])fs.copyFileSync(file,path.join(destination,file));
for(const directory of ['logos','assets','data'])fs.cpSync(directory,path.join(destination,directory),{recursive:true});
fs.mkdirSync(path.join(destination,'.vercel'));fs.copyFileSync('.vercel/project.json',path.join(destination,'.vercel/project.json'));
fs.mkdirSync(path.join(destination,'api'));
// Bundle only public API handlers. Local auth, runtime, prompts, research and job-content cache never ship.
const esbuild=require(require.resolve('esbuild',{paths:[path.join(process.env.APPDATA,'npm','node_modules','vercel')]}));
await esbuild.build({entryPoints:['api/assistant.mjs'],outfile:path.join(destination,'api','assistant.mjs'),bundle:true,platform:'node',format:'esm',target:'node22',external:['@neondatabase/serverless'],logLevel:'silent'});
const source=JSON.parse(fs.readFileSync('package.json','utf8'));fs.writeFileSync(path.join(destination,'package.json'),JSON.stringify({name:source.name,private:true,type:'module',dependencies:source.dependencies},null,2));fs.copyFileSync('package-lock.json',path.join(destination,'package-lock.json'));
const config=JSON.parse(fs.readFileSync(path.join(destination,'vercel.json')));config.buildCommand='';fs.writeFileSync(path.join(destination,'vercel.json'),JSON.stringify(config,null,2));
fs.writeFileSync('reports/assistant-deployment-artifact.txt',destination+'\n');console.log(destination);
