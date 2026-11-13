// Beats by Dre: Apple's public jobs search scoped to the Beats product filter.
// Scope rule: only postings this product-scoped search returns. Never widen to all Apple jobs.
// Apple lists one record per posting and location (id "positionId-locationCode"); the advertised
// totalRecords counts those records. Rows group them by positionId, lowest record id first,
// with the other record urls kept as alternateUrls (same shape as the earlier manual rows).
export const BEATS_PRODUCT='beats-audio-accessories-BTSAA';
export const BEATS_SEARCH=`https://jobs.apple.com/en-us/search?product=${BEATS_PRODUCT}`;
export const BEATS_BRAND='Apple / Beats (shared product work)';
export const BEATS_BASIS='Listed by Apple\'s public jobs search under the Beats product filter';
const named={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '};
const decode=s=>String(s??'').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,(m,e)=>{
 if(e[0]!=='#')return named[e.toLowerCase()]??m;
 const n=/^#x/i.test(e)?parseInt(e.slice(2),16):Number(e.slice(1));return n>0&&n<=0x10ffff?String.fromCodePoint(n):'';
}).replace(/\s+/g,' ').trim();
export const beatsPageUrl=page=>page>1?`${BEATS_SEARCH}&page=${page}`:BEATS_SEARCH;
const detailUrl=r=>{
 const url=new URL(`https://jobs.apple.com/en-us/details/${r.id}/${r.slug}`);if(r.teamCode)url.searchParams.set('team',r.teamCode);
 return url.protocol==='https:'&&url.hostname==='jobs.apple.com'?url.href:null;
};
function payload(html){
 const m=String(html||'').match(/window\.__staticRouterHydrationData\s*=\s*JSON\.parse\(("(?:[^"\\]|\\.)*")\)/);
 if(!m)throw Error('Apple search hydration payload missing');
 let data;try{data=JSON.parse(JSON.parse(m[1]));}catch{throw Error('Apple search hydration payload unreadable');}
 const search=data?.loaderData?.search;
 if(!Array.isArray(search?.searchResults)||!Number.isFinite(search.totalRecords))throw Error('Apple search results or totalRecords missing');
 // The page echoes the applied filter. Anything but the Beats product means the scope was lost.
 if(search.queryParams?.product!==BEATS_PRODUCT)throw Error('Apple search is not scoped to the Beats product; refusing to widen');
 return search;
}
// One normalized record per advertised posting record. Invalid records are counted, never repaired.
// Apple slugs may carry percent-encoded bytes (a title that starts with the Apple logo glyph); that
// private-use glyph is dropped from the title because it renders as an empty box elsewhere.
function record(j,sourceUrl,observedAt){
 const id=String(j?.id??''),positionId=String(j?.positionId??''),title=decode(String(j?.postingTitle??'').replace(/[-]/g,' ')),slug=String(j?.transformedPostingTitle??''),teamCode=String(j?.team?.teamCode??'');
 if(!/^\d+(?:-\d+)?$/.test(id)||!/^\d+$/.test(positionId)||id.split('-')[0]!==positionId||!title||!/^(?:[a-z0-9]|%[0-9A-Fa-f]{2})+(?:-(?:[a-z0-9]|%[0-9A-Fa-f]{2})+)*$/.test(slug)||!/^[A-Z0-9]*$/.test(teamCode))return null;
 const url=detailUrl({id,slug,teamCode});if(!url)return null;
 const locations=(Array.isArray(j.locations)?j.locations:[]).map(l=>{
  const parts=[l?.name,l?.stateProvince,l?.countryName].map(decode).filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i);
  return {raw:parts.join(', '),country:decode(l?.countryName),sourceUrl,observedAt,source:'employer-public-feed',confidence:'published'};
 }).filter(l=>l.raw);
 const publishedAt=typeof j.postDateInGMT==='string'&&!Number.isNaN(Date.parse(j.postDateInGMT))?j.postDateInGMT:'';
 return {id,positionId,title,url,locations,department:decode(j.team?.teamName),workplace:j.homeOffice===true?'Remote':'',publishedAt,sourceUrl,observedAt};
}
export function groupBeats(records){
 const byPosition=new Map();
 for(const r of records){if(!byPosition.has(r.positionId))byPosition.set(r.positionId,[]);byPosition.get(r.positionId).push(r);}
 return [...byPosition.values()].map(group=>{
  const sorted=[...group].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0),first=sorted[0],locations=[];
  for(const r of sorted)for(const l of r.locations)if(!locations.some(x=>x.raw===l.raw))locations.push(l);
  const alternateUrls=sorted.slice(1).map(r=>r.url).filter(u=>u!==first.url);
  return {id:first.positionId,title:first.title,url:first.url,...(alternateUrls.length?{alternateUrls}:{}),location:locations[0]?.raw||'',secondaryLocations:locations.slice(1).map(l=>l.raw),locations,locationStatus:locations.length?'published':'unknown',locationSource:'employer-public-feed',department:[...new Set(sorted.map(r=>r.department).filter(Boolean))].join(' / '),employmentType:'',workplace:sorted.every(r=>r.workplace==='Remote')?'Remote':'',publishedAt:first.publishedAt,sourceUrl:first.sourceUrl,sourceStatus:'current',observedAt:first.observedAt,employerBrand:BEATS_BRAND,associationBasis:BEATS_BASIS};
 });
}
// Pure page parser. rows are grouped within this page only; fetchBeats regroups across pages.
export function parseBeatsPage(html,observedAt){
 const search=payload(html),records=[],seen=new Set();let invalid=0,duplicates=0,sourceUrl=BEATS_SEARCH;
 try{const u=new URL(search.requestUrl);if(u.protocol==='https:'&&u.hostname==='jobs.apple.com'&&u.searchParams.get('product')===BEATS_PRODUCT)sourceUrl=u.href;}catch{}
 for(const j of search.searchResults){
  const r=record(j,sourceUrl,observedAt);if(!r){invalid++;continue;}
  if(seen.has(r.id)){duplicates++;continue;}seen.add(r.id);records.push(r);
 }
 return {rows:groupBeats(records),records,invalid,duplicates,raw:search.searchResults.length,total:search.totalRecords,page:Number(search.page)||1,endpoint:BEATS_SEARCH};
}
export async function fetchBeats({request,observedAt=new Date().toISOString(),maxPages=20}={}){
 const records=[],seen=new Set(),pageReceipts=[];let total=null,invalid=0,duplicates=0,pages=0,stop='';
 for(let page=1;page<=maxPages;page++){
  const url=beatsPageUrl(page),result=await request(url);pages++;
  if(!result?.ok){stop=`Page ${page} failed: ${result?.error||'unavailable'}`;pageReceipts.push({url,page,total,rows:0,status:'failed'});break;}
  let parsed;try{parsed=parseBeatsPage(result.text,observedAt);}catch(e){stop=`Page ${page} unusable: ${e.message}`;pageReceipts.push({url,page,total,rows:0,status:'failed'});break;}
  // Pages past the end report totalRecords 0, so only the first positive total is trusted.
  if(total===null){if(parsed.total>0||!parsed.raw)total=parsed.total;}
  else if(parsed.raw&&parsed.total!==total)stop=`Advertised total changed from ${total} to ${parsed.total} during collection`;
  let added=0;for(const r of parsed.records){if(seen.has(r.id)){duplicates++;continue;}seen.add(r.id);records.push(r);added++;}
  invalid+=parsed.invalid;duplicates+=parsed.duplicates;
  pageReceipts.push({url,page,total:parsed.total,rows:added,invalid:parsed.invalid});
  if(stop)break;
  if(!parsed.raw){stop='end';break;}
  if(total!==null&&seen.size+invalid>=total){stop='end';break;}
  if(!added&&!parsed.invalid){stop='Source repeated a page; pagination could not be verified';break;}
 }
 if(!stop)stop=`Bounded pagination stopped after ${maxPages} pages`;
 const rows=groupBeats(records),base={total,pages,endpoint:BEATS_SEARCH,observedAt,pageReceipts,postings:records.length,invalid,duplicates};
 if(!rows.length&&!(stop==='end'&&total===0&&!invalid))return {rows:[],status:'failed',reason:stop==='end'?`No usable postings; ${invalid} invalid records excluded`:stop,...base};
 const complete=stop==='end'&&total!==null&&records.length===total&&!invalid;
 const summary=`${records.length} unique posting records of ${total??'unknown'} advertised, grouped into ${rows.length} positions; ${invalid} invalid and ${duplicates} duplicate records excluded`;
 return {rows,status:complete?'complete':'partial',reason:complete?`Beats product search exhausted: ${summary}. Scope is Apple's Beats product filter only.`:`${stop==='end'?'Collected records do not match the advertised total':stop}; ${summary}.`,...base};
}
