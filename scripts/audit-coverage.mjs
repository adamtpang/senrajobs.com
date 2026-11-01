// Rebuild the working audit from current source data, never from old totals.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {compileRoles} from '../board-data.mjs';
import {discoveryReports} from '../discovery-reports.mjs';
import {associationEvidence} from '../association-evidence.mjs';
const normalize=s=>String(s).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const xmlText=s=>String(s||'').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&apos;|&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>');
const field=(item,key)=>xmlText(item.match(new RegExp(`<${key}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${key}>`))?.[1]);
export function reconcileFeed(xml,guests){
 const items=[...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/g)].map(m=>m[1]);
 if(!items.length)throw Error('Official feed contains no parseable items');
 const interviews=[],excluded=[],unresolved=[];
 for(const item of items){
  const title=field(item,'title'),guid=field(item,'guid'),date=field(item,'pubDate'),url=field(item,'link');
  if(title==='Welcome to David Senra'){excluded.push({title,guid,reason:'Show trailer'});continue;}
  const suffix=title.includes('|')?title.split('|').at(-1):title;
  const matches=guests.filter(g=>normalize(suffix).includes(normalize(g.name))||(g.name==='David Heinemeier Hansson'&&title.startsWith('DHH:')));
  const row={title,guid,date,url};
  if(matches.length!==1){unresolved.push({...row,matches:matches.map(g=>g.name)});continue;}
  interviews.push({...row,guest:matches[0].name});
 }
 const seen=new Set();const duplicateGuids=[];
 for(const row of [...interviews,...unresolved,...excluded]){if(!row.guid||seen.has(row.guid))duplicateGuids.push(row.guid||'(missing)');seen.add(row.guid);}
 const census=guests.map(g=>({guest:g.name,episodes:interviews.filter(e=>e.guest===g.name)}));
 return {items:items.length,interviewEpisodes:interviews.length+unresolved.length,distinctMatchedGuests:new Set(interviews.map(e=>e.guest)).size,excluded,unresolved,duplicateGuids,census,registryWithoutFeedEvidence:census.filter(g=>!g.episodes.length).map(g=>g.guest),reconciled:!unresolved.length&&!duplicateGuids.length&&census.every(g=>g.episodes.length)};
}
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sha=s=>createHash('sha256').update(s).digest('hex');
export async function audit({output='.cache/coverage-current',feedFile}={}){
 fs.mkdirSync(output,{recursive:true});
 const source='https://feeds.megaphone.fm/david-senra';let xml,receipt;
 if(feedFile){xml=fs.readFileSync(feedFile,'utf8');receipt={source,file:feedFile,observedAt:null,note:'Cached fixture/input; audit generation is not a new feed observation.'};}
 else{const r=await fetch(source,{signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error(`Official feed HTTP ${r.status}`);xml=await r.text();receipt={source,finalUrl:r.url,status:r.status,observedAt:new Date().toISOString()};}
 fs.writeFileSync(path.join(output,'feed.xml'),xml);receipt.sha256=sha(xml);
 const read=name=>JSON.parse(fs.readFileSync(name,'utf8'));
 const guests=read('guests.json'),jobs=read('jobs.json'),roles=compileRoles(guests,jobs),generatedAt=new Date().toISOString();
 const feed=reconcileFeed(xml,guests),{coverage}=discoveryReports(guests,jobs,roles,generatedAt);
 const research=fs.readFileSync('GUESTS.md','utf8');
 const sections=new Map(research.split(/^## /m).slice(1).map(s=>[s.split(/ \(episodes?:/)[0],s.trim()]));
 for(const g of guests){
  const names=[...(sections.get(g.name)||'').matchAll(/^- ([^:]+?): (.+)$/gm)].map(m=>m[1]);
  if(JSON.stringify(names)!==JSON.stringify(g.companies.map(c=>c.name)))throw Error(`Research/registry drift for ${g.name}; run node build.mjs before auditing.`);
 }
 const relationshipEvidence=associationEvidence(guests,read('employer-associations.json'));
 const associations=guests.flatMap(g=>g.companies.map(c=>{
  const board=jobs[c.name],historical=c.note==='acquired or closed';
  const matched=roles.filter(r=>(r.companyAssociations||[r.company]).includes(c.name));
  return {guest:g.name,company:c.name,careers:c.careers||board?.careersUrl||null,note:c.note||null,connection:c.connection||null,episode:g.episode.url,research:sections.get(g.name)||null,status:historical?'historical/successor review':board?.coverage?.status||'link-only',indexed:matched.length,retained:matched.filter(r=>r.sourceStatus!=='current').length,sourceUrl:board?.sourceUrl||null,observedAt:board?.fetched||null,lastAttempt:board?.lastAttempt||null,coverage:board?.coverage||null,associationAudit:relationshipEvidence.get(g.name,c.name)};
 }));
 const summary={generatedAt,feedReceipt:receipt,guestCensusReconciled:feed.reconciled,registryGuests:guests.length,feedItems:feed.items,interviewEpisodes:feed.interviewEpisodes,distinctMatchedGuests:feed.distinctMatchedGuests,associationRows:associations.length,uniqueRoleUrls:roles.length,historicalAssociationRows:associations.filter(a=>a.status==='historical/successor review').length,coverageCounts:coverage.counts,associationEvidence:relationshipEvidence.summary,allEmployerAssociationsVerified:false,allHiringChannelsCollected:false,scope:'Official David Senra interview feed plus explicitly labeled episode subjects. Complete board status concerns only that source at its observation time. Acquired brands are not assumed closed. Parent and brand counts overlap; global role URLs are unique.',sourceHashes:Object.fromEntries(['GUESTS.md','guests.json','jobs.json','company-connections.json','employer-associations.json'].map(p=>[p,sha(fs.readFileSync(p))]))};
 for(const [name,data]of Object.entries({summary,feed,associations,coverage}))fs.writeFileSync(path.join(output,name+'.json'),JSON.stringify(data,null,2));
 const table=(rows,keys)=>`<div class="scroll"><table><thead><tr>${keys.map(k=>`<th>${esc(k)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${keys.map(k=>`<td>${esc(r[k])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
 const html=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SenraJobs coverage</title><style>body{margin:0;background:#faf9f6;color:#222;font:16px/1.55 system-ui}main{max-width:1100px;margin:auto;padding:40px 22px}h1{font:48px Georgia}summary{cursor:pointer;padding:18px 0}details{border-top:1px solid #ddd}table{border-collapse:collapse;font-size:14px;width:100%}td,th{text-align:left;padding:12px;border-bottom:1px solid #ddd;vertical-align:top}.scroll{overflow:auto}small{color:#666}a{color:inherit}</style><main><small>Working coverage audit · ${esc(generatedAt)}</small><h1>What is covered?</h1><p><strong>${guests.length} guests · ${roles.length.toLocaleString()} unique role URLs.</strong></p><p>Guest census ${feed.reconciled?'reconciled against the observed official feed':'has unresolved entries—see census below'}. Employer and hiring-channel coverage remains incomplete. This is a coverage audit, not a candidate ranking.</p><p>${esc(summary.scope)}</p><details open><summary>Sources needing attention</summary>${table(associations.filter(a=>a.status!=='complete').map(a=>({...a,reason:a.coverage?.reason||a.note||'No supported public feed'})),['guest','company','status','indexed','observedAt','reason'])}</details><details><summary>Guest census</summary>${table(feed.census.map(g=>({guest:g.guest,episodes:g.episodes.length})),['guest','episodes'])}<pre>${esc(JSON.stringify({unresolved:feed.unresolved,registryWithoutFeedEvidence:feed.registryWithoutFeedEvidence,duplicateGuids:feed.duplicateGuids},null,2))}</pre></details><details><summary>All recorded associations</summary>${table(associations,['guest','company','status','indexed','retained','observedAt'])}</details><p><a href="associations.json">Research and pagination evidence</a> · <a href="summary.json">Source hashes and summary</a> · <a href="feed.json">Feed reconciliation</a></p></main></html>`;
 fs.writeFileSync(path.join(output,'AUDIT.html'),html);
 console.log(JSON.stringify(summary,null,2));return summary;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 const arg=n=>process.argv.find(a=>a.startsWith(n+'='))?.slice(n.length+1);
 await audit({output:arg('--output'),feedFile:arg('--feed')});
}
