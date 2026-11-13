// Flexjet group careers: one public Phenom People site serves every group brand.
// The search page embeds its result set as JSON ("eagerLoadRefineSearch"), ten per page.
// The list payload carries no brand field today, so brand stays unspecified unless the
// feed itself adds one. Technical Services is scoped only by the feed's own category
// plus the published title naming that division, the same way the earlier reviewed rows were.
export const FLEXJET_CAREERS='https://careers.flexjet.com/us/en';
export const FLEXJET_SEARCH=`${FLEXJET_CAREERS}/search-results`;
export const FLEXJET_TECHNICAL_CATEGORY='Aircraft Maintenance and Support';
export const FLEXJET_UNSPECIFIED='Flexjet group (brand unspecified)';
const TECHNICAL_TITLE=/\bFlexjet Technical Services\b/i;
const BRAND_FIELDS=['brand','brandName','company','companyName','employerBrand','businessUnit'];
const text=v=>typeof v==='string'?v.trim():'';
// Phenom job paths are /job/<jobId>/<title with every non-alphanumeric run turned into one hyphen>.
export const flexjetJobUrl=(id,title)=>`${FLEXJET_CAREERS}/job/${id}/${title.replace(/[^A-Za-z0-9]+/g,'-').replace(/^-+|-+$/g,'')}`;
export const isFlexjetTechnical=row=>row.department===FLEXJET_TECHNICAL_CATEGORY&&TECHNICAL_TITLE.test(row.title);
function embedded(html){
 const key=String(html||'').indexOf('"eagerLoadRefineSearch"');if(key<0)throw Error('Public search payload missing');
 const start=html.indexOf('{',key);if(start<0)throw Error('Public search payload missing');
 let depth=0,quoted=false,escaped=false;
 for(let i=start;i<html.length;i++){
  const c=html[i];
  if(quoted){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')quoted=false;}
  else if(c==='"')quoted=true;else if(c==='{')depth++;else if(c==='}'&&--depth===0){try{return JSON.parse(html.slice(start,i+1));}catch{throw Error('Public search payload unreadable');}}
 }
 throw Error('Public search payload truncated');
}
export function parseFlexjetPage(html,observedAt){
 const payload=embedded(html),jobs=payload?.data?.jobs;
 if(!Array.isArray(jobs)||!Number.isInteger(payload.totalHits)||payload.totalHits<0)throw Error('Public jobs array or advertised total missing');
 const rows=[],seen=new Set();let invalid=0,duplicates=0;
 for(const job of jobs){
  const id=text(job?.jobId),title=text(job?.title);
  if(!/^[A-Za-z0-9_-]+$/.test(id)||!title){invalid++;continue;}
  if(seen.has(id)){duplicates++;continue;}seen.add(id);
  const raws=[text(job.location),...(Array.isArray(job.multi_location)?job.multi_location.map(text):[])].filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i);
  const brand=BRAND_FIELDS.map(k=>text(job[k])).find(Boolean);
  const apply=text(job.applyUrl).match(/^https?:\/\/flexjet\.clearcompany\.com\/careers\/jobs\/([a-f0-9-]{36})\/apply$/i);
  // The same posting also answers at its Phenom sequence id. Declaring that form lets
  // retainBoard treat an earlier row stored under it as superseded instead of a second role.
  const seq=text(job.jobSeqNo),alternate=/^[A-Za-z0-9]+$/.test(seq)&&seq!==id?[flexjetJobUrl(seq,title)]:[];
  rows.push({id,title,url:flexjetJobUrl(id,title),...(alternate.length?{alternateUrls:alternate}:{}),location:raws[0]||'',secondaryLocations:raws.slice(1),locations:raws.map(raw=>({raw,sourceUrl:FLEXJET_SEARCH,observedAt,source:'employer-public-feed',confidence:'published'})),locationStatus:raws.length?'published':'unknown',locationSource:'employer-public-feed',department:text(job.category),employmentType:text(job.type),workplace:'',publishedAt:text(job.postedDate),sourceUrl:FLEXJET_SEARCH,sourceStatus:'current',observedAt,employerBrand:brand||FLEXJET_UNSPECIFIED,...(apply?{sourceJobIdentity:`clearcompany:${apply[1].toLowerCase()}`,sourceApplyUrl:`https://flexjet.clearcompany.com/careers/jobs/${apply[1].toLowerCase()}/apply`}:{})});
 }
 const facet=payload.data.aggregations?.find?.(a=>a?.field==='category')?.value;
 return {rows,total:payload.totalHits,raw:jobs.length,invalid,duplicates,categories:facet&&typeof facet==='object'?facet:{}};
}
const pageUrl=(from,category)=>`${FLEXJET_SEARCH}?${category?`category=${encodeURIComponent(category)}&`:''}sortBy=Most%20recent${from?`&from=${from}`:''}`;
export async function fetchFlexjet(source,{request,observedAt,maxPages=60,delayMs=350}){
 const failed=reason=>({rows:[],status:'failed',reason,total:null,pages:0,endpoint:FLEXJET_SEARCH,observedAt,pageReceipts:[]});
 if(!['flexjet','flexjet-technical'].includes(source?.slug))return failed('Unknown Flexjet source slug');
 const byId=new Map(),pageReceipts=[];let total=null,pages=0,invalid=0,duplicates=0,categories={},failures=0,stop='';
 // Walks one result listing. Returns nothing; all state lands in byId and pageReceipts.
 const walk=async category=>{
  let expected=null,size=10,streak=0;
  for(let from=0;expected==null||from<expected;from+=size){
   if(pages>=maxPages){stop=`page limit ${maxPages} reached`;return;}
   if(pages&&delayMs)await new Promise(r=>setTimeout(r,delayMs));
   const url=pageUrl(from,category);pages++;
   const result=await request(url);let page;
   try{if(!result?.ok)throw Error(result?.error||'Public search page unavailable');page=parseFlexjetPage(result.text,observedAt);}
   catch(e){failures++;pageReceipts.push({url,offset:from,status:'failed',reason:e.message,total:expected,rows:0,...(category?{appliedFacets:{category}}:{})});if(expected==null||++streak>=3)return;continue;}
   streak=0;expected=page.total;if(!category){total=page.total;if(Object.keys(page.categories).length)categories=page.categories;}
   invalid+=page.invalid;duplicates+=page.duplicates;let fresh=0;
   for(const row of page.rows){if(byId.has(row.id))duplicates++;else{byId.set(row.id,row);fresh++;}}
   pageReceipts.push({url,offset:from,status:'observed',total:page.total,rows:fresh,invalid:page.invalid,...(category?{appliedFacets:{category}}:{})});
   if(!page.raw)return;if(from===0)size=Math.max(page.raw,1);
  }
 };
 await walk('');
 if(total==null)return {...failed(pageReceipts[0]?.reason||'Public search page unavailable'),pages,pageReceipts};
 // The board's ordering is not fully stable between requests, so one pass can repeat some
 // roles and miss others. Reconcile against the feed's own per-category counts.
 for(let round=0;round<3&&byId.size<total&&!stop;round++){
  const have={};for(const row of byId.values())have[row.department]=(have[row.department]||0)+1;
  const short=Object.entries(categories).filter(([name,count])=>Number.isInteger(count)&&(have[name]||0)<count).map(([name])=>name);
  if(!short.length)break;
  for(const name of short){if(byId.size>=total||stop)break;await walk(name);}
 }
 const all=[...byId.values()],reconciled=all.length===total&&!invalid;
 const notes=`${all.length} unique of ${total} advertised roles over ${pages} page requests; ${failures} failed pages, ${invalid} invalid and ${duplicates} repeated records excluded${stop?`; ${stop}`:''}.`;
 const base={pages,endpoint:FLEXJET_SEARCH,observedAt,pageReceipts,invalid,duplicates};
 if(!all.length)return {...failed(`No usable roles. ${notes}`),pages,pageReceipts};
 if(source.slug==='flexjet')return {...base,rows:all,total,status:reconciled?'complete':'partial',reason:`Flexjet group public search: ${notes} Brand labels are not in the list feed, so rows carry the group label unless the feed names a brand. Sentient Jet and Corporate Wings boards are not read here.`};
 // Without the category and a division-naming title in the feed there is nothing explicit to scope by.
 if(!all.some(row=>row.department))return {...failed('The feed no longer publishes a category field, so Technical Services assignments cannot be decided without guessing'),pages,pageReceipts};
 const rows=all.filter(isFlexjetTechnical);
 if(!rows.length)return {...failed(`No role is explicitly assigned to Flexjet Technical Services (category "${FLEXJET_TECHNICAL_CATEGORY}" with the division named in the title). ${notes}`),pages,pageReceipts};
 return {...base,rows,total:reconciled?rows.length:null,groupTotal:total,status:reconciled?'complete':'partial',reason:`Only roles in category "${FLEXJET_TECHNICAL_CATEGORY}" whose published title names Flexjet Technical Services: ${rows.length}. Group search: ${notes} Other maintenance roles are not assigned to the division by the feed and stay with the parent board.`};
}
