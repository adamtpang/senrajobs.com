// Public employer-specific listings which do not expose a supported generic ATS.
// Decode public data only; never evaluate employer scripts or collect candidate data.
const array = value => Array.isArray(value) ? value : [];
const plain = value => String(value ?? '').replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim();
const location = (raw, endpoint, observedAt, country='') => ({raw,country,sourceUrl:endpoint,observedAt,source:'employer-public-feed',confidence:'published'});
const base = (id,title,url,endpoint,observedAt) => ({id:String(id),title,url,sourceUrl:endpoint,observedAt,sourceStatus:'current',locationSource:'employer-public-feed'});
const failed = (endpoint,reason,pages=1) => ({status:'failed',reason,endpoint,pages,rows:[],total:null});

function decodeShopifyLoaders(html) {
  const match=html.match(/streamController\.enqueue\(("(?:\\.|[^"\\])*")\)/);
  if(!match)throw Error('Public careers payload missing');
  const flat=JSON.parse(JSON.parse(match[1]));
  if(!Array.isArray(flat)||flat.length>100000)throw Error('Unexpected careers payload');
  const memo=new Map();
  function get(i,depth=0){
    if(depth>100)throw Error('Careers payload nesting exceeds bound');
    if(typeof i!=='number')return i;
    if(i<0)return null;
    if(memo.has(i))return memo.get(i);
    const value=flat[i];if(!value||typeof value!=='object')return value;
    const out=Array.isArray(value)?[]:Object.create(null);memo.set(i,out);
    if(Array.isArray(value))for(const v of value)out.push(get(v,depth+1));
    else for(const [k,v]of Object.entries(value)){
      const key=k.startsWith('_')?get(Number(k.slice(1)),depth+1):k;
      if(typeof key==='string'&&!['__proto__','constructor','prototype'].includes(key))out[key]=get(v,depth+1);
    }
    return out;
  }
  return get(0)?.loaderData;
}

export function decodeShopifyDetail(html, expectedId) {
  const posting=decodeShopifyLoaders(html)?.['($locale)/careers/$posting']?.jobPosting;
  if(!posting || String(posting.id)!==String(expectedId))throw Error('Public job detail identity mismatch');
  if(posting.status!=='Published'||posting.isListed!==true)throw Error('Job detail is not a listed published opening');
  // Return only the public description, never application forms or internal job fields.
  return {id:String(posting.id),title:posting.title,description:posting.descriptionHtml||posting.descriptionPlain||''};
}

export function decodeShopifyPage(html) {
  const loader=decodeShopifyLoaders(html)?.['($locale)/careers'];
  if(!Array.isArray(loader?.jobPostingsWithJobs)||!Array.isArray(loader?.atsLocations))throw Error('Public job list missing');
  // Do not return internal job objects, hiring teams, or unrelated loader fields.
  return {postings:loader.jobPostingsWithJobs.map(row=>row.jobPosting),locations:loader.atsLocations};
}

export function parseShopify(html,observedAt){
  const endpoint='https://www.shopify.com/careers';
  const {postings,locations}=decodeShopifyPage(html);
  const published=postings.filter(p=>p?.status==='Published'&&p.isListed===true);
  const rows=published.filter(p=>p.id&&p.title&&/^https:\/\/www\.shopify\.com\/careers(?:[/?]|$)/.test(p.externalLink||'')).map(p=>{
    const secondary=array(p.locationIds?.secondaryLocationIds).map(id=>locations.find(l=>l.id===id)).filter(Boolean).map(l=>l.externalName||l.name).filter(Boolean);
    const raw=p.locationExternalName||p.locationName||'';
    return {...base(p.id,p.title,p.externalLink,endpoint,observedAt),department:p.teamName||'',location:raw,secondaryLocations:secondary,locations:[raw,...secondary].filter(Boolean).map(l=>location(l,endpoint,observedAt)),workplace:p.workplaceType||'',employmentType:p.employmentType||'',publishedAt:p.publishedDate||'',locationStatus:raw?'published':'unknown'};
  });
  const invalid=published.length-rows.length;
  return {rows,status:invalid?'partial':'complete',reason:invalid?`${invalid} malformed published records excluded`:`Exhausted public page payload: ${rows.length} published, listed records; no independently advertised global total`,total:null,pages:1,endpoint,observedAt};
}

export function parseBendingSpoons(html,observedAt){
  const endpoint='https://jobs.bendingspoons.com/';
  const match=html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s);
  if(!match)throw Error('Public careers payload missing');
  const list=JSON.parse(match[1])?.props?.pageProps?.list;
  if(!Array.isArray(list))throw Error('Public positions list missing');
  const active=list.filter(p=>p.status==='active'&&!p.isEvent);
  const rows=active.filter(p=>/^[a-f0-9]{24}$/.test(p.id||'')&&p.jobTitle).map(p=>{
    const locs=array(p.officeLocations).map(l=>location(l.title,endpoint,observedAt,l.country?.isoCode||''));
    const remote=p.availableAsRemoteInDefaultCountries||array(p.additionalRemoteWorkCountries).length>0;
    if(remote)locs.push(location('Remote (eligible countries only)',endpoint,observedAt));
    return {...base(p.id,p.jobTitle,`${endpoint}positions/${p.id}`,endpoint,observedAt),location:locs.map(l=>l.raw).join(' / '),locations:locs,secondaryLocations:locs.slice(1).map(l=>l.raw),workplace:'',remoteEligibility:remote?'Remote possible only from employer-approved countries; verify role requirements':'',description:plain([p.highLevelDescription,...array(p.responsibilities),...array(p.requirements).map(x=>`${x.title}: ${x.description}`),...array(p.sellingPoints).map(x=>`${x.title}: ${x.description}`),p.selectionProcess?.description].join('\n')),suitableForStudentsAndNewGraduates:p.suitableForStudentsAndNewGraduates===true,locationStatus:locs.length?'published':'unknown'};
  });
  const invalid=active.length-rows.length;
  return {rows,status:invalid?'partial':'complete',reason:invalid?`${invalid} malformed active records excluded`:`Exhausted public page payload: ${rows.length} active non-event positions; no independently advertised global total`,total:null,pages:1,endpoint,observedAt};
}

