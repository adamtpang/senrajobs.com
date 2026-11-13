import {normalizePay} from './job-utils.mjs';
// PayPal's public Eightfold employee board. The search endpoint answers a plain
// GET, ignores num (fixed pages of 10) and advertises a moving total in data.count.
// Only public listing fields are projected. Role identity is the canonical
// https://paypal.eightfold.ai/careers/job/<position id> url, as in earlier manual rows.
export const PAYPAL_ORIGIN='https://paypal.eightfold.ai';
export const PAYPAL_CAREERS=`${PAYPAL_ORIGIN}/careers`;
export const PAYPAL_SEARCH=`${PAYPAL_ORIGIN}/api/pcsx/search`;
export const PAYPAL_PAGE_SIZE=10;
export const paypalPageUrl=start=>`${PAYPAL_SEARCH}?domain=paypal.com&query=&location=&start=${start}`;
const text=value=>typeof value==='string'?value.replace(/\s+/g,' ').trim():'';
const strings=value=>(Array.isArray(value)?value:[]).map(text).filter((v,i,a)=>v&&a.indexOf(v)===i);
const WORKPLACE={remote:'Remote',remote_local:'Remote',remote_global:'Remote',hybrid:'Hybrid'};
// The listing currently publishes no compensation. Project pay only when a
// numeric range with currency and period appears on the listing record itself.
function listingPay(job){
 const s=job.salaryRange||job.salary||job.compensation;
 if(!s||typeof s!=='object')return null;
 return normalizePay({min:s.min??s.minValue,max:s.max??s.maxValue,currency:s.currency||s.currencyCode,period:String(s.period||s.interval||s.unit||'').toLowerCase()});
}
export function parsePayPal(data,observedAt,sourceUrl=paypalPageUrl(0)){
 const positions=data?.data?.positions??data?.positions;
 if(!Array.isArray(positions))throw Error('Public positions array missing');
 const count=data?.data?.count??data?.count,rows=[],seen=new Set();let invalid=0,duplicates=0;
 for(const job of positions){
  const key=typeof job?.id==='number'&&Number.isSafeInteger(job.id)&&job.id>0?String(job.id):typeof job?.id==='string'&&/^[1-9]\d{5,19}$/.test(job.id)?job.id:'';
  const title=text(job?.name),displayId=text(job?.displayJobId)||text(job?.atsJobId);
  let url;try{url=new URL(`/careers/job/${key}`,PAYPAL_ORIGIN);}catch{}
  // A published positionUrl must agree with the canonical url built from the id.
  let published=url;if(job?.positionUrl!=null){try{published=new URL(job.positionUrl,PAYPAL_ORIGIN);}catch{published=null;}}
  if(!key||!title||!/^[A-Za-z0-9_-]{1,40}$/.test(displayId)||!url||url.protocol!=='https:'||url.hostname!=='paypal.eightfold.ai'||!published||published.origin!==url.origin||published.pathname.replace(/\/$/,'')!==url.pathname){invalid++;continue;}
  if(seen.has(url.href)){duplicates++;continue;}seen.add(url.href);
  const raw=strings(job.locations),posted=Number(job.postedTs);
  const row={id:displayId,title,url:url.href,location:raw[0]||'',secondaryLocations:raw.slice(1),locations:raw.map(value=>({raw:value,sourceUrl,observedAt,source:'employer-public-feed',confidence:'published'})),locationStatus:raw.length?'published':'unknown',locationSource:'employer-public-feed',department:text(job.department),workplace:WORKPLACE[String(job.workLocationOption||'').toLowerCase()]||'',publishedAt:Number.isFinite(posted)&&posted>0&&posted<4102444800?new Date(posted*1000).toISOString():'',sourceUrl,sourceStatus:'current',observedAt,employerBrand:'PayPal',sourceJobIdentity:`paypal-eightfold:${key}`};
  const pay=listingPay(job);if(pay)row.pay=pay;
  rows.push(row);
 }
 return {rows,invalid,duplicates,raw:positions.length,total:Number.isSafeInteger(count)&&count>=0?count:null,endpoint:PAYPAL_SEARCH};
}
const wait=ms=>ms>0?new Promise(resolve=>setTimeout(resolve,ms)):null;
export async function fetchPayPal({request,observedAt=new Date().toISOString(),maxPages=60,delayMs=400}={}){
 const rows=[],seen=new Set(),pageReceipts=[],failedPages=[];
 let total=null,firstTotal=null,invalid=0,duplicates=0,pages=0,consecutive=0,capped=false,exhausted=false;
 const done=reason=>({rows,status:'partial',reason,total,pages,endpoint:PAYPAL_SEARCH,observedAt,pageReceipts,invalid,duplicates});
 for(let page=0;;page++){
  if(page>=maxPages){capped=true;break;}
  const start=page*PAYPAL_PAGE_SIZE;
  if(total!==null&&start>=total)break;
  if(page)await wait(delayMs);
  const url=paypalPageUrl(start);let parsed=null,error='';
  // One polite retry per page, then record the gap and move on.
  for(let attempt=0;attempt<2&&!parsed;attempt++){
   if(attempt)await wait(delayMs*3);
   let result;try{result=await request(url);}catch(e){result={ok:false,error:e.message};}
   if(!result?.ok){error=result?.error||'Public search page unavailable';continue;}
   try{parsed=parsePayPal(result.data,observedAt,url);}catch(e){error=e.message;}
  }
  if(!parsed){
   failedPages.push(page+1);pageReceipts.push({url,page:page+1,start,ok:false,error,observedAt});
   // Without a first page there is no advertised total to paginate against.
   if(total===null||++consecutive>=3)break;
   continue;
  }
  consecutive=0;pages++;
  if(parsed.total!==null){if(firstTotal===null)firstTotal=parsed.total;total=parsed.total;}
  let added=0;
  for(const row of parsed.rows){if(seen.has(row.url)){duplicates++;continue;}seen.add(row.url);rows.push(row);added++;}
  invalid+=parsed.invalid;duplicates+=parsed.duplicates;
  pageReceipts.push({url,page:page+1,start,ok:true,raw:parsed.raw,rows:added,invalid:parsed.invalid,advertisedTotal:parsed.total,observedAt});
  if(total===null)break;
  if(!parsed.raw){exhausted=true;break;}
 }
 if(!rows.length){
  const why=failedPages.length?`Public search page ${failedPages[0]} failed: ${pageReceipts.find(r=>!r.ok)?.error}`:total===0?'Public board advertised zero positions; treat as a source change and reverify':'No usable public positions returned';
  return {rows:[],status:'failed',reason:why,total,pages,endpoint:PAYPAL_SEARCH,observedAt,pageReceipts,invalid,duplicates};
 }
 const notes=[];
 if(failedPages.length)notes.push(`page(s) ${failedPages.join(', ')} failed`);
 if(capped)notes.push(`stopped at the ${maxPages}-page cap`);
 if(total===null)notes.push('no advertised total');
 else if(rows.length!==total)notes.push(`collected ${rows.length} unique rows against an advertised total of ${total}`);
 if(firstTotal!==null&&total!==firstTotal)notes.push(`advertised total moved from ${firstTotal} to ${total} during collection`);
 if(exhausted&&total!==null&&rows.length<total)notes.push('feed returned an empty page before the advertised total');
 const tail=`${invalid} invalid and ${duplicates} duplicate records excluded. Contractor and other hiring channels are not part of this board.`;
 if(notes.length)return done(`Public Eightfold employee board partially collected: ${notes.join('; ')}. ${tail}`);
 return {...done(`Public Eightfold employee board collected in full: ${rows.length} of ${total} advertised positions over ${pages} pages. ${tail}`),status:'complete'};
}
