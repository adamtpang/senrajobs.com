// Preserve the printed dollar symbol; country alone does not establish currency.
// A bonus is separate from the quoted salary, and an omitted interval stays unknown.
export function dysonPay(text,sourceUrl,location=''){
 const url=new URL(sourceUrl);
 if(url.origin!=='https://dyson.wd3.myworkdayjobs.com'||!url.pathname.startsWith('/wday/cxs/dyson/dyson_careers/job/'))throw Error('Invalid Dyson compensation source');
 const clean=String(text||'').replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/&#43;/g,'+').replace(/\s+/g,' '),ranges=[];
 for(const m of clean.matchAll(/\b(Salary|Compensation)\s*:\s*\$([\d,]+(?:\.\d+)?)\s*[-–]\s*\$?([\d,]+(?:\.\d+)?)(\s+(?:annually|per year|per hour|hourly))?/gi)){
  const min=Number(m[2].replaceAll(',','')),max=Number(m[3].replaceAll(',',''));
  if(min<=0||max<min||!Number.isFinite(max))continue;
  const interval=m[4]?.trim().toLowerCase(),period=interval?(/hour/.test(interval)?'hour':'year'):null;
  ranges.push({min,max,currency:null,displayCurrency:'$',period,type:m[1].toLowerCase()==='salary'?'Salary':'Compensation',location,sourceUrl,publishedText:m[0]});
 }
 return [...new Map(ranges.map(r=>[JSON.stringify([r.min,r.max,r.period,r.location]),r])).values()];
}
