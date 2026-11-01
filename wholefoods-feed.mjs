// Whitelist public listing fields; discard unrelated internal HR metadata in page data.
export function parseWholeFoods(html,pageUrl,observedAt){
 const match=html.match(/window\.__PRELOAD_STATE__\s*=\s*([\s\S]*?);\s*window\.__BUILD__/);
 if(!match)throw Error('Public listing payload missing');
 const data=JSON.parse(match[1]).jobSearch;
 if(!Array.isArray(data?.jobs)||!Number.isSafeInteger(data.totalJob)||data.isLoading)throw Error('Unexpected public job-search state');
 const page=Number(data.params?.page_number||1),rows=[];let invalid=0,excluded=0;
 for(const j of data.jobs){
  const fields=new Map((j.customFields||[]).map(f=>[f.cfKey,f.value]));
  if(j.isInternal===true||j.isInternal==='true'||fields.get('cf_private_posting')==='1'||fields.get('cf_externally_posted')==='0'){excluded++;continue;}
  let url;try{url=new URL(j.originalURL,'https://careers.wholefoods.com/');}catch{}
  if(!j.originalURL||!j.requisitionID||!j.title||!url||url.origin!=='https://careers.wholefoods.com'||!url.pathname.includes('/job/')){invalid++;continue;}
  const locations=(j.locations||[]).map(l=>({raw:[l.city,l.stateAbbr||l.state,l.countryAbbr||l.country].filter(Boolean).join(', '),city:l.city||'',state:l.stateAbbr||l.state||'',country:l.countryAbbr||l.country||'',sourceUrl:pageUrl,observedAt,source:'employer-public-page',confidence:'published'})).filter(l=>l.raw);
  rows.push({id:j.requisitionID,title:j.title,url:url.href,location:locations.map(l=>l.raw).join(' / '),locations,secondaryLocations:locations.slice(1).map(l=>l.raw),locationStatus:locations.length?'published':'unknown',locationSource:'employer-public-page',sourceUrl:pageUrl,observedAt,sourceStatus:'current',workplace:j.isRemote===true?'Remote':'',employmentType:Array.isArray(j.employmentType)?j.employmentType.join(' / '):''});
 }
 const links=[...html.matchAll(/<a\b([^>]+)>/g)].map(m=>m[1]).filter(a=>/data-testid="jobs-pagination_link_next"/.test(a));
 const href=links[0]?.match(/href="([^"]+)"/)?.[1];
 let next=null;if(href){const url=new URL(href.replaceAll('&amp;','&'),pageUrl);if(url.origin==='https://careers.wholefoods.com'&&/^\/jobs\/page\/\d+$/.test(url.pathname))next=url.href;}
 return {rows,total:data.totalJob,page,next,invalid,excluded,advertisedPageCount:data.jobs.length};
}
export async function fetchWholeFoods({request,observedAt,maxPages=500}){
 const endpoint='https://careers.wholefoods.com/jobs';
 let url=endpoint,total=null,pages=0,status='complete',reason='',finished=false;
 const rows=[],seen=new Set(),pageReceipts=[];
 while(url&&pages<maxPages){
  const result=await request(url);pages++;
  if(!result.ok){status=rows.length?'partial':'failed';reason=result.error||'Public search unavailable';break;}
  let data;try{data=parseWholeFoods(result.text,url,observedAt);}catch(e){status=rows.length?'partial':'failed';reason=e.message;break;}
  pageReceipts.push({url,page:data.page,total:data.total,rows:data.rows.length,advertisedPageCount:data.advertisedPageCount,excluded:data.excluded,invalid:data.invalid});
  if(data.page!==pages){status='partial';reason='Unexpected public page number';break;}
  if(total!==null&&total!==data.total){status='partial';reason='Advertised total changed during pagination';}total=data.total;
  if(data.invalid||data.excluded){status='partial';reason='Malformed or non-public records excluded; advertised total not reconciled';}
  let added=0;for(const row of data.rows)if(!seen.has(row.url)){seen.add(row.url);rows.push(row);added++;}
  if(!data.next){finished=true;break;}
  if(!added){status='partial';reason='Repeated or empty result page';break;}
  url=data.next;
 }
 if(!finished&&status==='complete'){status='partial';reason='Pagination bound reached';}
 if(status==='complete'&&rows.length!==total){status='partial';reason='Unique public listings do not match advertised total';}
 const excluded=pageReceipts.reduce((n,p)=>n+p.excluded,0),invalid=pageReceipts.reduce((n,p)=>n+p.invalid,0);
 const duplicates=pageReceipts.reduce((n,p)=>n+p.rows,0)-rows.length;
 const notes=new Set(reason?[reason]:[]);
 if(excluded)notes.add(`${excluded} records with internal/private/non-external flags excluded`);
 if(invalid)notes.add(`${invalid} malformed records excluded`);
 if(duplicates)notes.add(`${duplicates} duplicate URLs across pages removed`);
 if(new Set(pageReceipts.map(p=>p.total)).size>1)notes.add('Advertised total changed during collection');
 reason=[...notes].join('; ');
 return {rows,total,pages,status,reason,endpoint,observedAt,pageReceipts};
}
