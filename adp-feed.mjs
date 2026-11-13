// ADP Workforce Now public career center (anonymous JSON, plain GET).
// source.slug is 'cid|ccId' exactly as they appear in the employer's public career center link.
// Only fields the list payload publishes are projected; department is not in this payload.
import {normalizePay} from './job-utils.mjs';
const HOST='https://workforcenow.adp.com',PAGE_SIZE=50;
const NAMED={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' ',ndash:'-',mdash:'-',rsquo:"'",lsquo:"'"};
const point=n=>Number.isInteger(n)&&n>0&&n<=0x10ffff&&!(n>=0xd800&&n<=0xdfff)?String.fromCodePoint(n):'';
const plain=s=>String(s??'').replace(/<[^>]*>/g,' ').replace(/&#x([0-9a-f]+);/gi,(_,h)=>point(parseInt(h,16))).replace(/&#(\d+);/g,(_,n)=>point(Number(n))).replace(/&([a-z]+);/gi,(m,k)=>NAMED[k.toLowerCase()]??m).replace(/\s+/g,' ').trim();
export function adpIdentity(slug){
 const [cid,ccId,...rest]=String(slug||'').split('|');
 if(rest.length||!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(cid||'')||!/^[A-Za-z0-9_]+$/.test(ccId||''))throw Error("ADP source slug must be 'cid|ccId'");
 const query=`cid=${cid}&ccId=${ccId}&lang=en_US`;
 return {cid,ccId,endpoint:`${HOST}/mascsr/default/careercenter/public/events/staffing/v1/job-requisitions?${query}`,careers:`${HOST}/mascsr/default/mdf/recruitment/recruitment.html?${query}`};
}
const field=(list,name)=>(Array.isArray(list)?list:[]).find(f=>f?.nameCode?.codeValue===name);
const PERIOD={hourly:'hour',annual:'year',annually:'year',yearly:'year',monthly:'month',weekly:'week',daily:'day'};
function adpPay(j){
 const min=j.payGradeRange?.minimumRate,max=j.payGradeRange?.maximumRate;
 const currency=max?.currencyCode||min?.currencyCode;
 if(min?.currencyCode&&max?.currencyCode&&min.currencyCode!==max.currencyCode)return null;
 // ADP sends 0 for an unpublished bound ("Up to 22"); zero is not a published figure.
 const bound=v=>Number.isFinite(v)&&v>0?v:undefined;
 return normalizePay({min:bound(min?.amountValue),max:bound(max?.amountValue),currency,period:PERIOD[String(field(j.customFieldGroup?.codeFields,'SalaryType')?.shortName||'').trim().toLowerCase()]});
}
// Pure parser for one payload. seen is shared across pages so duplicates are counted once.
export function parseAdp(data,slug,observedAt,seen=new Set()){
 if(!Array.isArray(data?.jobRequisitions))throw Error('Public jobRequisitions array missing');
 const {endpoint,careers}=adpIdentity(slug),rows=[];let invalid=0,duplicates=0;
 for(const j of data.jobRequisitions){
  const id=field(j?.customFieldGroup?.stringFields,'ExternalJobID')?.stringValue,title=plain(j?.requisitionTitle);
  if(!/^\d+$/.test(id||'')||!title){invalid++;continue;}
  const url=`${careers}&jobId=${id}`;
  if(seen.has(url)){duplicates++;continue;}seen.add(url);
  const raws=[...new Set((Array.isArray(j.requisitionLocations)?j.requisitionLocations:[]).map(l=>plain(l?.nameCode?.shortName)).filter(Boolean))];
  const locations=raws.map(raw=>({raw,sourceUrl:endpoint,observedAt,source:'employer-public-feed',confidence:'published'}));
  const pay=adpPay(j),compensationText=plain(field(j.customFieldGroup?.stringFields,'SalaryRange')?.stringValue);
  rows.push({id,requisitionId:typeof j.clientRequisitionID==='string'?j.clientRequisitionID:'',title,url,location:raws[0]||'',secondaryLocations:raws.slice(1),locations,locationStatus:raws.length?'published':'unknown',locationSource:'employer-public-feed',department:'',employmentType:plain(j.workLevelCode?.shortName),workplace:'',...(pay?{pay}:{}),...(compensationText?{compensationText}:{}),publishedAt:typeof j.postDate==='string'?j.postDate:'',sourceUrl:endpoint,sourceStatus:'current',observedAt,employerBrand:''});
 }
 const total=Number.isInteger(data.meta?.totalNumber)&&data.meta.totalNumber>=0?data.meta.totalNumber:null;
 return {rows,invalid,duplicates,raw:data.jobRequisitions.length,total,endpoint};
}
export async function fetchAdp(source,{request,observedAt,maxPages=40}){
 let identity;try{identity=adpIdentity(source?.slug);}catch(e){return {rows:[],status:'failed',reason:e.message,total:null,pages:0,endpoint:HOST,observedAt,pageReceipts:[]};}
 const {endpoint}=identity,rows=[],pageReceipts=[],seen=new Set();let total=null,raw=0,invalid=0,duplicates=0,stop='';
 for(let page=1;page<=maxPages;page++){
  // $skip is the 1-based sequence of the first record (meta.startSequence), verified on the live feed.
  const url=`${endpoint}&$top=${PAGE_SIZE}${raw?`&$skip=${raw+1}`:''}`,result=await request(url);
  if(!result?.ok){stop=`page ${page} unavailable (${result?.error||'request failed'})`;break;}
  let parsed;try{parsed=parseAdp(result.data,source.slug,observedAt,seen);}catch(e){stop=`page ${page}: ${e.message}`;break;}
  rows.push(...parsed.rows);raw+=parsed.raw;invalid+=parsed.invalid;duplicates+=parsed.duplicates;if(parsed.total!==null)total=parsed.total;
  pageReceipts.push({url,page,total:parsed.total,rows:parsed.rows.length,invalid:parsed.invalid});
  if(!parsed.raw||total===null||raw>=total)break;
  if(page===maxPages)stop=`page limit ${maxPages} reached`;
 }
 const base={total,pages:pageReceipts.length,endpoint,observedAt,pageReceipts};
 if(!pageReceipts.length)return {rows:[],status:'failed',reason:`ADP public career center: ${stop}`,...base};
 const complete=!stop&&total!==null&&rows.length===total;
 if(!rows.length&&!complete)return {rows:[],status:'failed',reason:`ADP public career center returned no usable records${stop?`; ${stop}`:''}; ${invalid} invalid excluded.`,...base};
 return {rows,status:complete?'complete':'partial',reason:complete?`All ${total} advertised public requisitions collected (meta.totalNumber). Completeness applies only to this ADP career center at observation time; department is not published in the list feed.`:`Collected ${rows.length} unique of ${total??'an unadvertised number of'} public requisitions; ${invalid} invalid and ${duplicates} duplicate records excluded${stop?`; ${stop}`:''}.`,...base};
}
