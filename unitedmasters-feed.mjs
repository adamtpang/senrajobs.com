const slug='unitedmasterstranslation',endpoint=`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`;
const plain=value=>{let s=String(value||'');for(let i=0;i<3;i++)s=s.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&nbsp;/g,' ');return s.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();};
export function parseUnitedMasters(data,hierarchy,observedAt,mapJob){
 if(!Array.isArray(data?.jobs)||!Array.isArray(hierarchy?.departments))throw Error('Public jobs or department hierarchy missing');
 const departments=new Map(hierarchy.departments.map(d=>[d.id,d]));
 const rootName=id=>{const seen=new Set();while(departments.has(id)&&!seen.has(id)){seen.add(id);const d=departments.get(id);if(d.parent_id==null)return d.name;id=d.parent_id;}return null;};
 const rows=[],seen=new Set();let invalid=0,unknownBrands=0,duplicates=0;
 for(const j of data.jobs){
  let u;try{u=new URL(j.absolute_url);}catch{}
  if(!j.id||typeof j.title!=='string'||!j.title.trim()||u?.protocol!=='https:'||!['job-boards.greenhouse.io','boards.greenhouse.io'].includes(u.hostname)||!u.pathname.startsWith(`/${slug}/jobs/`)){invalid++;continue;}
  if(seen.has(u.href)){duplicates++;continue;}seen.add(u.href);
  const brands=[...new Set((j.departments||[]).map(d=>rootName(d.id)))];
  const verified=brands.length===1&&['UnitedMasters','Translation','Shared Services'].includes(brands[0]);if(!verified)unknownBrands++;
  const {rawOfficeAssociations,rawLocation,...mapped}=mapJob('greenhouse',j,endpoint,observedAt,{kind:'greenhouse',slug});
  rows.push({...mapped,title:plain(j.title),employerBrand:verified?(brands[0]==='Shared Services'?'UnitedMasters / Translation shared services':brands[0]):'UnitedMasters / Translation (brand unspecified)',description:plain(j.content)});
 }
 const total=Number.isSafeInteger(data.meta?.total)?data.meta.total:null;
 return {rows,total,invalid,unknownBrands,duplicates,status:invalid||unknownBrands||duplicates||total===null||total!==rows.length?'partial':'complete',endpoint};
}
export async function fetchUnitedMasters({request,observedAt,mapJob}){
 const hierarchyUrl=`https://boards-api.greenhouse.io/v1/boards/${slug}/departments`;
 const [jobs,hierarchy]=await Promise.allSettled([request(endpoint),request(hierarchyUrl)]);
 if([jobs,hierarchy].some(r=>r.status!=='fulfilled'||!r.value.ok))return {rows:[],status:'failed',reason:'Public jobs or department hierarchy unavailable',endpoint,pages:1,observedAt};
 try{const p=parseUnitedMasters(jobs.value.data,hierarchy.value.data,observedAt,mapJob);return {...p,pages:1,observedAt,pageReceipts:[{url:endpoint,total:p.total,rows:p.rows.length},{url:hierarchyUrl,departments:hierarchy.value.data.departments.length}],reason:p.status==='complete'?'Shared public board exhausted; employer brands follow the published department hierarchy.':`Public board has ${p.invalid} invalid, ${p.duplicates} duplicate and ${p.unknownBrands} unassigned-brand records; verify total.`};}catch(e){return {rows:[],status:'failed',reason:e.message,endpoint,pages:1,observedAt};}
}
