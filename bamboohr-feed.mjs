// BambooHR public careers list (anonymous JSON at /careers/list with accept: application/json).
// source.slug is the employer subdomain, e.g. 'trailrunner'.
// The list payload publishes no pay or posting date, so neither is projected.
const NAMED={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' ',ndash:'-',mdash:'-',rsquo:"'",lsquo:"'"};
const point=n=>Number.isInteger(n)&&n>0&&n<=0x10ffff&&!(n>=0xd800&&n<=0xdfff)?String.fromCodePoint(n):'';
const plain=s=>String(s??'').replace(/<[^>]*>/g,' ').replace(/&#x([0-9a-f]+);/gi,(_,h)=>point(parseInt(h,16))).replace(/&#(\d+);/g,(_,n)=>point(Number(n))).replace(/&([a-z]+);/gi,(m,k)=>NAMED[k.toLowerCase()]??m).replace(/\s+/g,' ').trim();
export function bambooIdentity(slug){
 if(!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(slug||''))throw Error('BambooHR source slug must be the employer subdomain');
 const origin=`https://${String(slug).toLowerCase()}.bamboohr.com`;
 return {origin,endpoint:`${origin}/careers/list`,careers:`${origin}/careers`};
}
// City and state are kept as published, even when equal (New York, New York).
// BambooHR locationType codes as rendered by its own public careers page.
const WORKPLACE={'0':'On-site','1':'Remote','2':'Hybrid'};
const place=l=>[l?.city,l?.state??l?.province,l?.country].map(plain).filter(Boolean).join(', ');
export function parseBambooHr(data,slug,observedAt){
 if(!Array.isArray(data?.result))throw Error('Public result array missing');
 const {origin,endpoint}=bambooIdentity(slug),rows=[],seen=new Set();let invalid=0,duplicates=0;
 for(const j of data.result){
  const id=typeof j?.id==='number'?String(j.id):j?.id,title=plain(j?.jobOpeningName);
  if(typeof id!=='string'||!/^\d+$/.test(id)||!title){invalid++;continue;}
  const url=`${origin}/careers/${id}`;
  if(seen.has(url)){duplicates++;continue;}seen.add(url);
  const raws=[...new Set([place(j.location),place(j.atsLocation)].filter(Boolean))].slice(0,1);
  const locations=raws.map(raw=>({raw,sourceUrl:endpoint,observedAt,source:'employer-public-feed',confidence:'published'}));
  rows.push({id,title,url,location:raws[0]||'',secondaryLocations:[],locations,locationStatus:raws.length?'published':'unknown',locationSource:'employer-public-feed',department:plain(j.departmentLabel),employmentType:plain(j.employmentStatusLabel),workplace:j.isRemote===true?'Remote':WORKPLACE[String(j.locationType??'')]||'',publishedAt:'',sourceUrl:endpoint,sourceStatus:'current',observedAt,employerBrand:''});
 }
 const total=Number.isInteger(data.meta?.totalCount)&&data.meta.totalCount>=0?data.meta.totalCount:null;
 return {rows,invalid,duplicates,raw:data.result.length,total,endpoint};
}
export async function fetchBambooHr(source,{request,observedAt}){
 const failed=(reason,endpoint='https://www.bamboohr.com')=>({rows:[],status:'failed',reason,total:null,pages:0,endpoint,observedAt,pageReceipts:[]});
 let identity;try{identity=bambooIdentity(source?.slug);}catch(e){return failed(e.message);}
 const {endpoint,origin}=identity,result=await request(endpoint,{headers:{accept:'application/json'}});
 if(!result?.ok)return failed(result?.error||'Public careers list unavailable',endpoint);
 // An unknown subdomain redirects to bamboohr.com; never read another host as this employer.
 if(result.url){let final;try{final=new URL(result.url);}catch{}if(!final||final.origin!==origin)return failed('Public careers list redirected away from the employer subdomain',endpoint);}
 let parsed;try{parsed=parseBambooHr(result.data,source.slug,observedAt);}catch(e){return failed(e.message,endpoint);}
 const {rows,invalid,duplicates,raw,total}=parsed,pageReceipts=[{url:endpoint,page:1,total,rows:rows.length,invalid}];
 const base={total,pages:1,endpoint,observedAt,pageReceipts};
 if(!rows.length&&(raw||total!==0))return {...failed(`Public careers list returned no usable records; ${invalid} invalid excluded.`,endpoint),...base,rows:[]};
 const complete=!invalid&&!duplicates&&(total===null||rows.length===total);
 return {rows,status:complete?'complete':'partial',reason:complete?`Single public careers list payload exhausted: ${rows.length} openings${total===null?', no advertised total':` matching meta.totalCount ${total}`}. Completeness applies only to this BambooHR board at observation time; pay and posting dates are not in the list feed.`:`Collected ${rows.length} unique of ${total??'an unadvertised number of'} openings; ${invalid} invalid and ${duplicates} duplicate records excluded.`,...base};
}
