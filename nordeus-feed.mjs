export const NORDEUS_CAREERS='https://nordeus.com/open-positions/';
const plain=s=>String(s||'').replace(/<!--[\s\S]*?-->/g,'').replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/&nbsp;/g,' ').replace(/&#0?39;|&apos;/g,"'").replace(/&quot;/g,'"').replace(/\s+/g,' ').trim();
export function parseNordeusListing(html){
 if(!/class="position__tabs-content"/.test(html))throw Error('Nordeus listing structure changed');
 const rows=[],seen=new Map();let generalPrograms=0;
 for(const m of html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*class="position__item"[^>]*>([\s\S]*?)<\/a>/g)){
  const u=new URL(m[1].replace(/&amp;/g,'&'),NORDEUS_CAREERS),id=u.pathname.match(/^\/open-positions\/[^/]+\/(\d+)\/?$/)?.[1],title=plain(m[2].match(/<h4\b[^>]*>([\s\S]*?)<\/h4>/)?.[1]);
  if(u.origin!=='https://nordeus.com'||!id||!title)throw Error('Invalid Nordeus job card');
  if(seen.has(id)){if(seen.get(id)!==title)throw Error('Conflicting Nordeus titles');continue;}seen.set(id,title);
  if(title==='Early Talent Program'){generalPrograms++;continue;}
  rows.push({id,title,url:u.href.replace(/\/$/,'')+'/',department:decodeURIComponent(u.pathname.split('/')[2]).replace(/_/g,' ')});
 }
 if(!seen.size)throw Error('No recognizable Nordeus cards; zero vacancies not established');
 return {rows,generalPrograms,uniqueCards:seen.size};
}
export function parseNordeusDetail(html,card,observedAt){
 const title=plain(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/)?.[1]);
 const id=html.match(/id="input_job_id"[^>]*>\s*(\d+)\s*</)?.[1];
 const body=html.match(/<h1\b[^>]*>[\s\S]*?<\/h1>([\s\S]*?)<div[^>]*id="input_job_id"/i)?.[1];
 const description=plain(body);
 if(title!==card.title||id!==card.id||description.length<100)throw Error('Nordeus detail identity or description mismatch');
 // Extract only a location statement in this job, never the global site footer.
 const location=/\b(?:based|position|role|office)\b[^.]{0,70}\b(?:in )?Belgrade\b/i.test(description)?'Belgrade':'';
 return {...card,employerBrand:'Nordeus',description,location,locations:location?[{raw:location,city:location,state:'',country:'',sourceUrl:card.url,observedAt,source:'employer-job-description',confidence:'published'}]:[],locationStatus:location?'published':'unknown',workplace:/hybrid/i.test(description)?'Hybrid':'',sourceUrl:card.url,observedAt,sourceStatus:'current',sourceJobIdentity:`nordeus:${card.id}`};
}
export async function fetchNordeus({request,observedAt}){
 const pageReceipts=[],rows=[],failures=[];
 try{const list=await request(NORDEUS_CAREERS);if(!list.ok)throw Error(list.error||'Listing unavailable');
  const p=parseNordeusListing(list.text);pageReceipts.push({url:NORDEUS_CAREERS,observedAt,uniqueCards:p.uniqueCards,roles:p.rows.length,generalPrograms:p.generalPrograms});
  let index=0;await Promise.all(Array.from({length:3},async()=>{while(index<p.rows.length){const card=p.rows[index++];try{const d=await request(card.url);if(!d.ok)throw Error(d.error||'Detail unavailable');rows.push(parseNordeusDetail(d.text,card,observedAt));pageReceipts.push({url:card.url,observedAt,identityMatched:true});}catch(e){failures.push({url:card.url,error:e.message});rows.push({...card,employerBrand:'Nordeus',location:'',locations:[],locationStatus:'unknown',sourceUrl:NORDEUS_CAREERS,observedAt,sourceStatus:'current'});}}}));
  rows.sort((a,b)=>a.url.localeCompare(b.url));
  return {rows,status:'partial',pages:1,total:null,endpoint:NORDEUS_CAREERS,observedAt,pageReceipts,failures,reason:`${p.rows.length} unique advertised roles; ${p.generalPrograms} general talent-program card excluded. ${rows.filter(r=>r.description).length} matching descriptions collected. No independently advertised total or pagination contract; other channels unverified.`};
 }catch(e){return {rows:[],status:'failed',pages:0,total:null,endpoint:NORDEUS_CAREERS,observedAt,pageReceipts,reason:e.message};}
}
