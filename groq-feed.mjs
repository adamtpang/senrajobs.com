// Import only recorded, rendered public Groq pages. Never infer closed roles from a partial capture.
const boardUrl='https://jobs.gem.com/groq';
const validUrl=value=>{try{const u=new URL(value);return u.origin==='https://jobs.gem.com'&&/^\/groq\/[A-Za-z0-9_-]+$/.test(u.pathname)&&!u.search&&!u.hash;}catch{return false;}};
const validDate=value=>typeof value==='string'&&Number.isFinite(Date.parse(value));
export function groqPay(text,url){
 const start=text.search(/\nCompensation:?\s*\n/);if(start<0)return [];
 const block=text.slice(start).split(/\n(?:#LI|US Job Posting|Non-US Job Postings)/)[0];
 const type=/total cash/i.test(block)?'Total cash including potential bonus':'Base salary';
 const currency=/specific to candidates located in the United States/i.test(block)?'USD':null;
 const values=[];
 for(const line of block.split('\n')){
  for(const m of line.matchAll(/\$([\d,]+(?:\.\d+)?)\s*(?:[-–]\s*\$([\d,]+(?:\.\d+)?))?\s*(\/hr|per hour|annually|per year)?/g)){
   const min=Number(m[1].replaceAll(',','')),max=Number((m[2]||m[1]).replaceAll(',',''));
   if(!Number.isFinite(min)||max<min)throw Error('Invalid Groq compensation');
   const level=line.match(/^\s*-\s*([^:]+):/)?.[1];
   values.push({min,max,currency,displayCurrency:'$',period:/hr|hour/.test(m[3]||'')?'hour':/annually|year/.test(m[3]||'')?'year':null,type,label:level||type,...(level?{level}:{}),publishedText:line.trim(),sourceUrl:url});
  }
 }
 return values;
}
export function parseGroqBrowserReceipt(listing,details){
 if(listing.sourceUrl!==boardUrl||!validDate(listing.observedAt))throw Error('Invalid Groq listing receipt');
 const total=Number(listing.text?.match(/Open positions\s*\(\s*(\d+)\s*\)/)?.[1]);
 if(!Number.isInteger(total)||!total||!Array.isArray(listing.rows)||!listing.rows.length)throw Error('Missing advertised Groq total');
 const seen=new Set(),byReq=new Map(),content={};
 for(const row of listing.rows){
  if(!validUrl(row.url)||seen.has(row.url)||!row.title||!row.department)throw Error('Invalid or duplicate Groq listing');seen.add(row.url);
  const d=details[row.url];if(!d||d.url!==row.url||d.title!==row.title||!validDate(d.observedAt))throw Error('Missing or mismatched Groq detail');
  const lines=d.text.split('\n').map(s=>s.trim()).filter(Boolean);
  if(lines[0]!=='View all jobs'||lines[1]!==row.title||lines[3]!==row.department||lines[4]!=='In office'||lines[5]!=='Full-time')throw Error('Unexpected Groq detail header');
  const id=d.text.match(/\nReq ID:\s*(R\d+)\s*$/)?.[1];if(!id)throw Error('Missing Groq requisition ID');
  const locations=lines[2].split(' • ').map(raw=>({raw,sourceUrl:row.url,observedAt:d.observedAt,source:'rendered-official-detail',confidence:'published'}));
  const advertisedLocations=row.attributes.split(/\s*•\s*/)[0].trim();
  if(locations.some(l=>!advertisedLocations.includes(l.raw)))throw Error('Listing/detail location mismatch');
  const text=d.text.split('\nReady to apply?')[0].trim();
  if(text.length<500||!text.includes('About Groq'))throw Error('Empty Groq requirements');
  content[row.url]={text,source:row.url,observedAt:d.observedAt,closed:false};
  const role={id,title:row.title,url:row.url,department:row.department,location:locations[0].raw,secondaryLocations:locations.slice(1).map(l=>l.raw),locations,workplace:'OnSite',employmentType:'Full-time',sourceStatus:'current',sourceUrl:boardUrl,observedAt:listing.observedAt,detailObservedAt:d.observedAt,locationSource:'rendered-official-detail',payRanges:groqPay(text,row.url),alternateUrls:[]};
  const existing=byReq.get(id);
  if(existing){
   if(existing.title!==role.title||existing.department!==role.department)throw Error('Conflicting identity for Groq requisition');
   existing.alternateUrls.push(role.url);
   for(const place of locations)if(!existing.locations.some(l=>l.raw===place.raw))existing.locations.push(place);
   existing.secondaryLocations=existing.locations.slice(1).map(l=>l.raw);
   // Each alias has its own preserved description; do not overwrite the primary with a different location variant.
  }else byReq.set(id,role);
 }
 if(seen.size>total)throw Error('Groq capture exceeds advertised total');
 const complete=seen.size===total,roles=[...byReq.values()];
 return {content,board:{source:'browser:groq',sourceUrl:boardUrl,careersUrl:boardUrl,fetched:listing.observedAt,roles,coverage:{status:complete?'complete':'partial',listingStatus:complete?'complete':'partial',total,uniqueRequisitions:roles.length,duplicatePostings:seen.size-roles.length,pages:1,observedAt:listing.observedAt,identityUrl:'https://groq.com/',method:'Rendered official public listing and every collected detail; requisition-ID deduplication',manual:true,automaticRefresh:false,detailCollected:seen.size,reason:`${seen.size}/${total} advertised postings captured; ${roles.length} distinct requisitions after matching exact requisition ID, title and department. Location aliases retained. Manual observation; additional hiring channels are not certified. Salary periods are not inferred.`,pageReceipts:[{url:boardUrl,page:1,total,rows:seen.size}],unknownLocations:0}}};
}
