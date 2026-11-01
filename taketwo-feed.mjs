// Verified parent/label relationships: https://careers.take2games.com/ and
// https://www.take2games.com/labels/en-US/. Subsidiary channels remain explicit.
import {fetchNordeus} from './nordeus-feed.mjs';
export const TAKE_TWO_CHANNELS=[
 {brand:'Take-Two Interactive',slug:'taketwo',identityUrl:'https://careers.take2games.com/jobs'},
 {brand:'2K',slug:'2k',identityUrl:'https://2k.com/careers/'},
 {brand:'Rockstar Games',slug:'rockstargames',identityUrl:'https://www.rockstargames.com/careers'},
 {brand:'NaturalMotion',slug:'nmcareers',identityUrl:'https://www.naturalmotion.com/who-we-are/'},
 {brand:'Zynga',slug:'zyngacareers',identityUrl:'https://www.zynga.com/jobs/'},
 {brand:'Ghost Story Games',slug:'gsgcareers',identityUrl:'https://www.ghoststorygames.com/careers/'},
 {brand:'Small Giant Games',slug:'sggcareers',identityUrl:'https://www.smallgiantgames.com/careers/'}
];
const text=value=>{let s=String(value||'');for(let i=0;i<4;i++){const next=s.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&nbsp;/g,' ');if(next===s)break;s=next;}return s.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();};
export function parseTakeTwoChannel(data,channel,observedAt,mapJob){
 if(!Array.isArray(data?.jobs))throw Error('Expected public Greenhouse jobs array');
 const endpoint=`https://boards-api.greenhouse.io/v1/boards/${channel.slug}/jobs?content=true`,rows=[],seen=new Set();let invalid=0,duplicates=0;
 for(const j of data.jobs){let url;try{url=new URL(j?.absolute_url);}catch{}
  if(!j?.id||typeof j.title!=='string'||!j.title.trim()||!url||url.protocol!=='https:'||!['job-boards.greenhouse.io','boards.greenhouse.io'].includes(url.hostname)||!url.pathname.startsWith(`/${channel.slug}/jobs/`)){invalid++;continue;}
  if(seen.has(url.href)){duplicates++;continue;}seen.add(url.href);
  const mapped=mapJob('greenhouse',j,endpoint,observedAt,{kind:'greenhouse',slug:channel.slug});
  // Keep the standard public role fields, but not raw office/HR metadata.
  const {rawOfficeAssociations,rawLocation,...role}=mapped;
  rows.push({...role,title:text(j.title),employerBrand:channel.brand,...(Number.isSafeInteger(j.internal_job_id)?{sourceJobIdentity:`greenhouse:take-two:${j.internal_job_id}`} : {}),requisitionId:typeof j.requisition_id==='string'?j.requisition_id:'',description:text(j.content)});
 }
 const total=Number.isInteger(data.meta?.total)&&data.meta.total>=0?data.meta.total:null;
 return {rows,total,raw:data.jobs.length,invalid,duplicates,endpoint,status:invalid||duplicates||total===null||total!==rows.length?'partial':'complete'};
}
export async function fetchTakeTwo({request,observedAt,mapJob}){
 const rows=[],pageReceipts=[],channels=[],seen=new Set(),identities=new Map();let mirrored=0;
 const results=await Promise.allSettled(TAKE_TWO_CHANNELS.map(c=>request(`https://boards-api.greenhouse.io/v1/boards/${c.slug}/jobs?content=true`)));
 for(let i=0;i<TAKE_TWO_CHANNELS.length;i++){
  const c=TAKE_TWO_CHANNELS[i],result=results[i];
  if(result.status!=='fulfilled'||!result.value.ok){channels.push({...c,status:'failed',reason:result.reason?.message||result.value?.error||'Public feed unavailable'});continue;}
  try{const p=parseTakeTwoChannel(result.value.data,c,observedAt,mapJob);for(const row of p.rows){
   if(seen.has(row.url))continue;seen.add(row.url);
   // Different public postings of the same requisition are not different jobs.
   // Only merge within this verified employer group with equal ID, title and location.
   const key=row.sourceJobIdentity?JSON.stringify([row.sourceJobIdentity,row.title,row.location,row.requisitionId]):null;
   const canonical=key&&identities.get(key);
   if(canonical){canonical.alternateUrls=[...(canonical.alternateUrls||[]),row.url];mirrored++;continue;}
   if(key)identities.set(key,row);rows.push(row);
  }pageReceipts.push({url:p.endpoint,page:1,total:p.total,rows:p.rows.length,invalid:p.invalid});channels.push({...c,status:p.status,rows:p.rows.length,total:p.total,duplicates:p.duplicates});}catch(e){channels.push({...c,status:'failed',reason:e.message});}
 }
 const nordeus=await fetchNordeus({request,observedAt});
 channels.push({brand:'Nordeus',slug:'nordeus',status:nordeus.status,rows:nordeus.rows.length,identityUrl:nordeus.endpoint,reason:nordeus.reason});
 for(const row of nordeus.rows)if(!seen.has(row.url)){seen.add(row.url);rows.push(row);}
 pageReceipts.push(...nordeus.pageReceipts);
 return {rows,status:channels.some(c=>c.status!=='failed')?'partial':'failed',total:null,pages:pageReceipts.length,endpoint:'https://careers.take2games.com/jobs',observedAt,pageReceipts,channelCoverage:channels,completedPublicBoards:channels.filter(c=>c.status==='complete'&&TAKE_TWO_CHANNELS.some(t=>t.slug===c.slug)).map(c=>c.slug),mirrored,reason:`${channels.map(c=>`${c.brand}: ${c.rows??0} (${c.status})`).join('; ')}. ${mirrored} mirrored postings merged by employer job identity, title and location. These verified channels do not establish exhaustive subsidiary coverage. Gearbox's direct careers page is blocked; remaining studios and cross-channel mirrors require reconciliation.`};
}
export async function fetchNaturalMotion({request,observedAt,mapJob}){
 const c=TAKE_TWO_CHANNELS.find(c=>c.slug==='nmcareers'),endpoint=`https://boards-api.greenhouse.io/v1/boards/${c.slug}/jobs?content=true`;
 const result=await request(endpoint);if(!result.ok)return {rows:[],status:'failed',endpoint,observedAt,pages:1,reason:result.error||'Public feed unavailable'};
 try{const p=parseTakeTwoChannel(result.data,c,observedAt,mapJob);return {...p,observedAt,pages:1,pageReceipts:[{url:endpoint,page:1,total:p.total,rows:p.rows.length,invalid:p.invalid}],reason:p.status==='complete'?'Official NaturalMotion board exhausted; parent Zynga jobs are not all attributed to this founder.':'Board total, duplicates or invalid rows require review.'};}catch(e){return {rows:[],status:'failed',endpoint,observedAt,pages:1,reason:e.message};}
}
