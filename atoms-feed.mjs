// Official Atoms openroles frontend uses cssmerge; its Companies section links
// the named operating businesses. Dedicated Lab37/Otter boards add postings.
// Public source observations: .cache/atoms-expansion-2026-10-27/.
export const ATOMS_CHANNELS = [
  {slug:'cssmerge',label:'Atoms group',identityUrl:'https://atoms.co/openroles'},
  {slug:'atoms',label:'Atoms',identityUrl:'https://job-boards.greenhouse.io/atoms'},
  {slug:'lab37',label:'Lab37',identityUrl:'https://www.lab37.us/careers'},
  {slug:'otter',label:'Otter',identityUrl:'https://www.tryotter.com/jobs'}
];
const endpoint = slug => `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`;
const hasOwn = (o,k) => Object.prototype.hasOwnProperty.call(o,k);
export function atomsPlainText(value) {
  let text=String(value??'');
  for(let i=0;i<4;i++){
    const next=text.replace(/&#(x[\da-f]+|\d+);/gi,(_,code)=>{
      const point=code[0].toLowerCase()==='x'?parseInt(code.slice(1),16):Number(code);
      return Number.isInteger(point)&&point>0&&point<=0x10ffff&&!(point>=0xd800&&point<=0xdfff)?String.fromCodePoint(point):' ';
    }).replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&nbsp;/g,' ');
    if(next===text)break;text=next;
  }
  return text.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
}
const metadata = (job,name) => {
  const matches=(Array.isArray(job.metadata)?job.metadata:[]).filter(x=>x?.name===name);
  return matches.length===1&&typeof matches[0].value==='string'?atomsPlainText(matches[0].value):'';
};
const locationKey = row => [...new Set([row.location,...(row.secondaryLocations||[]),...(row.locations||[]).map(x=>x.raw)].filter(x=>typeof x==='string'&&x.trim()).map(x=>x.trim()))].sort();

export function parseAtomsChannel(data,channel,observedAt,mapJob) {
  if(!ATOMS_CHANNELS.some(c=>c.slug===channel?.slug))throw Error('Unverified Atoms channel');
  if(typeof mapJob!=='function')throw Error('ATS mapper required');
  if(!Array.isArray(data?.jobs)||data.jobs.length>10000)throw Error('Expected bounded public jobs array');
  const rows=[],seen=new Set();let invalid=0,duplicates=0,missingDescriptions=0;
  for(const job of data.jobs){
    let url;try{url=new URL(job?.absolute_url);}catch{}
    if(!Number.isSafeInteger(job?.id)||job.id<=0||typeof job.title!=='string'||!atomsPlainText(job.title)||!url||url.protocol!=='https:'||url.username||url.password||!['job-boards.greenhouse.io','boards.greenhouse.io'].includes(url.hostname)||url.pathname!==`/${channel.slug}/jobs/${job.id}`){invalid++;continue;}
    url.search='';url.hash='';
    if(seen.has(url.href)){duplicates++;continue;}seen.add(url.href);
    let mapped;try{mapped=mapJob('greenhouse',job,endpoint(channel.slug),observedAt,{kind:'greenhouse',slug:channel.slug});}catch{invalid++;continue;}
    if(!mapped?.title||!mapped?.url){invalid++;continue;}
    const {rawOfficeAssociations,rawLocation,...role}=mapped;
    const description=atomsPlainText(job.content),brand=metadata(job,'Brand'),division=metadata(job,'Division');
    if(!description)missingDescriptions++;
    rows.push({...role,url:url.href,title:atomsPlainText(job.title),description,employerBrand:brand,
      employerBrandSource:brand?'ats-metadata:Brand':'unknown',employerBrands:brand?[brand]:[],
      sourceEmployerLabel:typeof job.company_name==='string'?atomsPlainText(job.company_name):'',
      ...(division?{employerDivision:division}:{}),
      ...(Number.isSafeInteger(job.internal_job_id)&&job.internal_job_id>0?{sourceJobIdentity:`greenhouse:atoms:${job.internal_job_id}`} : {}),
      sourceBoards:[channel.slug],brandEvidence:[{board:channel.slug,value:brand||null}],
      requisitionId:typeof job.requisition_id==='string'?job.requisition_id:''});
  }
  const total=Number.isSafeInteger(data.meta?.total)&&data.meta.total>=0?data.meta.total:null;
  return {rows,total,raw:data.jobs.length,invalid,duplicates,missingDescriptions,endpoint:endpoint(channel.slug),status:invalid||duplicates||missingDescriptions||total===null||total!==rows.length?'partial':'complete'};
}