export function parseBoring(html,observedAt){
  const endpoint='https://www.boringcompany.com/careers';
  const cards=[...html.matchAll(/<a\b[^>]*class="[^"]*\bjobs_row\b[^"]*"[^>]*>[\s\S]*?<\/a>/g)];
  if(!cards.length)throw Error('No recognizable public job rows; empty board not verified');
  const rows=[],seen=new Set();let invalid=0;
  for(const [card]of cards){
    const href=card.match(/href="([^"]+)"/)?.[1];
    const title=plain(card.match(/class="jobs_row-title"[^>]*>([\s\S]*?)<\/span>/)?.[1]);
    const meta=plain(card.match(/class="jobs_row-meta"[^>]*>([\s\S]*?)<\/span>/)?.[1]);
    let url;try{url=new URL(href,endpoint);}catch{}
    if(!href||!title||!url||url.origin!=='https://www.boringcompany.com'||!url.pathname.startsWith('/job/')){invalid++;continue;}
    if(seen.has(url.href))continue;seen.add(url.href);
    const [raw='',mode='']=meta.split(' • ');
    rows.push({...base(url.pathname,title,url.href,endpoint,observedAt),location:raw,locations:raw?[location(raw,endpoint,observedAt)]:[],workplace:/^in office$/i.test(mode)?'OnSite':/^remote$/i.test(mode)?'Remote':/^hybrid$/i.test(mode)?'Hybrid':'',workplaceEvidence:mode,locationStatus:raw?'published':'unknown'});
  }
  return {rows,status:invalid?'partial':'complete',reason:invalid?`${invalid} malformed public job rows excluded`:`Exhausted server-rendered page: ${rows.length} unique listings; no independently advertised global total`,total:null,pages:1,endpoint,observedAt};
}

