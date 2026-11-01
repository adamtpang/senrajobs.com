// Private description enrichment; sources come only from the current public catalog.
import fs from 'node:fs';
import {compileRoles} from '../board-data.mjs';
import {requestPublic,structuredJob} from '../ats.mjs';
import {plain} from '../assistant/content.mjs';
import {employerDescription,employerDetailUrl} from '../assistant/employer-content.mjs';
import {priority} from '../assistant/batch-fit.mjs';
const option=(key,fallback)=>process.argv.find(x=>x.startsWith(`--${key}=`))?.slice(key.length+3)??fallback;
const limit=Number(option('limit','100')),company=option('company','');
if(!Number.isSafeInteger(limit)||limit<1||limit>500)throw Error('Limit must be 1–500');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const cachePath='.cache/job-content.json',cache=read(cachePath);
const roles=compileRoles(read('guests.json'),read('jobs.json'));
if(company&&!roles.some(r=>r.company===company))throw Error('Company must exactly match the current catalog');
const selected=roles.filter(r=>(!company||r.company===company)&&!cache[r.url]?.closed&&!(cache[r.url]?.text?.length>80)).sort((a,b)=>priority(a)-priority(b)||a.url.localeCompare(b.url)).slice(0,limit);
const startedAt=new Date().toISOString(),directory=`.cache/requirements-${startedAt.slice(0,10)}`,out=`${directory}/collection-${startedAt.replace(/[:.]/g,'-')}.json`;
fs.mkdirSync(directory,{recursive:true});
const updates={},receipts=[];let cursor=0;
const timestamp=r=>Math.max(Date.parse(r?.observedAt||'')||0,Date.parse(r?.lastAttempt||'')||0);
function save(){
  const latest=read(cachePath);
  for(const [url,row]of Object.entries(updates))if(timestamp(row)>timestamp(latest[url]))latest[url]=row;
  const temp=cachePath+`.${process.pid}.tmp`;fs.writeFileSync(temp,JSON.stringify(latest));fs.renameSync(temp,cachePath);
  fs.writeFileSync(out,JSON.stringify({startedAt,updatedAt:new Date().toISOString(),company:company||'all',catalogRoles:roles.length,selected:selected.length,processed:receipts.length,collected:receipts.filter(r=>r.characters>80).length,receipts},null,2));
}
await Promise.all(Array.from({length:2},async()=>{while(cursor<selected.length){
  const role=selected[cursor++];let url=employerDetailUrl(role)||role.detailApi||role.url;
  if(role.sourceUrl?.includes('boards-api.greenhouse.io'))url=role.sourceUrl.split('/jobs')[0]+`/jobs/${encodeURIComponent(role.id)}`;
  const result=await requestPublic(url),at=new Date().toISOString();let text='',extraction='',error='';
  if(result.ok)try{
    const custom=employerDescription(role,result.text||'',result.data),job=structuredJob(result.text||'').find(j=>j.title?.trim().toLowerCase()===role.title.trim().toLowerCase());
    text=plain(plain(custom?.description||result.data?.jobPostingInfo?.jobDescription||result.data?.content||result.data?.descriptionPlain||result.data?.descriptionHtml||job?.description));
    extraction=custom?.extraction||'public-structured-description';
  }catch(e){error=e.message;}
  // A failed route or parser is not evidence that the vacancy is closed.
  if(text.length>80)updates[role.url]={text,closed:false,observedAt:at,lastAttempt:at,source:url,extraction};
  else updates[role.url]={...cache[role.url],text:cache[role.url]?.text||'',lastAttempt:at,source:url,detailStatus:result.status||'failed',detailError:error||result.error||'No matching public description'};
  receipts.push({url:role.url,title:role.title,source:url,at,status:result.status||null,characters:text.length,extraction,error:error||result.error||null});
  if(receipts.length%10===0){save();console.log(`${receipts.length}/${selected.length}: ${receipts.filter(r=>r.characters>80).length} descriptions`);}
}}));save();console.log(JSON.stringify({receipt:out,selected:selected.length,collected:receipts.filter(r=>r.characters>80).length}));
