// Public Workday search can cap an unfiltered result at 2,000. Enumerate
// published facets only when independent facet totals corroborate coverage.
export async function fetchWorkday(source,{request,mapJob,maxPages=500,observedAt=new Date().toISOString()}={}){
 const [tenant,wd,site]=source.slug.split('|');
 if(!/^[a-z0-9-]+$/.test(tenant)||!/^wd\d+$/.test(wd)||!/^\w[\w-]*$/.test(site))throw Error('Invalid Workday source');
 const endpoint=`https://${tenant}.${wd}.myworkdayjobs.com/wday/cxs/${tenant}/${site}/jobs`;
 const pageReceipts=[],rows=new Map(),issues=[];let invalid=0,duplicates=0,pages=0;
 async function page(facets,offset){
  if(pages>=maxPages){issues.push(`Page limit ${maxPages} reached`);return null;}
  const result=await request(endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({appliedFacets:facets,limit:20,offset,searchText:''})});pages++;
  const items=result.data?.jobPostings;
  pageReceipts.push({url:endpoint,page:pages,offset,appliedFacets:facets,total:result.data?.total??null,rows:Array.isArray(items)?items.length:0,status:result.status??null});
  if(!result.ok||!Array.isArray(items)){issues.push(result.error||'Unexpected Workday page');return null;}
  return result.data;
 }
 function collect(items,local){
  for(const item of items){
   if(!item||typeof item.title!=='string'||!item.title.trim()||typeof item.externalPath!=='string'||!item.externalPath.startsWith('/job/')||/[?#]/.test(item.externalPath)){invalid++;continue;}
   const row=mapJob('workday',item,endpoint,observedAt,source);
   if(local.has(row.url)){duplicates++;continue;}local.add(row.url);rows.set(row.url,row);
  }
 }
 async function exhaust(facets,first,expected){
  const local=new Set();let data=first,offset=0;
  while(data){
   const before=local.size;collect(data.jobPostings,local);
   if(!data.jobPostings.length)break;
   if(local.size===before){issues.push('Repeated or invalid Workday page');break;}
   offset+=20;
   if(Number.isFinite(expected)&&offset>=expected)break;
   data=await page(facets,offset);
  }
  if(local.size!==expected)issues.push(`Partition retrieved ${local.size} of ${expected} advertised jobs`);
  return local;
 }
 const first=await page({},0);
 if(!first)return {status:'failed',rows:[],endpoint,reason:issues.join('; '),pages,pageReceipts,observedAt};
 const rootTotal=first.total;
 if(!Number.isSafeInteger(rootTotal)||rootTotal<0)return {status:'failed',rows:[],endpoint,reason:'Invalid advertised Workday total',pages,pageReceipts,observedAt};
 const facets=(first.facets||[]).filter(f=>f.facetParameter&&Array.isArray(f.values)&&f.values.length&&f.values.every(v=>typeof v.id==='string'&&Number.isSafeInteger(v.count)&&v.count>=0));
 const sum=f=>f.values.reduce((n,v)=>n+v.count,0);
 const suspectedCap=rootTotal>=2000||facets.some(f=>sum(f)>rootTotal);
 let total=rootTotal,partition=null;
 if(suspectedCap){
  partition=facets.filter(f=>sum(f)>rootTotal&&f.values.every(v=>v.count<2000)).sort((a,b)=>a.values.length-b.values.length)[0];
  if(partition){
   total=sum(partition);
   if(!facets.some(f=>f!==partition&&sum(f)===total))issues.push('Partition total lacks independent facet corroboration');
   for(const value of partition.values){
    if(!value.count)continue;
    const selected={[partition.facetParameter]:[value.id]},data=await page(selected,0);
    if(!data)continue;
    if(data.total!==value.count)issues.push(`Facet ${value.descriptor||value.id} total changed`);
    await exhaust(selected,data,value.count);
   }
   const rootUrls=first.jobPostings.filter(x=>x?.externalPath).map(x=>mapJob('workday',x,endpoint,observedAt,source).url);
   if(rootUrls.some(url=>!rows.has(url)))issues.push('Unfiltered page contains jobs outside collected facets');
   if(rows.size!==total)issues.push(`Facet union ${rows.size} does not match corroborated total ${total}`);
   const last=await page({},0);
   const after=last?.facets?.find(f=>f.facetParameter===partition.facetParameter);
   if(!after||JSON.stringify(after.values.map(v=>[v.id,v.count]).sort())!==JSON.stringify(partition.values.map(v=>[v.id,v.count]).sort()))issues.push('Facet counts changed during collection');
  }else{
   await exhaust({},first,rootTotal);issues.push('Possible search cap; no fully collectable facet partition found');
  }
 }else await exhaust({},first,rootTotal);
 if(invalid)issues.push(`${invalid} malformed advertised records excluded`);
 if(duplicates)issues.push(`${duplicates} repeated records within pagination`);
 const status=issues.length?'partial':'complete';
 return {rows:[...rows.values()],status,reason:issues.join('; ')||(partition?`Collected all ${total} jobs through ${partition.values.length} public ${partition.facetParameter} facets; unfiltered search capped at ${rootTotal}. Independent facet totals and final counts agree.`:''),total,pages,endpoint,observedAt,pageReceipts,partitionReceipt:partition?{facet:partition.facetParameter,unfilteredTotal:rootTotal,expectedTotal:total,uniqueCollected:rows.size,values:partition.values.map(({id,descriptor,count})=>({id,descriptor,count})),scope:'Published search facets at observation time; other employer hiring channels are not implied.'}:null};
}
