// Only extract explicitly labeled annual base salary. Variable incentives,
// total target earnings, benefits and location-wide estimates are not salary.
export function uberBasePay(text,sourceUrl){
 const url=new URL(sourceUrl);if(url.origin!=='https://jobs.uber.com'||!/^\/en\/jobs\/\d+\/$/.test(url.pathname))throw Error('Invalid Uber pay source');
 const ranges=[];
 const blocks=[...String(text).matchAll(/For\s+([^:]{1,100}?)-based roles:\s*([\s\S]*?)(?=For\s+[^:]{1,100}?-based roles:|$)/gi)];
 for(const block of blocks){
  const salary=block[2].match(/(?:base salary range for this (?:role|position) is|includes a base salary range of)\s+(USD|CAD|EUR|GBP)\s*\$?([\d,]+(?:\.\d+)?)\s+per year\s*[-–]\s*\1\s*\$?([\d,]+(?:\.\d+)?)\s+per year/i);
  if(!salary)continue;
  const min=Number(salary[2].replaceAll(',','')),max=Number(salary[3].replaceAll(',',''));
  if(!Number.isFinite(min)||min<=0||max<min)continue;
  const location=block[1].trim();
  ranges.push({min,max,currency:salary[1].toUpperCase(),period:'year',type:'Base salary',location,sourceUrl,publishedText:salary[0]});
 }
 return [...new Map(ranges.map(r=>[JSON.stringify([r.location,r.min,r.max,r.currency]),r])).values()];
}
