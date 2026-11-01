// Bounded import of rendered public ADP evidence; no authenticated API or refresh claim.
export function importAdpBrowser({identity,list,details}){
 const source=new URL(identity.careers);
 if(source.origin!=='https://workforcenow.adp.com'||source.pathname!=='/mascsr/default/mdf/recruitment/recruitment.html')throw Error('Invalid ADP source');
 const total=list.heading?.match(/^Current Openings \((\d+) of (\d+)\)$/);
 if(!total||total[1]!==total[2]||list.rows.length!==Number(total[2])||details.length!==list.rows.length)throw Error('Incomplete public ADP listing');
 const seen=new Set(),cards=new Set(),content={},observedAt=list.observedAt;
 if(!Number.isFinite(Date.parse(observedAt)))throw Error('Missing observation date');
 const roles=details.map(d=>{
  const url=new URL(d.url),card=list.rows.find(r=>r.id===d.card.id);
  if(!card||cards.has(card.id)||d.title!==card.title||!d.text.startsWith(d.title+'\n')||d.text.length<100||!Number.isFinite(Date.parse(d.observedAt)))throw Error('Invalid ADP detail identity');
  cards.add(card.id);
  for(const key of ['cid','ccId'])if(url.searchParams.get(key)!==source.searchParams.get(key))throw Error('Wrong ADP employer');
  if(url.origin!==source.origin||url.pathname!==source.pathname||!/^\d+$/.test(url.searchParams.get('jobId')||''))throw Error('Invalid public ADP job URL');
  url.searchParams.delete('selectedMenuKey');url.hash='';if(seen.has(url.href))throw Error('Duplicate ADP job');seen.add(url.href);
  const location=card.text.split('\n')[1]?.trim(),header=d.text.split('\nApply\n')[0],req=header.match(/Requisition ID:\s*(\d+)/)?.[1];
  if(!location||!header.includes(location)||!req)throw Error('ADP detail/header mismatch');
  const salary=d.text.match(/\nSalary(?: Range)?:\s*\n\$([\d,.]+)(?:\s+To\s+\$([\d,.]+))?\s+(Hourly|Annually)\b/i),payRanges=[];
  if(salary){const min=Number(salary[1].replaceAll(',','')),max=Number((salary[2]||salary[1]).replaceAll(',',''));if(min>0&&max>=min)payRanges.push({min,max,currency:null,displayCurrency:'$',period:/hour/i.test(salary[3])?'hour':'year',type:'Salary',location,sourceUrl:url.href,publishedText:salary[0].trim()});}
  content[url.href]={text:d.text.split('Copyright ©')[0].trim(),closed:false,source:url.href,observedAt:d.observedAt,extraction:'rendered-public-adp-detail'};
  return {id:url.searchParams.get('jobId'),requisitionId:req,title:d.title,url:url.href,sourceUrl:source.href,observedAt,detailObservedAt:d.observedAt,sourceStatus:'current',location,locations:[{raw:location,sourceUrl:url.href,observedAt:d.observedAt,source:'role-detail',confidence:'published'}],locationStatus:'published',department:d.text.split('\n')[1],employmentType:header.match(/\b(Full Time|Part Time)\b/)?.[1]||'',postedAge:card.text.split('\n')[2]?.replace(/(?:Full|Part) Time$/,'').trim(),pay:null,payRanges};
 });
 return {board:{source:'manual:adp-public-browser',sourceUrl:source.href,careersUrl:source.href,fetched:observedAt,roles,coverage:{status:'complete',listingStatus:'complete',observedAt,total:roles.length,collected:roles.length,pages:1,detailCollected:roles.length,identityUrl:identity.source,reason:`All ${roles.length} visible openings and matching public descriptions collected. Manual browser observation; no automatic refresh adapter. Completeness applies only to this public employer board at observation time.`,pageReceipts:[{url:list.url,observedAt,advertised:roles.length,collected:roles.length,method:'rendered-public-browser'}]}},content};
}
