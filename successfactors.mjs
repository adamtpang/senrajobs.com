// Public server-rendered search pages. Follow only pagination links the site emits.
const decode=s=>String(s||'').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&nbsp;/g,' ').replace(/&#(\d+);/g,(_,n)=>Number(n)<=0x10ffff?String.fromCodePoint(Number(n)):'');
const plain=s=>decode(s).replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
export function parseSuccessFactors(html,pageUrl,observedAt){
 const page=new URL(pageUrl),summary=plain(html).match(/Results\s+([\d,]+)\s*[–—-]\s*([\d,]+)\s+of\s+([\d,]+)/i);
 if(!summary)throw Error('Public pagination summary missing');
 const [start,end,total]=summary.slice(1).map(x=>Number(x.replaceAll(',','')));
 const cards=[...html.matchAll(/<tr\b[^>]*class="[^"]*\bdata-row\b[^"]*"[^>]*>([\s\S]*?)<\/tr>/g)];
 const rows=[];let invalid=0;
 for(const [,card]of cards){
  const link=[...card.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].find(([,attrs])=>/class="[^"]*\bjobTitle-link\b/.test(attrs));
  const href=link?.[1].match(/href="([^"]+)"/)?.[1];
  const title=plain(link?.[2]);let url;try{url=new URL(decode(href),page);}catch{}
  const raw=plain(card.match(/<td\b[^>]*class="[^"]*\bcolLocation\b[^"]*"[^>]*>([\s\S]*?)<\/td>/)?.[1]);
  const date=plain(card.match(/<span class="jobDate"[^>]*>([\s\S]*?)<\/span>/)?.[1]);
  if(!href||!title||!url||url.origin!==page.origin||!url.pathname.startsWith('/job/')){invalid++;continue;}
  rows.push({id:url.pathname.split('/').filter(Boolean).at(-1),title,url:url.href,location:raw,locations:raw?[{raw,sourceUrl:page.href,observedAt,source:'employer-public-page',confidence:'published'}]:[],locationStatus:raw?'published':'unknown',locationSource:'employer-public-page',sourceUrl:page.href,observedAt,sourceStatus:'current',publishedAt:date,workplace:''});
 }
 const links=[...html.matchAll(/href="([^"]*startrow=[^\"]*)"/g)].map(m=>new URL(decode(m[1]),page)).filter(u=>u.origin===page.origin&&u.pathname===page.pathname&&Number(u.searchParams.get('startrow'))===end);
 return {rows,start,end,total,next:links[0]?.href||null,invalid};
}
export async function fetchSuccessFactors(source,{request,observedAt,maxPages=500}){
 if(!['gxo','xpo'].includes(source.slug))throw Error('Unsupported SuccessFactors employer');
 const endpoint=`https://jobs.${source.slug}.com/search/`;
 let url=endpoint,pages=0,total=null,status='complete',reason='',expected=0,finished=false;
 const rows=[],seen=new Set(),receipts=[],seenPages=new Set();
 while(url&&pages<maxPages){
  if(seenPages.has(url)){status='partial';reason='Pagination repeated a page URL';break;}seenPages.add(url);
  const result=await request(url);pages++;
  if(!result.ok){status=rows.length?'partial':'failed';reason=result.error||'Public search unavailable';break;}
  let parsed;try{parsed=parseSuccessFactors(result.text,url,observedAt);}catch(e){status=rows.length?'partial':'failed';reason=e.message;break;}
  receipts.push({url,start:parsed.start,end:parsed.end,total:parsed.total,rows:parsed.rows.length});
  if(total!==null&&total!==parsed.total){status='partial';reason='Advertised total changed during pagination';}total=parsed.total;
  if(parsed.start!==expected+1&&!(total===0&&parsed.start===0)){status='partial';reason='Unexpected page range';break;}
  if(parsed.invalid){status='partial';reason=`Malformed public job rows on page ${pages}`;}
  let added=0;for(const row of parsed.rows)if(!seen.has(row.url)){seen.add(row.url);rows.push(row);added++;}
  if(parsed.end>=total){finished=true;break;}
  if(!added||!parsed.next){status='partial';reason=!added?'Repeated or empty result page':'Next page link missing before advertised total';break;}
  expected=parsed.end;url=parsed.next;
 }
 if(!finished&&status==='complete'){status='partial';reason='Pagination bound reached';}
 if(status==='complete'&&rows.length!==total){status='partial';reason='Unique listing count differs from advertised total';}
 return {rows,status,reason,total,pages,endpoint,observedAt,pageReceipts:receipts};
}