export async function fetchEmployerBoard(source,{request,observedAt,maxPages=500}){
  if(source.kind==='signals-page'){
    const endpoint='https://37signals.com/jobs',result=await request(endpoint);
    if(!result.ok)return failed(endpoint,result.error||'Public page unavailable');
    if(/Sorry, we don[’']t have any job openings right now\./.test(plain(result.text)))return {rows:[],status:'complete',reason:'Official careers page explicitly states there are no current job openings',total:0,pages:1,endpoint,observedAt};
    return failed(endpoint,'Empty-board statement absent; careers page requires renewed listing discovery');
  }
  if(source.kind==='boring-page'){
    const endpoint='https://www.boringcompany.com/careers';
    const result=await request(endpoint);if(!result.ok)return failed(endpoint,result.error||'Public page unavailable');
    try{return parseBoring(result.text,observedAt);}catch(e){return failed(endpoint,e.message);}
  }
  if(source.kind==='shopify-page'||source.kind==='spoons-page'){
    const endpoint=source.kind==='shopify-page'?'https://www.shopify.com/careers':'https://jobs.bendingspoons.com/';
    const result=await request(endpoint);if(!result.ok)return failed(endpoint,result.error||'Public page unavailable');
    try{return source.kind==='shopify-page'?parseShopify(result.text,observedAt):parseBendingSpoons(result.text,observedAt);}catch(e){return failed(endpoint,e.message);}
  }
  if(!['oracle-dell','oracle-uber'].includes(source.kind))throw Error('Unsupported custom employer source');
  const uber=source.kind==='oracle-uber';
  const endpoint=`https://${uber?'iaziqy.fa.ocs.oraclecloud.com':'enterpriseplatform.dell.com'}/hcmRestApi/resources/latest/recruitingCEJobRequisitions`;
  const siteNumber=uber?'UberCareers':'CX_1001';
  const pageReceipts=[];
  const rows=[],seen=new Set();let offset=0,total=null,pages=0,reason='',status='complete',ended=false;
  for(;pages<maxPages;){
    const url=`${endpoint}?onlyData=true&expand=requisitionList.secondaryLocations&finder=findReqs;siteNumber=${siteNumber},facetsList=NONE,limit=100,offset=${offset}`;
    const result=await request(url);pages++;
    const data=result.data?.items?.[0];
    pageReceipts.push({url,page:pages,offset,total:data?.TotalJobsCount??null,rows:data?.requisitionList?.length||0,status:result.status??null});
    if(!result.ok||!Array.isArray(data?.requisitionList)){reason=result.error||'Unexpected public search response';status=rows.length?'partial':'failed';break;}
    if(Number.isFinite(data.TotalJobsCount)){if(total!==null&&total!==data.TotalJobsCount){status='partial';reason='Advertised total changed during pagination';}total=data.TotalJobsCount;}
    if(data.Offset!==offset){status='partial';reason='Public search returned an unexpected offset';break;}
    const items=data.requisitionList;
    if(!items.length){ended=true;break;}
    let added=0;
    for(const j of items){
      if(!j.Id||!j.Title){status='partial';reason='Malformed public records excluded';continue;}
      const id=String(j.Id);if(seen.has(id))continue;seen.add(id);added++;
      const raw=j.PrimaryLocation||'';
      const locs=[location(raw,endpoint,observedAt,j.PrimaryLocationCountry||''),...array(j.secondaryLocations).map(l=>location(l.Name||'',endpoint,observedAt,l.CountryCode||''))].filter(l=>l.raw);
      const publicUrl=uber?`https://jobs.uber.com/en/jobs/${encodeURIComponent(id)}/`:`https://enterpriseplatform.dell.com/hcmUI/CandidateExperience/en/sites/careers/job/${encodeURIComponent(id)}`;
      rows.push({...base(id,j.Title,publicUrl,endpoint,observedAt),location:raw,locations:locs,secondaryLocations:locs.slice(1).map(l=>l.raw),workplace:{ORA_ON_SITE:'OnSite',ORA_REMOTE:'Remote',ORA_HYBRID:'Hybrid'}[j.WorkplaceTypeCode]||'',publishedAt:j.PostedDate||'',department:j.Department||'',locationStatus:locs.length?'published':'unknown'});
    }
    if(!added){status='partial';reason='Public search repeated a page';break;}
    offset+=items.length;
    if(total!==null&&offset>=total){ended=true;break;}
  }
  if(!ended&&status==='complete'){status='partial';reason='Pagination bound reached';}
  if(status==='complete'&&(total===null||rows.length!==total)){status='partial';reason='Collected count does not match a verified advertised total';}
  return {rows,status,reason,total,pages,endpoint,observedAt,pageReceipts};
}