export function reconcileAtomsRows(rows,{preferredUrls=[]}={}) {
  const preferred=new Set(preferredUrls),groups=new Map();let unique=0;
  for(const row of rows){
    // Empty descriptions cannot establish a mirrored requisition.
    const key=row.sourceJobIdentity&&row.description?JSON.stringify([row.sourceJobIdentity,row.title,locationKey(row),row.description]):`unmerged:${unique++}`;
    if(!groups.has(key))groups.set(key,[]);groups.get(key).push(row);
  }
  const merged=[];let mirrored=0;
  for(const group of groups.values()){
    const winner=group.find(row=>preferred.has(row.url))||group[0],alternates=[...new Set(group.flatMap(row=>[row.url,...(row.alternateUrls||[])])).values()].filter(url=>url!==winner.url);
    const brands=[...new Set(group.flatMap(row=>row.employerBrands||[]))].sort();
    const brandEvidence=[...new Map(group.flatMap(row=>row.brandEvidence||[]).map(item=>[JSON.stringify(item),item])).values()];
    merged.push({...winner,sourceBoards:[...new Set(group.flatMap(row=>row.sourceBoards||[]))].sort(),employerBrands:brands,brandEvidence,...(brands.length>1?{employerBrandAmbiguous:true}:{}),...(alternates.length?{alternateUrls:alternates}:{} )});
    mirrored+=group.length-1;
  }
  const byIdentity=new Map();for(const row of merged)if(row.sourceJobIdentity){if(!byIdentity.has(row.sourceJobIdentity))byIdentity.set(row.sourceJobIdentity,[]);byIdentity.get(row.sourceJobIdentity).push(row);}
  const identityVariants=[...byIdentity].filter(([,rows])=>rows.length>1).map(([identity,rows])=>({identity,urls:rows.map(row=>row.url),reason:'Different title, published location or full description; retained separately.'}));
  return {rows:merged,mirrored,identityVariants};
}

export async function fetchAtoms({request,observedAt,mapJob,preferredUrls=[]}) {
  const results=await Promise.allSettled(ATOMS_CHANNELS.map(channel=>request(endpoint(channel.slug))));
  const collected=[],channels=[],pageReceipts=[];
  for(let i=0;i<ATOMS_CHANNELS.length;i++){
    const channel=ATOMS_CHANNELS[i],result=results[i];
    if(result.status!=='fulfilled'||!result.value?.ok){channels.push({...channel,status:'failed',reason:result.reason?.message||result.value?.error||'Public source unavailable'});continue;}
    try{
      const parsed=parseAtomsChannel(result.value.data,channel,observedAt,mapJob);collected.push(...parsed.rows);
      channels.push({...channel,status:parsed.status,rows:parsed.rows.length,total:parsed.total,invalid:parsed.invalid,duplicates:parsed.duplicates,missingDescriptions:parsed.missingDescriptions});
      pageReceipts.push({url:parsed.endpoint,page:1,total:parsed.total,rows:parsed.rows.length,invalid:parsed.invalid,duplicates:parsed.duplicates,missingDescriptions:parsed.missingDescriptions});
    }catch(error){channels.push({...channel,status:'failed',reason:error.message});}
  }
  const reconciled=reconcileAtomsRows(collected,{preferredUrls});
  return {...reconciled,status:channels.every(c=>c.status==='failed')?'failed':'partial',endpoint:'https://atoms.co/openroles',observedAt,total:null,pages:pageReceipts.length,pageReceipts,
    channelCoverage:channels,completedPublicBoards:channels.filter(c=>c.status==='complete').map(c=>c.slug),
    reason:`${channels.map(c=>`${c.slug}: ${c.rows??0} (${c.status})`).join('; ')}. ${reconciled.mirrored} mirrors merged only when internal requisition, title, published locations and full normalized description agree. Other hiring channels and unassigned brands remain unverified. Failed or partial channels cannot invalidate older postings.`};
}

const BRAND_VIEWS = {
  'CloudKitchens':{brands:['CloudKitchens']},
  'Pronto AI':{brands:['Pronto']},
  'Lab37':{brands:['Lab37'],board:'lab37'},
  'Otter':{brands:['Otter'],board:'otter'},
  'Picnic':{brands:['Picnic Delivery']},
  'ProFood Properties':{brands:['ProFood','ProFood Properties','ProFood Solutions']}
};
export function selectAtomsBrand(result,brand) {
  if(!hasOwn(BRAND_VIEWS,brand))throw Error('Unknown Atoms brand selection');
  const view=BRAND_VIEWS[brand];
  const rows=result.rows.filter(row=>(row.employerBrands||[row.employerBrand]).some(value=>view.brands.includes(value))||(view.board&&row.sourceBoards?.includes(view.board)));
  return {...result,rows,total:null,status:result.status==='failed'?'failed':'partial',
    reason:`${rows.length} indexed postings for ${brand}, selected by explicit Brand metadata${view.board?` or its official ${view.board} public board`:''}. Published employer labels are preserved. ${brand==='ProFood Properties'?'Group-background mentions do not establish a ProFood assignment. ':''}This does not establish every brand hiring channel or zero openings when no postings match. ${result.reason}`};
}
