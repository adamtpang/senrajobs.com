// Snap publishes US salary bands by pay zone. Preserve those scopes; never
// assign a zone to Austin (or another city) merely from its state or currency.
export function snapPay(html,sourceUrl){
 const url=new URL(sourceUrl);
 if(url.origin!=='https://snapchat.wd1.myworkdayjobs.com'||!url.pathname.startsWith('/wday/cxs/snapchat/snap/job/'))throw Error('Invalid Snap compensation source');
 const text=String(html||'').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/\s+/g,' ');
 if(!/In the United States, work locations are assigned a pay zone/i.test(text))return [];
 const ranges=[];
 for(const m of text.matchAll(/\b(Zone [ABC](?:\s*\([^)]*\))?)\s*:\s*The base salary range for this position is \$([\d,]+(?:\.\d+)?)\s*[-–]\s*\$([\d,]+(?:\.\d+)?)\s+annually\b/gi)){
  const min=Number(m[2].replaceAll(',','')),max=Number(m[3].replaceAll(',',''));
  if(!Number.isFinite(max)||min<=0||max<min)continue;
  ranges.push({min,max,currency:'USD',period:'year',type:'Base salary',location:'US '+m[1],sourceUrl,publishedText:m[0],zoneSourceUrl:'https://careers.snap.com/us-payzones'});
 }
 return [...new Map(ranges.map(r=>[JSON.stringify([r.location,r.min,r.max]),r])).values()];
}
