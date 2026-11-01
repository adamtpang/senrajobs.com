// Official Major Food Group widget. Public data only; no executable JSONP evaluation.
const plain=s=>String(s||'').replace(/<[^>]*>/g,' ').replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n))).replace(/&(?:amp|nbsp|quot|lt|gt|rsquo|lsquo|rdquo|ldquo);/g,x=>({'&amp;':'&','&nbsp;':' ','&quot;':'"','&lt;':'<','&gt;':'>','&rsquo;':"'",'&lsquo;':"'",'&rdquo;':'"','&ldquo;':'"'}[x])).replace(/\s+/g,' ').trim();
export const culinaryEndpoint='https://widget.culinaryagents.com/widget/v1/jobs/search?client_id=CA-DS-MAJORFOOD16&widget_name=majorfood-select&offset=0&search_limit=100&career_page=true';
export function parseCulinaryCards(text){
 const data=JSON.parse(text.slice(text.indexOf('{'),text.lastIndexOf('}')+1));
 if(typeof data.html!=='string'||!Number.isSafeInteger(data.length))throw Error('Missing widget response');
 const cards=[...data.html.matchAll(/<a\b([^>]*class="ca-single-job-card[^>]*)>([\s\S]*?)<\/a>/g)].map(([,attrs,html])=>{
  const url=new URL(attrs.match(/href="([^"]+)"/)?.[1]);
  const id=attrs.match(/data-jobid="(\d+)"/)?.[1];
  const field=cls=>plain(html.match(new RegExp(`<div class="${cls}">([\\s\\S]*?)<\\/div>`))?.[1]);
  if(url.origin!=='https://culinaryagents.com'||!id||!url.pathname.startsWith(`/jobs/${id}-`))throw Error('Invalid widget job identity');
  const title=field('ca-job-position');if(!title)throw Error('Missing widget title');
  return {id,url:url.href,title,employerBrand:field('ca-job-business'),publishedCompensation:field('ca-job-address')};
 });
 if(cards.length!==data.length||new Set(cards.map(c=>c.url)).size!==cards.length)throw Error('Widget count or uniqueness mismatch');
 return cards;
}
export function parseCulinaryDetail(html,card,observedAt){
 const candidates=[...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].flatMap(m=>{try{return JSON.parse(m[1]);}catch{return [];}});
 const j=candidates.find(j=>j['@type']==='JobPosting'&&j.url===card.url);
 if(!j||plain(j.title)!==card.title||plain(j.description).length<80)throw Error('Job detail identity or description mismatch');
 const sourceUrl=card.url,addresses=(Array.isArray(j.jobLocation)?j.jobLocation:[j.jobLocation]).map(l=>l?.address).filter(Boolean);
 const locations=addresses.map(a=>({raw:[a.addressLocality,a.addressRegion,a.addressCountry].filter(Boolean).join(', '),city:a.addressLocality||'',state:a.addressRegion||'',country:a.addressCountry||'',sourceUrl,observedAt,source:'role-detail',confidence:'published'}));
 const location=locations.map(l=>l.raw).join(' / '),payRanges=[],v=j.baseSalary?.value;
 const min=Number(v?.minValue??v?.value),max=Number(v?.maxValue??v?.value),period={YEAR:'year',HOUR:'hour',MONTH:'month',WEEK:'week'}[v?.unitText];
 if(min>0&&max>=min&&period&&/^[A-Z]{3}$/.test(j.baseSalary?.currency||''))payRanges.push({min,max,currency:j.baseSalary.currency,period,type:'Base pay',...( /plus tips/i.test(card.publishedCompensation)?{additionalCompensation:'plus tips'}:{}),location,sourceUrl,publishedText:card.publishedCompensation});
 const employmentType=card.publishedCompensation.match(/^(Full\/Part Time|Full Time|Part Time|Seasonal|Internship)\b/)?.[1]||String(j.employmentType||'').replaceAll('_',' ').toLowerCase();
 return {...card,location,locations,locationStatus:location?'published':'unknown',sourceUrl:culinaryEndpoint,observedAt,detailObservedAt:observedAt,sourceStatus:'current',employmentType,publishedAt:j.datePosted||'',validThrough:j.validThrough||'',pay:null,payRanges,description:plain(j.description),closed:!!j.validThrough&&j.validThrough.slice(0,10)<observedAt.slice(0,10)};
}
export async function fetchCulinary({request,observedAt}){
 const result=await request(culinaryEndpoint),rows=[],errors=[];let cards=[];
 try{if(!result.ok)throw Error(result.error||'Public widget unavailable');cards=parseCulinaryCards(result.text);}catch(e){return {rows,endpoint:culinaryEndpoint,status:'failed',reason:e.message,total:null,pages:0};}
 // Sequential bounded public reads avoid flooding the source. No retries on rate limiting.
 for(const card of cards){
  const detail=await request(card.url);
  try{if(!detail.ok)throw Error(detail.error||'Detail unavailable');const role=parseCulinaryDetail(detail.text,card,observedAt);if(!role.closed){delete role.closed;rows.push(role);}}
  catch(e){errors.push({url:card.url,error:e.message});rows.push({...card,sourceUrl:culinaryEndpoint,observedAt,sourceStatus:'current',location:'',locations:[],locationStatus:'unknown',payRanges:[]});}
 }
 return {rows,endpoint:culinaryEndpoint,status:'partial',total:null,pages:1,reason:`Collected ${cards.length} public widget cards; ${errors.length} detail failures. Widget exposes no independent total or verifiable pagination contract; additional channels remain unverified.`,pageReceipts:[{url:culinaryEndpoint,page:1,rows:cards.length,total:null}],detailErrors:errors};
}
