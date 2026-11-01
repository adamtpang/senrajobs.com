import fs from 'node:fs';
import path from 'node:path';
import {parseTeslaBrowserReceipt,mergeTeslaBrowserReceipts,teslaDetailContent} from '../tesla-feed.mjs';
const directory=process.argv[2];
if(!directory)throw Error('Usage: node scripts/import-tesla-browser.mjs <observation-directory>');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const texas=read(path.join(directory,'texas-list.json')),global=read(path.join(directory,'listing-progress.json'));
if(!parseTeslaBrowserReceipt(texas).complete)throw Error('Texas subset has missing row positions');
const board=mergeTeslaBrowserReceipts([global,texas]),jobs=read('jobs.json'),cache=read('.cache/job-content.json');
const key='Tesla (Elon Musk; episode subject)',current=new Set(board.roles.map(r=>r.url));
// A partial global capture cannot invalidate earlier roles outside that capture.
if(board.coverage.status==='partial')for(const role of jobs[key]?.roles||[])if(!current.has(role.url))board.roles.push({...role,sourceStatus:'retained-previous'});
const details=read(path.join(directory,'details.json'));let collected=0;
for(const role of board.roles){const d=details[role.url];if(!d)continue;const content=teslaDetailContent(role,d);if(!cache[role.url]||Date.parse(cache[role.url].observedAt||0)<=Date.parse(content.observedAt))cache[role.url]=content;role.detailObservedAt=d.observedAt;collected++;}
board.coverage.detailCollected=collected;
board.coverage.reason+=` ${collected} matching official descriptions collected. Pay is not inferred from benefits or employer reputation.`;
jobs[key]=board;
fs.writeFileSync('jobs.json',JSON.stringify(jobs,null,2)+'\n');
fs.writeFileSync('.cache/job-content.json',JSON.stringify(cache));
fs.writeFileSync(path.join(directory,'integration.json'),JSON.stringify({at:new Date().toISOString(),coverage:board.coverage,roles:board.roles.length,retained:board.roles.filter(r=>r.sourceStatus==='retained-previous').length},null,2));
console.log(JSON.stringify({roles:board.roles.length,descriptions:collected,status:board.coverage.status}));
