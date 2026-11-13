// Michael & Susan Dell Foundation: the official careers page lists openings in one plain HTML table.
// Scope is only https://www.dell.org/careers/. Dell Technologies and MSD family entities are separate sources.
// The listing publishes location and title only; no pay, team or dates are projected.
export const DELL_FOUNDATION_CAREERS='https://www.dell.org/careers/';
const NAMED={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' ',ndash:'-',mdash:'-',rsquo:"'",lsquo:"'",hellip:'...'};
const point=n=>Number.isInteger(n)&&n>0&&n<=0x10ffff&&!(n>=0xd800&&n<=0xdfff)?String.fromCodePoint(n):'';
const decode=s=>String(s??'').replace(/&#x([0-9a-f]+);/gi,(_,h)=>point(parseInt(h,16))).replace(/&#(\d+);/g,(_,n)=>point(Number(n))).replace(/&([a-z]+);/gi,(m,k)=>NAMED[k.toLowerCase()]??m);
const plain=s=>decode(String(s??'').replace(/<[^>]*>/g,' ')).replace(/\s+/g,' ').trim();
const cells=(row,tag)=>[...row.matchAll(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`,'gi'))].map(m=>m[1]);
export function parseDellFoundation(html,observedAt){
 const table=typeof html==='string'?html.match(/<section\b[^>]*class="[^"]*\bcareers-list\b[^"]*"[^>]*>[\s\S]*?<table\b[^>]*>([\s\S]*?)<\/table>/i)?.[1]:null;
 if(typeof table!=='string')throw Error('Public careers listing table missing');
 const trs=[...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(m=>m[1]);
 // Columns are read from the published header; an unlabelled cell is never treated as a location.
 const header=(trs.find(r=>/<th\b/i.test(r))?cells(trs.find(r=>/<th\b/i.test(r)),'th'):[]).map(h=>plain(h).toLowerCase());
 const column=re=>header.findIndex(h=>re.test(h)),locationAt=column(/^locations?$/),departmentAt=column(/^(?:team|department|group)s?$/);
 const rows=[],seen=new Set();let invalid=0,duplicates=0,raw=0;
 for(const tr of trs){
  const tds=cells(tr,'td');if(!tds.length)continue;
  const links=[...tr.matchAll(/<a\b[^>]*\bhref="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi)];
  if(!links.length)continue;
  raw++;
  if(links.length!==1){invalid++;continue;}
  let url;try{url=new URL(decode(links[0][1]).trim());}catch{}
  const id=url?.searchParams.get('gni')||'',title=plain(links[0][2]);
  if(!url||url.protocol!=='https:'||url.hostname!=='www.dell.org'||url.port||url.pathname!=='/careers/job-description/'||url.searchParams.get('gnk')!=='job'||!/^[0-9a-f]{32}$/.test(id)||!title){invalid++;continue;}
  const canonical=`https://www.dell.org/careers/job-description/?gnk=job&gni=${id}`;
  if(seen.has(canonical)){duplicates++;continue;}seen.add(canonical);
  const cell=i=>i>=0&&i<tds.length&&!/<a\b/i.test(tds[i])?plain(tds[i]):'';
  const location=cell(locationAt);
  rows.push({id,title,url:canonical,location,secondaryLocations:[],locations:location?[{raw:location,sourceUrl:DELL_FOUNDATION_CAREERS,observedAt,source:'employer-public-feed',confidence:'published'}]:[],locationStatus:location?'published':'unknown',locationSource:'employer-public-feed',department:cell(departmentAt),employmentType:'',workplace:'',publishedAt:'',sourceUrl:DELL_FOUNDATION_CAREERS,sourceStatus:'current',observedAt,employerBrand:'Michael & Susan Dell Foundation'});
 }
 return {rows,invalid,duplicates,raw,total:null,endpoint:DELL_FOUNDATION_CAREERS};
}
export async function fetchDellFoundation({request,observedAt}){
 const endpoint=DELL_FOUNDATION_CAREERS,failed=reason=>({rows:[],status:'failed',reason,total:null,pages:0,endpoint,observedAt,pageReceipts:[]});
 const result=await request(endpoint);
 if(!result?.ok)return failed(result?.error||'Official careers page unavailable');
 if(result.url){let final;try{final=new URL(result.url);}catch{}if(!final||final.origin!=='https://www.dell.org')return failed('Official careers page redirected away from www.dell.org');}
 if(!/Michael\s*(?:&amp;|&#0*38;|&|and)\s*Susan Dell Foundation/i.test(result.text||''))return failed('Official foundation page identity changed; reverify the source');
 let parsed;try{parsed=parseDellFoundation(result.text,observedAt);}catch(e){return failed(e.message);}
 const {rows,invalid,duplicates,raw}=parsed,pageReceipts=[{url:endpoint,page:1,total:null,rows:rows.length,invalid}];
 // An empty table cannot be told apart from changed markup, so it never clears existing roles.
 if(!rows.length)return {...failed(`Listing table found but no valid openings parsed (${raw} linked rows, ${invalid} invalid); cannot distinguish an empty board from changed markup.`),pages:1,pageReceipts};
 const complete=!invalid&&!duplicates;
 return {rows,status:complete?'complete':'partial',reason:complete?`Single official listing table exhausted: ${rows.length} openings, every linked row valid. The page advertises no total and shows no pagination. Scope is the foundation careers page only.`:`Collected ${rows.length} of ${raw} linked rows from the single official listing table; ${invalid} invalid and ${duplicates} duplicate rows excluded. No advertised total.`,total:null,pages:1,endpoint,observedAt,pageReceipts};
}
