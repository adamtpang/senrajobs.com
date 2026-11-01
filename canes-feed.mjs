// Public Raising Cane's careers pages, following emitted pagination links only.
const origin='https://jobs.raisingcanes.com';
export function parseCanes(html,pageUrl,observedAt){
 const payload=html.match(/window\.__PRELOAD_STATE__\s*=\s*([\s\S]*?);\s*window\.__BUILD__/);
 if(!payload)throw Error('Public search payload missing');
 const data=JSON.parse(payload[1]).jobSearch;
 if(!Array.isArray(data?.jobs)||!Number.isSafeInteger(data.totalJob)||data.totalJob<0||data.isLoading)throw Error('Unexpected public search state');
 const rows=[];let invalid=0,excluded=0;
 for(const j of data.jobs){
  const fields=new Map((j.customFields||[]).map(f=>[f.cfKey,f.value]));
  if(j.isInternal===true||j.isInternal==='true'||fields.get('cf_private_posting')==='1'||fields.get('cf_externally_posted')==='0'){excluded++;continue;}
  let url;try{url=new URL(j.originalURL,origin+'/');}catch{}
  if(!j.originalURL||!j.requisitionID||typeof j.title!=='string'||!j.title.trim()||!url||url.origin!==origin||!/^\/[^/]+\/job\/[a-z0-9-]+\/?$/i.test(url.pathname)){invalid++;continue;}
  const locations=(j.locations||[]).map(l=>({raw:[l.city,l.stateAbbr||l.state,l.countryAbbr||l.country].filter(Boolean).join(', '),city:l.city||'',state:l.stateAbbr||l.state||'',country:l.countryAbbr||l.country||'',sourceUrl:pageUrl,observedAt,source:'employer-public-page',confidence:'published'})).filter(l=>l.raw);
  rows.push({id:String(j.requisitionID),title:j.title.trim(),url:url.href,department:fields.get('cf_department_group')||j.accountName||'',location:locations.map(l=>l.raw).join(' / '),locations,secondaryLocations:locations.slice(1).map(l=>l.raw),locationStatus:locations.length?'published':'unknown',locationSource:'employer-public-page',sourceUrl:pageUrl,observedAt,sourceStatus:'current',workplace:j.isRemote===true?'Remote':'',employmentType:Array.isArray(j.employmentType)?j.employmentType.join(' / '):''});
 }
 const tag=[...html.matchAll(/<a\b([^>]+)>/g)].find(m=>/data-testid="jobs-pagination_link_next"/.test(m[1]))?.[1];
 const href=tag?.match(/href="([^"]+)"/)?.[1];let next=null;
 if(href){const u=new URL(href.replaceAll('&amp;','&'),pageUrl);if(u.origin===origin&&/^\/(?:jobs\/)?page\/\d+$/.test(u.pathname))next=u.href;else throw Error('Unexpected pagination destination');}
 return {rows,total:data.totalJob,page:Number(data.params?.page_number||1),next,invalid,excluded,advertisedPageCount:data.jobs.length};
}
export async function fetchCanes({request,observedAt,maxPages=500}){
 const endpoint=origin+'/jobs';let url=endpoint,total=null,firstTotal=null,pages=0,finished=false,status='complete';const rows=[],seen=new Set(),seenPages=new Set(),pageReceipts=[],reasons=[];
 while(url&&pages<maxPages){
  if(seenPages.has(url)){reasons.push('Repeated page URL');break;}seenPages.add(url);
  const result=await request(url);pages++;
  if(!result.ok){status=rows.length?'partial':'failed';reasons.push(result.error||'Public page unavailable');break;}
  let p;try{p=parseCanes(result.text,url,observedAt);}catch(e){status=rows.length?'partial':'failed';reasons.push(e.message);break;}
  pageReceipts.push({url,page:p.page,total:p.total,rows:p.rows.length,advertisedPageCount:p.advertisedPageCount,excluded:p.excluded,invalid:p.invalid});
  firstTotal??=p.total;if(total!==null&&total!==p.total)reasons.push('Advertised total changed during collection');total=p.total;
  if(p.page!==pages){reasons.push('Unexpected page number');break;}
  if(p.invalid||p.excluded)reasons.push('Malformed or non-public records excluded');
  let added=0;for(const r of p.rows)if(!seen.has(r.url)){seen.add(r.url);rows.push(r);added++;}
  if(added!==p.rows.length)reasons.push('Duplicate role URL across pages');
  if(!p.next){finished=true;break;}
  if(!added){reasons.push('Repeated or empty result page');break;}url=p.next;
 }
 if(!finished)reasons.push('Public pagination not exhausted');
 if(rows.length!==total)reasons.push('Unique public count does not match advertised total');
 if(reasons.length&&status==='complete')status='partial';
 return {rows,status,reason:[...new Set(reasons)].join('; ')||'All emitted public pages retrieved and advertised total matched.',pages,total,firstTotal,endpoint,observedAt,pageReceipts};
}
