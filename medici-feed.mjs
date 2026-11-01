// Group ownership: the official Peter Rahal episode and David's careers page.
// Brand assignment comes only from the public widget's explicit department.
export const MEDICI_CAREERS='https://davidprotein.com/pages/careers';
export const MEDICI_WIDGET='https://apply.workable.com/api/v1/widget/accounts/david-protein';
export const MEDICI_BRANDS=['Medici Brands','David Protein','HallPass','Epogee'];
export function parseMedici(data,brand,observedAt){
 if(!Array.isArray(data?.jobs))throw Error('Public jobs array missing');
 if(brand!=='all'&&!MEDICI_BRANDS.includes(brand))throw Error('Unknown Medici brand');
 const rows=[],seen=new Set();let invalid=0,duplicates=0;
 for(const job of data.jobs){
  let url;try{url=new URL(job.url||job.shortlink);}catch{}
  if(typeof job.title!=='string'||!job.title.trim()||!url||url.origin!=='https://apply.workable.com'||!/^\/j\/[A-Z0-9]+\/?$/.test(url.pathname)){invalid++;continue;}
  const assigned=MEDICI_BRANDS.includes(job.department)?job.department:null;
  if(brand!=='all'&&assigned!==brand)continue;
  const canonical=`${url.origin}${url.pathname.replace(/\/$/,'')}`;
  if(seen.has(canonical)){duplicates++;continue;}seen.add(canonical);
  const locations=(Array.isArray(job.locations)?job.locations:[]).filter(x=>x&&x.hidden!==true).map(x=>({raw:[x.city,x.region,x.country].filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i).join(', '),city:x.city||'',state:x.region||'',country:x.country||'',sourceUrl:MEDICI_WIDGET,source:'employer-public-feed',confidence:'published',observedAt})).filter(x=>x.raw);
  // If the feed explicitly hides locations, do not reconstruct them from other fields.
  if(!Array.isArray(job.locations)&&[job.city,job.state,job.country].some(Boolean))locations.push({raw:[job.city,job.state,job.country].filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i).join(', '),city:job.city||'',state:job.state||'',country:job.country||'',sourceUrl:MEDICI_WIDGET,source:'employer-public-feed',confidence:'published',observedAt});
  rows.push({id:job.shortcode||url.pathname.split('/').at(-1),title:job.title.trim(),url:canonical,employerBrand:assigned||'Medici Brands (brand unspecified)',department:job.department||'',location:locations[0]?.raw||'',secondaryLocations:locations.slice(1).map(x=>x.raw),locations,workplace:job.telecommuting===true?'Remote':'',employmentType:job.employment_type||'',publishedAt:job.published_on||'',sourceUrl:MEDICI_WIDGET,observedAt,sourceStatus:'current',locationStatus:locations.length?'published':'unknown'});
 }
 return {rows,invalid,duplicates,raw:data.jobs.length,endpoint:MEDICI_WIDGET,pages:1,total:null,status:'partial',reason:`Public group widget collected; ${brand==='all'?'all published brands':`only explicit ${brand} assignments`}. No independent total or pagination contract; ${invalid} invalid and ${duplicates} duplicate records excluded. Other group hiring channels remain unverified.`};
}
export async function fetchMedici(source,{request,observedAt}){
 const page=await request(MEDICI_CAREERS);
 const failed=reason=>({rows:[],status:'failed',reason,endpoint:MEDICI_WIDGET,pages:0,total:null});
 if(!page.ok)return failed(page.error||'Official careers page unavailable');
 if(!/Career Opportunities at Medici Brands/.test(page.text)||!/whr_embed\(\s*710073\s*,/.test(page.text))return failed('Official Medici group/widget identity changed; reverify the source');
 const result=await request(MEDICI_WIDGET);if(!result.ok)return failed(result.error||'Public widget unavailable');
 try{const board=parseMedici(result.data,source.slug,observedAt);return {...board,pageReceipts:[{url:MEDICI_CAREERS,observedAt,identity:'Medici Brands careers; Workable account 710073'},{url:MEDICI_WIDGET,observedAt,raw:board.raw,collected:board.rows.length,brand:source.slug}]};}catch(e){return failed(e.message);}
}
