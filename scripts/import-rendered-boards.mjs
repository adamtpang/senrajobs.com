// Reproduce the validated manual Revolut/QuantumLight import from saved public observations.
// No browser scraping, candidate data, credentials, or deployment here.
import fs from 'node:fs';
import path from 'node:path';
import {parseRevolutBrowserList, enrichRevolutDetails} from '../revolut-feed.mjs';
import {enrichQuantumLightDetails} from '../quantumlight-feed.mjs';
const dir=process.argv[2];
if(!dir)throw Error('Usage: node scripts/import-rendered-boards.mjs <observation-directory>');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const jobs=read('jobs.json'),cache=read('.cache/job-content.json');
const quantumList=read(path.join(dir,'quantumlight-list.json'));
const quantumRoles=jobs['QuantumLight (founder)'].roles;
const quantumTotal=Number(quantumList.heading?.match(/^We have (\d+) open positions$/)?.[1]);
if(quantumList.source!=='https://revolutpeople.com/quantum-light/public/careers'||!Number.isFinite(Date.parse(quantumList.observedAt))||quantumTotal!==quantumRoles.length||quantumList.links?.length!==quantumTotal||new Set(quantumList.links.map(r=>r.url)).size!==quantumTotal||quantumRoles.some(r=>!quantumList.links.some(l=>l.url===r.url&&l.text.split('\n')[0]===r.title)))throw Error('QuantumLight listing receipt does not match the catalog');
const results={
  'Revolut (co-founder and CEO)':enrichRevolutDetails(parseRevolutBrowserList(read(path.join(dir,'public-list.json'))),read(path.join(dir,'details.json'))),
  'QuantumLight (founder)':enrichQuantumLightDetails(jobs['QuantumLight (founder)'],read(path.join(dir,'quantumlight-details.json')))
};
// Refuse partial imports; keep the existing catalog intact when validation fails.
for(const [name,result] of Object.entries(results))if(result.failures.length||result.board.coverage.status!=='complete')throw Error(`${name}: ${JSON.stringify(result.failures)}; ${result.board.coverage.reason}`);
const receipt={at:new Date().toISOString(),sourceDirectory:path.resolve(dir),companies:{}};
for(const [name,result] of Object.entries(results)){
  jobs[name]=result.board;
  for(const [url,d] of Object.entries(result.content))if(!cache[url]||Date.parse(cache[url].observedAt||0)<=Date.parse(d.observedAt))cache[url]=d;
  receipt.companies[name]={coverage:result.board.coverage,rolesWithPay:result.board.roles.filter(r=>r.pay||r.payRanges?.length).length};
}
fs.writeFileSync('jobs.json',JSON.stringify(jobs,null,2)+'\n');
fs.writeFileSync('.cache/job-content.json',JSON.stringify(cache));
fs.writeFileSync(path.join(dir,'import-receipt.json'),JSON.stringify(receipt,null,2));
console.log(JSON.stringify(receipt,null,2));
