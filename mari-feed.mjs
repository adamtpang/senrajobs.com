import {normalizePay,leverPay} from './job-utils.mjs';
const plain=s=>String(s||'').replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/&nbsp;/g,' ').replace(/&quot;/g,'"').replace(/&#(\d+);/g,(_,n)=>Number(n)<=0x10ffff?String.fromCodePoint(Number(n)):'').replace(/\s+/g,' ').trim();
const rec=(raw,country,sourceUrl,observedAt)=>({raw,country,sourceUrl,observedAt,source:'employer-public-feed',confidence:'published'});
export function parseMariAds(data,observedAt){
 if(!Array.isArray(data?.jobAdDetails))throw Error('Public jobAdDetails missing');
 const endpoint='https://mari.careers.hibob.com/api/job-ad',rows=[];let invalid=0;
 for(const j of data.jobAdDetails){
  if(!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(j.id||'')||!j.title){invalid++;continue;}
  const location=j.site||j.country||'',period={annually:'year',annual:'year',yearly:'year',monthly:'month',hourly:'hour'}[String(j.payTransparencySalaryPayPeriod||'').toLowerCase()]||String(j.payTransparencySalaryPayPeriod||'').toLowerCase();
  rows.push({id:j.id,title:plain(j.title),url:`https://mari.careers.hibob.com/jobs/${j.id}`,location,locations:location?[rec(location,j.country||'',endpoint,observedAt)]:[],locationStatus:location?'published':'unknown',locationSource:'employer-public-feed',locationPrecision:'Employer site label and country; city may require description review',department:j.department||'',employmentType:j.employmentType||'',workplace:{hybrid:'Hybrid',on_site:'OnSite',remote:'Remote'}[j.workspaceTypeId]||'',pay:normalizePay({min:j.payTransparencyMinSalary,max:j.payTransparencyMaxSalary,currency:j.payTransparencySalaryCurrency,period}),publishedAt:j.publishedAt||'',sourceUrl:endpoint,sourceStatus:'current',observedAt,employerBrand:'MARI',description:plain([j.description,j.requirements,j.responsibilities,j.benefits].filter(Boolean).join(' '))});
 }
 return {rows,rawCount:data.jobAdDetails.length,invalid,endpoint};
}
export function parseTodayTix(data,observedAt){
 if(!Array.isArray(data)||data.some(g=>!Array.isArray(g.postings)))throw Error('Public TodayTix grouped postings missing');
 const endpoint='https://www.todaytixgroup.com/api/open-roles',rows=[],seen=new Set();let invalid=0,duplicates=0,rawCount=0;
 for(const group of data)for(const j of group.postings){
  rawCount++;let url;try{url=new URL(j.hostedUrl);}catch{}
  if(!j.id||!j.text||!url||url.protocol!=='https:'||url.hostname!=='jobs.lever.co'||!url.pathname.startsWith('/todaytixgroup/')){invalid++;continue;}
  if(seen.has(url.href)){duplicates++;continue;}seen.add(url.href);
  const location=j.categories?.location||'',secondary=Array.isArray(j.categories?.allLocations)?j.categories.allLocations.filter(x=>typeof x==='string'&&x!==location):[];
  rows.push({id:String(j.id),title:plain(j.text),url:url.href,location,secondaryLocations:secondary,locations:[...(location?[rec(location,j.country||'',endpoint,observedAt)]:[]),...secondary.map(raw=>rec(raw,'',endpoint,observedAt))],locationStatus:location?'published':'unknown',locationSource:'employer-public-feed',department:['TodayTix Group',j.categories?.department||group.title].filter(Boolean).join(' / '),employmentType:j.categories?.commitment||'',workplace:j.workplaceType||'',pay:leverPay(j.salaryRange),publishedAt:Number.isFinite(j.createdAt)?new Date(j.createdAt).toISOString():'',sourceUrl:endpoint,sourceStatus:'current',observedAt,employerBrand:'TodayTix Group',description:plain([j.openingPlain||j.opening,j.descriptionPlain||j.description,j.descriptionBodyPlain||j.descriptionBody,...(j.lists||[]).map(x=>x.content),j.additionalPlain||j.additional].filter(Boolean).join(' '))});
 }
 return {rows,rawCount,invalid,duplicates,endpoint};
}
export async function fetchMari({request,observedAt}){
 const sources=[['MARI','https://mari.careers.hibob.com/api/job-ad',parseMariAds,{headers:{companyIdentifier:'mari'}}],['TodayTix Group','https://www.todaytixgroup.com/api/open-roles',parseTodayTix,{}]];
 const results=await Promise.allSettled(sources.map(([,url,,options])=>request(url,options)));
 const rows=[],pageReceipts=[],channels=[];
 for(let i=0;i<sources.length;i++){
  const [name,url,parse]=sources[i],settled=results[i];
  if(settled.status!=='fulfilled'||!settled.value.ok){channels.push({name,status:'failed',reason:settled.reason?.message||settled.value?.error||'Public feed unavailable'});continue;}
  try{const parsed=parse(settled.value.data,observedAt);rows.push(...parsed.rows);pageReceipts.push({url,page:1,rows:parsed.rows.length,invalid:parsed.invalid});channels.push({name,status:parsed.invalid?'partial':'complete',rows:parsed.rows.length,raw:parsed.rawCount,duplicates:parsed.duplicates||0});}catch(e){channels.push({name,status:'failed',reason:e.message});}
 }
 return {rows,status:channels.some(c=>c.status!=='failed')?'partial':'failed',reason:`${channels.map(c=>`${c.name}: ${c.rows??0} (${c.status})`).join('; ')}. Public payloads exhausted; other portfolio hiring channels and city-level site detail remain unreconciled.`,total:null,pages:pageReceipts.length,endpoint:sources[0][1],observedAt,pageReceipts,channelCoverage:channels};
}
