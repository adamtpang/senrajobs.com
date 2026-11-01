// Public QXO search and its explicitly linked TopBuild recruiting channel.
// Only whitelisted job fields leave this module; no internal ATS metadata is exported.
const plain=s=>String(s||'').replace(/<[^>]*>/g,' ').replace(/&(?:amp|nbsp|quot|lt|gt);/g,x=>({'&amp;':'&','&nbsp;':' ','&quot;':'"','&lt;':'<','&gt;':'>'}[x])).replace(/&#39;|&apos;/g,"'").replace(/\s+/g,' ').trim();
const mode=s=>({onsite:'OnSite','on-site':'OnSite',hybrid:'Hybrid',remote:'Remote'}[String(s||'').toLowerCase()]||'');
export function parseQxoPage(data,url,observedAt){
 if(!Array.isArray(data?.jobs)||!Number.isSafeInteger(data.totalCount)||data.totalCount<0)throw Error('Public search jobs/total missing');
 const rows=[];let invalid=0,excluded=0;
 for(const item of data.jobs){
  const j=item?.data;if(!j){invalid++;continue;}
  if(j.internal===true||j.searchable===false||j.applyable===false||j.meta_data?.icims?.jps_is_public===false){excluded++;continue;}
  if(!/^\d+$/.test(String(j.slug))||!j.title){invalid++;continue;}
  const target=new URL(`https://jobs.qxo.com/jobs/${j.slug}`);if(/^[a-z]{2}-[a-z]{2}$/i.test(j.language||''))target.searchParams.set('lang',j.language);
  const raw=[j.city,j.state,j.country].filter(Boolean).join(', ')||j.full_location||'';
  rows.push({id:String(j.req_id||j.slug),title:plain(j.title),url:target.href,location:raw,locations:raw?[{raw,city:j.city||'',state:j.state||'',country:j.country_code||j.country||'',sourceUrl:url,observedAt,source:'employer-public-feed',confidence:'published'}]:[],locationStatus:raw?'published':'unknown',locationSource:'employer-public-feed',sourceUrl:url,observedAt,sourceStatus:'current',department:j.department||(j.categories||[]).map(c=>c.name).filter(Boolean).join(' / '),workplace:mode((j.tags4||[]).find(t=>mode(t))),employmentType:j.employment_type||'',publishedAt:j.posted_date||'',description:plain(j.description),employerBrand:'QXO'});
 }
 return {rows,total:data.totalCount,rawCount:data.jobs.length,invalid,excluded};
}
export function parseTopBuild(html,observedAt){
 const endpoint='https://careers.topbuild.com/jobs/';
 const match=html.match(/window\.jobsData\s*=\s*(\[[\s\S]*?\]);/);
 if(!match)throw Error('Public jobsData payload missing');
 const jobs=JSON.parse(match[1]);if(!Array.isArray(jobs))throw Error('Public jobsData payload is not a list');
 const rows=[];let invalid=0,expired=0;
 for(const j of jobs){
  let url;try{url=new URL(j.job_url);}catch{}
  const parts=url?.pathname.split('/').filter(Boolean)||[];
  if(!j.job_title||!url||url.protocol!=='https:'||url.hostname!=='topbuild.wd501.myworkdayjobs.com'||!/_External$/.test(parts[0]||'')||parts[1]!=='job'){invalid++;continue;}
  if(/^\d{4}-\d{2}-\d{2}$/.test(j.job_post_end_date||'')&&j.job_post_end_date<observedAt.slice(0,10)){expired++;continue;}
  const raw=j.job_location||'',brand=j.job_brand||'TopBuild';
  rows.push({id:j.job_requisition_id||j.job_posting_id,title:plain(j.job_title),url:url.href,location:raw,locations:raw?[{raw,sourceUrl:endpoint,observedAt,source:'employer-public-page',confidence:'published'}]:[],locationStatus:raw?'published':'unknown',locationSource:'employer-public-page',sourceUrl:endpoint,observedAt,sourceStatus:'current',department:[brand,j.job_category].filter(Boolean).join(' / '),employerBrand:brand,workplace:mode(j.job_remote_type),employmentType:j.job_fulltime||j.job_type||'',publishedAt:j.job_post_start_date||'',validThrough:j.job_post_end_date||'',detailApi:`${url.origin}/wday/cxs/topbuild/${parts[0]}/${parts.slice(1).join('/')}`});
 }
 return {rows,rawCount:jobs.length,invalid,expired,endpoint};
}
export async function fetchQxo({request,observedAt,maxPages=500}){
 const endpoint='https://jobs.qxo.com/api/jobs?internal=false&page=1&limit=100';
 const rows=[],seen=new Set(),receipts=[];let page=1,total=null,raw=0,status='complete',reason='',finished=false;
 while(page<=maxPages){
  const url=new URL(endpoint);url.searchParams.set('page',String(page));
  const result=await request(url.href);if(!result.ok){status=rows.length?'partial':'failed';reason=result.error||'QXO public search unavailable';break;}
  let parsed;try{parsed=parseQxoPage(result.data,url.href,observedAt);}catch(e){status=rows.length?'partial':'failed';reason=e.message;break;}
  receipts.push({url:url.href,page,total:parsed.total,rows:parsed.rows.length,excluded:parsed.excluded,invalid:parsed.invalid});
  if(total!==null&&parsed.total!==total){status='partial';reason='QXO advertised total changed during pagination';}total=parsed.total;raw+=parsed.rawCount;
  if(parsed.invalid||parsed.excluded){status='partial';reason='QXO malformed or nonpublic rows excluded';}
  let added=0;for(const r of parsed.rows)if(!seen.has(r.url)){seen.add(r.url);rows.push(r);added++;}
  if(raw>=total){finished=true;break;}
  if(!parsed.rawCount||!added){status='partial';reason='QXO repeated or empty page before advertised total';break;}page++;
 }
 if(!finished&&status==='complete'){status='partial';reason='QXO page limit reached';}
 if(status==='complete'&&rows.length!==total){status='partial';reason='QXO unique URL count differs from advertised total';}
 const qxo={status,rows:rows.length,total,pages:receipts.length,reason};
 const top=await request('https://careers.topbuild.com/jobs/');let topBuild;
 if(top.ok){try{const parsed=parseTopBuild(top.text,observedAt);let added=0;for(const r of parsed.rows)if(!seen.has(r.url)){seen.add(r.url);rows.push(r);added++;}receipts.push({url:parsed.endpoint,page:1,rows:parsed.rows.length,excluded:parsed.expired,invalid:parsed.invalid});topBuild={rows:added,raw:parsed.rawCount,invalid:parsed.invalid,expired:parsed.expired,status:parsed.invalid||parsed.expired||added!==parsed.rows.length?'partial':'complete',scope:'Exhausted public jobsData payload; no independent global total'};}catch(e){topBuild={status:'failed',reason:e.message};}}
 else topBuild={status:'failed',reason:top.error||'TopBuild careers unavailable'};
 // Parent acquisitions have additional recruiting channels (e.g. Kodiak).
 // Exhausting two linked feeds is not proof of complete parent-company coverage.
 const outputStatus=qxo.status!=='failed'||topBuild.status!=='failed'?'partial':'failed';
 return {rows,status:outputStatus,total:null,pages:receipts.length,endpoint,observedAt,pageReceipts:receipts,reason:`QXO external feed: ${qxo.rows}/${qxo.total??'unknown'} (${qxo.status}). TopBuild: ${topBuild.rows??0} (${topBuild.status}). Other acquired-employer channels remain unreconciled.`,channelCoverage:{qxo,topBuild}};
}
