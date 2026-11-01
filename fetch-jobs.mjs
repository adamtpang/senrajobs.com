// Public ATS refresh with explicit pagination, location provenance and coverage.
import fs from 'node:fs';
import { SOURCE_OVERRIDES,sourceIdentityMatches,requestPublic,detectSource,fetchBoard,enrichRole,retainBoard } from './ats.mjs';
import { isLocationUnknown,texasEvidence } from './location-utils.mjs';
const guests=JSON.parse(fs.readFileSync('guests.json','utf8'));
const previous=fs.existsSync('jobs.json')?JSON.parse(fs.readFileSync('jobs.json','utf8')):{};
const previousUrls=[...new Set(Object.values(previous).flatMap(board=>(board.roles||[]).map(role=>role.url)))];
const logos=JSON.parse(fs.readFileSync('company-logos.json','utf8'));
const workdayOnly=process.argv.includes('--workday-only');
const greenhouseOnly=process.argv.includes('--greenhouse-only');
const guestName=process.argv.find(arg=>arg.startsWith('--guest='))?.slice('--guest='.length);
const companyName=process.argv.find(arg=>arg.startsWith('--company='))?.slice('--company='.length);
if(companyName&&guestName)throw new Error('Choose --company or --guest, not both');
if(companyName&&!guests.some(g=>g.companies.some(c=>c.name===companyName&&c.note!=='acquired or closed')))throw new Error(`Unknown current company: ${companyName}`);
const selectedGuest=guestName?guests.find(guest=>guest.name===guestName):null;
if(guestName&&!selectedGuest)throw new Error(`Unknown guest: ${guestName}`);
const guestCompanies=companyName?new Set([companyName]):selectedGuest?new Set(selectedGuest.companies.filter(company=>company.note!=='acquired or closed').map(company=>company.name)):null;
const jobs=workdayOnly||greenhouseOnly||guestCompanies?{...previous}:{},tasks=new Map(),shared=new Map();
// Requirements text supports private matching; public jobs.json carries listing metadata.
const contentPath='.cache/job-content.json';
const content=fs.existsSync(contentPath)?JSON.parse(fs.readFileSync(contentPath,'utf8')):{};
for(const guest of guests)for(const company of guest.companies)if(company.note!=='acquired or closed')tasks.set(company.name,company);
async function pool(items,limit,action){let index=0;await Promise.all(Array.from({length:Math.min(limit,items.length)},async()=>{while(index<items.length){const i=index++;await action(items[i],i);}}));}
async function refresh(company){
 const observedAt=new Date().toISOString();const name=company.name.split(' (')[0];let careers=company.careers,src=SOURCE_OVERRIDES[company.name],detection;
 if(!careers){
  const domain=logos[name]?.domain;
  if(domain)for(const path of ['/careers','/jobs']){
   const candidate=`https://${domain}${path}`;const result=await detectSource(candidate);
   if(result.source&&sourceIdentityMatches(result.source,company.name)){detection=result;careers=candidate;break;}
  }
  if(!careers)return {source:'research',sourceUrl:domain?`https://${domain}`:null,fetched:null,roles:[],coverage:{status:'link-only',listingStatus:'link-only',reason:domain?'No supported ATS found during bounded official-site discovery':'No verified careers URL or official domain in research',lastAttempt:observedAt}};
 }
 if(!src){detection ||= await detectSource(careers);src=detection.source;}
 if(!src && previous[company.name]?.source && previous[company.name].source!=='research') {
  const [kind,...slug]=previous[company.name].source.split(':');
  const known={kind,slug:slug.join(':')};if(sourceIdentityMatches(known,company.name))src=known;
 }
 if(src&&!sourceIdentityMatches(src,company.name))return {roles:[],fetched:null,sourceUrl:careers,coverage:{status:'link-only',listingStatus:'link-only',reason:`Discovered ATS account ${src.slug} does not match this employer; portfolio jobs excluded`,lastAttempt:observedAt}};
 if(!src){
  if(previous[company.name] && (previous[company.name].roles?.length || detection?.failed))return {...retainBoard(previous[company.name],{status:'failed',reason:detection?.error||'ATS discovery failed'},observedAt),sourceUrl:careers};
  return {fetched:null,roles:[],sourceUrl:careers,coverage:{status:detection?.failed?'failed':'link-only',listingStatus:detection?.failed?'failed':'link-only',reason:detection?.error||'No supported public ATS',lastAttempt:observedAt}};
 }
 const key=`${src.kind}:${src.slug}`;
 if(!shared.has(key))shared.set(key,(async()=>{
  const result=await fetchBoard(src,{observedAt,preferredUrls:previousUrls});result.source=key;
  if(result.status==='failed')return result;
  const candidates=result.rows.filter(role=>isLocationUnknown(role)||/^\d+ locations?$/i.test(role.location)||role.locations?.some(location=>/^\d+ locations?$/i.test(location.raw))||(src.kind==='greenhouse'&&texasEvidence(role).length));
  const selected=candidates.slice(0,75);
  const enriched=new Map();await pool(selected,5,async role=>enriched.set(role.url,await enrichRole(role,src,{observedAt})));
  result.rows=result.rows.map(role=>enriched.get(role.url)||role);
  result.enrichment={eligible:candidates.length,attempted:selected.length,unattempted:Math.max(0,candidates.length-selected.length),limitPerBoard:75};
  return result;
 })());
 const result=await shared.get(key);
 const publicRows=result.rows.map(({description,...row})=>{if(description)content[row.url]={text:description,closed:false,observedAt,source:row.sourceUrl||result.endpoint};return row;});
 const board=retainBoard(previous[company.name],{...result,rows:publicRows},observedAt);
 board.careersUrl=careers;
 const missing=board.roles.filter(isLocationUnknown).length;
 board.coverage={...board.coverage,...(result.listingStatus?{listingStatus:result.listingStatus}:{}),...(result.excluded?{excluded:result.excluded}:{}),identityUrl:src.identityUrl||careers,...(src.scope?{scope:src.scope}:{}),unknownLocations:missing,enrichment:result.enrichment};
 if(result.status==='complete'&&missing){board.coverage.status='partial';board.coverage.reason=`All advertised listings retrieved; ${missing} job locations remain unresolved after bounded detail retrieval`;}
 return board;
}
const selectedTasks=[...tasks.values()].filter(company=>(!guestCompanies||guestCompanies.has(company.name)) && (!workdayOnly || previous[company.name]?.source?.startsWith('workday:')) && (!greenhouseOnly || previous[company.name]?.source?.startsWith('greenhouse:')));
await pool(selectedTasks,4,async company=>{jobs[company.name]=await refresh(company);const board=jobs[company.name];console.log(`${company.name}: ${board.roles.length} roles; ${board.coverage.status}${board.coverage.total!=null?`; advertised ${board.coverage.total}`:''}; ${board.coverage.reason||'public listing retrieved'}`);});
// Preserve closed-company history in data, but never expose it as current hiring.
for(const [name,board]of Object.entries(previous))if(!tasks.has(name))jobs[name]=board;
fs.writeFileSync('jobs.json',JSON.stringify(jobs,null,1)+'\n');
fs.mkdirSync('.cache',{recursive:true});fs.writeFileSync(contentPath,JSON.stringify(content));
// Existing portraits are retained on lookup failure. No candidate or private data is read.
const feed=await requestPublic('https://itunes.apple.com/lookup?id=1836497887&entity=podcastEpisode&limit=200');
const byId=Object.fromEntries((feed.data?.results||[]).filter(x=>x.trackId).map(x=>[String(x.trackId),x.artworkUrl600]));
const photos=fs.existsSync('photos.json')?JSON.parse(fs.readFileSync('photos.json','utf8')):{};
for(const guest of guests){const id=guest.episode?.url?.match(/[?&]i=(\d+)/)?.[1];if(id&&byId[id])photos[guest.name]=byId[id].replace('600x600bb','300x300bb');}
fs.writeFileSync('photos.json',JSON.stringify(photos,null,1)+'\n');
console.log(`Screened ${selectedTasks.length} current company associations; ${shared.size} unique ATS feeds. Run node build.mjs for inventory and coverage reports.`);
