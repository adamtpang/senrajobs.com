// Import only role cards rendered on the official public careers page.
// Browser expansion receipts are evidence, not an automatic refresh adapter.
const endpoint='https://www.revolut.com/careers/';
function cardFields(text,sourceUrl,observedAt){
  const [title,...lines]=String(text||'').split('\n').map(s=>s.trim()).filter(Boolean);
  if(!title||/^(Office|Remote):/.test(title))throw Error('Revolut title missing');
  const office=[],remote=[];let hidden=0;
  for(const line of lines){
    const extra=line.match(/^\+(\d+)$/);if(extra){hidden+=Number(extra[1]);continue;}
    const match=line.match(/^(Office|Remote):\s*(.+)$/);if(!match)throw Error('Unrecognized Revolut location label');
    (match[1]==='Office'?office:remote).push(...match[2].split(' · ').map(s=>s.trim()).filter(Boolean));
  }
  const locations=[...office.map(raw=>({raw,workplace:'Office'})),...remote.map(raw=>({raw,workplace:'Remote'}))].map(l=>({...l,source:'employer-public-page',sourceUrl,observedAt,confidence:'published'}));
  return {title,location:locations[0]?.raw||'',secondaryLocations:[...new Set(locations.slice(1).map(l=>l.raw))],locations,workplace:remote.length&&!office.length?'Remote':'',publishedOfficeLocations:office,publishedRemoteLocations:remote,remoteEligibility:remote.length?`Remote locations published by employer: ${remote.join(', ')}${hidden?'; additional locations not expanded':''}`:'',locationStatus:hidden?'partial':locations.length?'published':'unknown',unexpandedLocationCount:hidden};
}

export function revolutPay(text,sourceUrl){
  const block=String(text||'').match(/Compensation range\s*\n([\s\S]*?)(?:\n\s*\*Final compensation|\n\s*Building a global|$)/)?.[1]?.trim()||'';
  const ranges=[];
  for(const line of block.split('\n').map(x=>x.trim()).filter(Boolean)){
    const m=line.match(/^(.+?):\s*(PLN|USD|EUR|GBP|€|£|\$)\s*([\d,]+(?:\.\d+)?)\s*[-–]\s*(PLN|USD|EUR|GBP|€|£|\$)?\s*([\d,]+(?:\.\d+)?)\s+gross\s+(monthly|annually)\*?$/);
    if(!m||(m[4]&&m[2]!==m[4]))continue;
    const min=Number(m[3].replaceAll(',','')),max=Number(m[5].replaceAll(',',''));
    if(!Number.isFinite(min)||!Number.isFinite(max)||min<0||max<min)continue;
    const currency={PLN:'PLN',USD:'USD',EUR:'EUR',GBP:'GBP','€':'EUR','£':'GBP','$':null}[m[2]];
    ranges.push({min,max,currency,...(!currency?{displayCurrency:m[2]}:{}),period:m[6]==='monthly'?'month':'year',type:'Gross compensation',location:m[1],publishedText:line,sourceUrl});
  }
  return {pay:null,payRanges:ranges,...(block?{publishedCompensationText:block}:{})};
}

export function enrichRevolutDetails(board,details){
  let collected=0;const content={},failures=[];
  const rows=board.roles.map(role=>{
    const d=details[role.url];if(!d?.text){failures.push({url:role.url,reason:d?.error||'Detail not collected'});return role;}
    try{
      if(d.title?.trim()!==role.title||!Number.isFinite(Date.parse(d.observedAt))||!/^About the role$/im.test(d.text))throw Error('Detail identity or body mismatch');
      const fields=cardFields(d.header.split('Apply for this role')[0].trim(),role.url,d.observedAt);
      if(fields.title!==role.title)throw Error('Header identity mismatch');
      collected++;content[role.url]={text:d.text,closed:false,source:role.url,observedAt:d.observedAt,extraction:'rendered-public-employer-detail'};
      return {...role,...fields,...revolutPay(d.text,role.url),detailObservedAt:d.observedAt};
    }catch(e){failures.push({url:role.url,reason:e.message});return role;}
  });
  const unresolved=rows.filter(r=>r.locationStatus!=='published').length;
  return {board:{...board,roles:rows,coverage:{...board.coverage,status:failures.length||unresolved?'partial':'complete',truncatedLocations:rows.filter(r=>r.unexpandedLocationCount).length,detailCollected:collected,detailFailures:failures.length,reason:`All ${rows.length} displayed public listings collected; ${collected} matching public detail pages read and location controls expanded. ${unresolved} unresolved location records; ${failures.length} missing details. Manual browser observation, not an automatic refresh adapter.`,detailObservationEndedAt:Object.values(details).map(d=>d.observedAt).filter(Boolean).sort().at(-1)}},content,failures};
}
export function parseRevolutBrowserList(receipt){
  if(receipt.source!==endpoint||!Number.isFinite(Date.parse(receipt.observedAt)))throw Error('Revolut source receipt missing');
  const total=Number(receipt.heading?.match(/^We have (\d+) open positions$/)?.[1]);
  if(!Number.isSafeInteger(total)||total<1||!Array.isArray(receipt.roles))throw Error('Revolut advertised total missing');
  if(receipt.showMore!==false||receipt.roles.length!==total)throw Error('Revolut displayed listing not exhausted');
  const pages=receipt.pages||[];
  if(!pages.length||pages.at(-1).after!==total)throw Error('Revolut expansion receipt missing');
  for(let i=0;i<pages.length;i++){
    const p=pages[i];if(p.total!==receipt.heading||!Number.isSafeInteger(p.before)||p.after<=p.before||p.after-p.before>6||(i&&pages[i-1].after!==p.before))throw Error('Revolut expansion changed or repeated');
  }
  const seen=new Set();let truncatedLocations=0;
  const rows=receipt.roles.map(card=>{
    const url=new URL(card.url);
    if(url.origin!=='https://www.revolut.com'||!/^\/careers\/position\/[a-z0-9-]+\/$/.test(url.pathname)||url.search||url.hash||seen.has(url.href))throw Error('Invalid or duplicate Revolut listing URL');
    seen.add(url.href);
    const fields=cardFields(card.text,endpoint,receipt.observedAt);if(fields.unexpandedLocationCount)truncatedLocations++;
    return {id:url.pathname.split('/').filter(Boolean).at(-1),url:url.href,sourceUrl:endpoint,observedAt:receipt.observedAt,sourceStatus:'current',...fields,department:'',pay:null};
  });
  return {source:'manual:revolut-public-browser',sourceUrl:endpoint,careersUrl:endpoint,fetched:receipt.observedAt,lastAttempt:receipt.observedAt,roles:rows,coverage:{status:'partial',listingStatus:'complete',total,collected:rows.length,observedAt:receipt.observedAt,lastAttempt:receipt.observedAt,reason:`All ${total} displayed public listings collected through browser expansion; ${truncatedLocations} cards have additional locations not expanded. Descriptions and compensation not fully collected; no automatic refresh adapter.`,truncatedLocations,pageReceipts:[{url:endpoint,method:receipt.method,observedAt:receipt.observedAt,advertisedTotal:total,collected:rows.length,expansionSteps:pages.length+1,showMore:false}]}};
}
