// Validate manual observations of Tesla's public virtual list. No hidden app state.
export function parseTeslaBrowserReceipt(receipt) {
  const source=new URL(receipt.source);
  if(source.origin!=='https://www.tesla.com'||source.pathname!=='/careers/search/'||!Number.isFinite(Date.parse(receipt.observedAt)))throw Error('Tesla source receipt invalid');
  const texas=source.searchParams.get('site')==='US'&&source.searchParams.get('state')==='TX';
  const global=!source.search;
  if(!texas&&!global)throw Error('Unsupported observed Tesla filter scope');
  if(texas&&(receipt.filters?.site!=='US'||receipt.filters?.state!=='TX')||global&&receipt.filters!==0)throw Error('Tesla filter receipt mismatch');
  if(!Number.isSafeInteger(receipt.total)||receipt.total<1||!Array.isArray(receipt.rows))throw Error('Tesla advertised total missing');
  const indices=new Set(),byUrl=new Map();
  for(const row of receipt.rows){
    if(!Number.isSafeInteger(row.index)||row.index<0||row.index>=receipt.total||indices.has(row.index))throw Error('Invalid or duplicate Tesla row position');
    indices.add(row.index);
    const url=new URL(row.url),id=url.pathname.match(/^\/careers\/search\/job\/[a-z0-9-]*-(\d+)$/)?.[1];
    if(url.origin!==source.origin||!id||url.search||url.hash)throw Error('Invalid Tesla job URL');
    const lines=String(row.text||'').split('\n').map(s=>s.trim()).filter(Boolean),meta=lines[1]?.match(/^(.+?)\s*・\s*(.+)$/);
    if(![3,4].includes(lines.length)||!lines[0]||!meta||lines.at(-1)!=='Learn More')throw Error('Unrecognized Tesla card structure');
    const raw=lines.length===4?lines[2]:'';
    if(texas&&!/\bTexas\b/i.test(raw))throw Error('Non-Texas location in Texas receipt');
    const location=raw?{raw,source:'employer-public-page',sourceUrl:source.href,observedAt:receipt.observedAt,confidence:'published'}:null;
    const old=byUrl.get(url.href);
    if(old){if(old.title!==lines[0]||old.department!==meta[1]||old.jobType!==meta[2])throw Error('Conflicting Tesla job identity');if(location&&!old.locations.some(l=>l.raw===location.raw))old.locations.push(location);continue;}
    byUrl.set(url.href,{id,title:lines[0],url:url.href,sourceUrl:source.href,observedAt:receipt.observedAt,sourceStatus:'current',department:meta[1],jobType:meta[2],location:raw,locations:location?[location]:[],locationStatus:raw?'published':'unknown',pay:null});
  }
  const complete=indices.size===receipt.total;
  if(!receipt.steps?.length||receipt.steps.some(s=>!Number.isFinite(s.y)||!Number.isInteger(s.first)||!Number.isInteger(s.last)||s.first>s.last))throw Error('Tesla rendered-row receipts missing');
  for(const index of indices)if(!receipt.steps.some(s=>index>=s.first&&index<=s.last))throw Error('Tesla row has no scroll observation');
  return {rows:[...byUrl.values()].map(r=>({...r,secondaryLocations:r.locations.slice(1).map(l=>l.raw)})),scope:texas?'Texas, US':'Global',total:receipt.total,renderedRows:indices.size,complete,sourceUrl:source.href,observedAt:receipt.observedAt,method:receipt.method,scrollObservations:receipt.steps.length};
}

export function mergeTeslaBrowserReceipts(receipts) {
  const parsed=receipts.map(parseTeslaBrowserReceipt),byUrl=new Map();
  for(const part of parsed)for(const row of part.rows){const old=byUrl.get(row.url);if(old&&old.title!==row.title)throw Error('Tesla cross-scope title mismatch');if(!old)byUrl.set(row.url,row);else for(const l of row.locations)if(!old.locations.some(x=>x.raw===l.raw))old.locations.push(l);}
  const all=parsed.find(p=>p.scope==='Global'&&p.complete),observedAt=parsed.map(p=>p.observedAt).sort().at(-1),globalTotal=parsed.find(p=>p.scope==='Global')?.total;
  const roles=[...byUrl.values()].map(r=>({...r,location:r.locations[0]?.raw||'',locationStatus:r.locations.length?'published':'unknown',secondaryLocations:r.locations.slice(1).map(l=>l.raw)}));
  const unknownLocations=roles.filter(r=>!r.locations.length).length;
  return {source:'manual:tesla-public-browser',sourceUrl:'https://www.tesla.com/careers/search/',careersUrl:'https://www.tesla.com/careers/search/',fetched:observedAt,lastAttempt:observedAt,roles,coverage:{status:all&&!unknownLocations?'complete':'partial',listingStatus:all?'complete':'partial',total:globalTotal??null,collected:roles.length,unknownLocations,observedAt,lastAttempt:observedAt,reason:parsed.map(p=>`${p.scope}: ${p.renderedRows}/${p.total} displayed rows (${p.complete?'complete listing subset':'incomplete'}).`).join(' ')+` ${unknownLocations} locations unresolved. Descriptions remain incomplete; manual browser observation, no automatic refresh adapter.`,pageReceipts:parsed.map(({rows,...p})=>p)}};
}

export function teslaDetailContent(role, detail) {
  if(detail?.title!==role.title||!Number.isFinite(Date.parse(detail.observedAt))||!detail.fields?.some(r=>r[0]==='Req. ID'&&r[1]===role.id)||!detail.text?.match(/What You[’']ll Bring/))throw Error('Tesla detail identity or requirements mismatch');
  return {text:detail.text,source:role.url,observedAt:detail.observedAt,closed:false,extraction:'rendered-public-employer-detail'};
}
