import { texasEvidence,isUSRemotePossibility,isLocationUnknown,locationValues } from './location-utils.mjs';
export function discoveryReports(guests,jobs,roles,generatedAt=new Date().toISOString()) {
 const companies=new Map();
 for(const guest of guests)for(const company of guest.companies){
  if(company.note==='acquired or closed')continue;
  const name=company.name.split(' (')[0];
  if(!companies.has(name))companies.set(name,{company:name,founders:[],connections:[],boards:[]});
  const row=companies.get(name);if(!row.founders.includes(guest.name))row.founders.push(guest.name);
  if(company.connection&&!row.connections.some(c=>c.guest===guest.name))row.connections.push({guest:guest.name,...company.connection});
  if(!row.boards.some(board=>board.association===company.name)){
   const board=jobs[company.name];
   row.boards.push({association:company.name,careersUrl:company.careers||board?.careersUrl||null,source:board?.source||null,sourceUrl:board?.sourceUrl||null,observedAt:board?.fetched||null,lastAttempt:board?.lastAttempt||board?.coverage?.lastAttempt||board?.fetched||null,...(board?.coverage||{status:'link-only',listingStatus:'link-only',reason:'No indexed public board'})});
  }
 }
 const severity={complete:0,'link-only':1,partial:2,failed:3};
 for(const company of companies.values()){
  const records=roles.filter(role=>(role.companyAssociations||[role.company]).some(name=>name.split(' (')[0]===company.company));
  company.status=company.boards.reduce((status,board)=>(severity[board.status]??2)>severity[status]?board.status:status,'complete');
  company.roles=records.length;company.texasRoles=records.filter(role=>texasEvidence(role).length).length;
  company.usRemotePossibilities=records.filter(isUSRemotePossibility).length;company.unknownLocations=records.filter(isLocationUnknown).length;
  company.staleRoles=records.filter(role=>role.sourceStatus!=='current').length;
 }
 const rows=[...companies.values()].sort((a,b)=>a.company.localeCompare(b.company));
 const counts={employers:rows.length,roles:roles.length,texasRoles:roles.filter(role=>texasEvidence(role).length).length,usRemotePossibilities:roles.filter(isUSRemotePossibility).length,unknownLocations:roles.filter(isLocationUnknown).length,staleRoles:roles.filter(role=>role.sourceStatus!=='current').length};
 for(const status of ['complete','partial','failed','link-only'])counts[status]=rows.filter(row=>row.status===status).length;
 const coverage={generatedAt,counts,scope:'Employers associated with guests and explicitly labeled episode subjects. The legacy founders field names connected interview guests, not necessarily company founders; connections identifies indirect episode-subject links. Complete means the supported public listing was retrieved at observation time, not that every company hiring channel is covered. Unpublished or inaccessible jobs are excluded.',limits:{maximumPagesPerBoard:500,defaultDetailAttemptsPerBoard:75,detailAttemptsScope:'The routine refresh defaults to 75 details; focused collection can check every role. Each board records actual attempts in enrichment.',locationInference:'Published job locations only; never headquarters or company biographies'},companies:rows};
 const project=role=>({company:role.company.split(' (')[0],companyAssociations:role.companyAssociations,founders:role.founders.map(founder=>founder.name),connections:role.founders.filter(f=>f.connection).map(f=>({guest:f.name,...f.connection})),id:role.id||null,title:role.title,officialUrl:role.url,location:role.location||'',rawLocation:role.rawLocation??role.location,secondaryLocations:role.secondaryLocations||[],allLocations:role.locations?.length?role.locations:locationValues(role).map(raw=>({raw,sourceUrl:role.sourceUrl,observedAt:role.observedAt,confidence:'legacy'})),workplace:role.workplace||'Unspecified',workplaceEvidence:role.workplaceEvidence||null,publishedPay:role.pay||null,payType:role.payType||(role.pay?'Salary':role.payRanges?.[0]?.type||null),publishedPayRanges:role.payRanges||[],sourceUrl:role.sourceUrl,observedAt:role.observedAt,lastAttempt:role.lastAttempt,sourceStatus:role.sourceStatus,coverageStatus:role.coverage.status,coverageReason:role.coverage.reason||null,texasEvidence:texasEvidence(role)});
 const inventory={generatedAt,counts,disclosure:'Texas results use explicit Texas/TX or known Texas city names in published job locations, including secondary locations. City-name shorthand should be confirmed on the official posting. US-remote possibilities are separate and do not assert Texas eligibility. Incomplete/failed boards and stale records mean this inventory is not exhaustive.',texasRoles:roles.filter(role=>texasEvidence(role).length).map(project),usRemotePossibilities:roles.filter(isUSRemotePossibility).map(project)};
 const markdown=`# Public location coverage\n\nObserved ${generatedAt}.\n\n${counts.employers} employers; ${counts.complete} complete, ${counts.partial} partial, ${counts.failed} failed, ${counts['link-only']} link-only. ${counts.roles} unique role URLs; ${counts.texasRoles} Texas-location roles, ${counts.usRemotePossibilities} US-remote possibilities (Texas eligibility unconfirmed), ${counts.unknownLocations} unknown locations, ${counts.staleRoles} stale/retained roles.\n\nThis is not an exhaustive inventory of all Texas jobs. No headquarters-based location inference is used. Read data/coverage.json for source URLs, timestamps, pagination and detail limits.\n\n| Employer | Coverage | Roles | Texas | US remote possibilities | Unknown | Source limitation |\n|---|---|---:|---:|---:|---:|---|\n`+rows.map(row=>`| ${row.company} | ${row.status} | ${row.roles} | ${row.texasRoles} | ${row.usRemotePossibilities} | ${row.unknownLocations} | ${row.boards.map(board=>board.reason||'Public listing retrieved').join('; ').replace(/\|/g,'/')} |`).join('\n')+'\n';
 return {coverage,inventory,markdown};
}
