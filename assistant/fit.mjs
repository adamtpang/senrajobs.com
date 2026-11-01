import { profileCoverage } from './profile.mjs';

export const fitCriteria=[
  {key:'skills',label:'Required skills',weight:30},
  {key:'experience',label:'Experience and results',weight:25},
  {key:'direction',label:'Direction and learning',weight:20},
  {key:'environment',label:'Working environment',weight:15},
  {key:'practical',label:'Practical fit',weight:10}
];
export function candidateEvidence(profile) {
  const p=profile.professional;
  return [profile.role,profile.experience,profile.learning,profile.location,profile.workMode,
    profile.minimumPay?`${profile.currency} ${profile.minimumPay} per year`:'',
    ...p.careerHistory.flatMap(r=>[r.role,r.work,r.impact]),
    ...p.skills.flatMap(r=>[r.name,r.evidence,r.depth]),...p.projects.flatMap(r=>[r.name,r.work,r.impact]),
    ...p.achievements,...p.education,...p.targetRoles,...p.industries,...p.locations,
    p.environment,...p.constraints,...p.tradeoffs,p.availability,p.workAuthorization].filter(Boolean).join('\n');
}
export function employerEvidence(row) {
  return [row.role.title,row.role.department,row.role.location,row.role.workplace,
    row.role.pay?JSON.stringify(row.role.pay):'',row.content.text].filter(Boolean).join('\n');
}
const normalize=value=>String(value||'').toLowerCase().replace(/\s+/g,' ').trim();
const anchored=(quote,source)=>typeof quote==='string'&&quote.trim().length>=8&&quote.length<=500&&normalize(source).includes(normalize(quote));
export function tierForScore(score) {return score>=90?'S':score>=80?'A':score>=65?'B':score>=50?'C':'D';}

// Model estimates must be traceable to the supplied evidence. Unknowns widen a range;
// they are never silently assigned zero or dropped from the denominator.
export function assessFit(choice,row,profile,now=Date.now()) {
  const candidate=candidateEvidence(profile),employer=employerEvidence(row);
  const criteria=fitCriteria.map(({key,label,weight})=>{
    const item=choice.criteria?.[key];
    const unresolvedPractical=key==='practical'&&(row.rank.gaps||[]).some(g=>/unverified|overlaps/i.test(g));
    const supported=!unresolvedPractical&&row.content.text&&Number.isFinite(item?.rating)&&item.rating>=0&&item.rating<=100
      &&anchored(item.candidateEvidence,candidate)&&anchored(item.jobEvidence,employer)&&typeof item.reason==='string'&&item.reason.trim();
    return {key,label,weight,rating:supported?Math.round(item.rating):null,
      reason:supported?item.reason.trim().slice(0,500):'Not enough supported information.',
      candidateEvidence:supported?item.candidateEvidence.trim():'',jobEvidence:supported?item.jobEvidence.trim():''};
  });
  const established=criteria.filter(c=>c.rating!==null),knownWeight=established.reduce((sum,c)=>sum+c.weight,0);
  const sufficient=criteria.slice(0,2).every(c=>c.rating!==null),complete=knownWeight===100;
  const knownPoints=established.reduce((sum,c)=>sum+c.rating*c.weight/100,0);
  const lower=complete?Math.round(knownPoints):Math.floor(knownPoints),upper=complete?lower:Math.min(100,Math.ceil(knownPoints+100-knownWeight));
  const requirements=(choice.requirements||[]).filter(r=>['met','gap','unknown'].includes(r.status)&&anchored(r.jobEvidence,row.content.text)).slice(0,8).map(r=>({status:r.status==='met'&&!anchored(r.candidateEvidence,candidate)?'unknown':r.status,jobEvidence:r.jobEvidence,candidateEvidence:anchored(r.candidateEvidence,candidate)?r.candidateEvidence:''}));
  const gaps=row.rank.gaps||[],fresh=Number.isFinite(Date.parse(row.content.observedAt))&&now-Date.parse(row.content.observedAt)<=172800000;
  const allCoreMet=requirements.length>0&&requirements.every(r=>r.status==='met');
  const high=complete&&allCoreMet&&fresh&&row.role.sourceStatus==='current'&&!gaps.some(g=>/unverified|incomplete|overlaps/i.test(g))&&profileCoverage(profile).missing.length===0;
  const confidence=high?'high':sufficient&&fresh?'medium':'low';
  let tier=sufficient&&(complete||tierForScore(lower)===tierForScore(upper))?tierForScore(lower):'U';
  // S is reserved for a complete, source-supported assessment with no unresolved core requirement.
  if(tier==='S'&&!high)tier='U';
  return {score:sufficient&&complete?lower:null,scoreRange:sufficient?[lower,upper]:null,tier,confidence,
    provisional:!high,knownWeight,criteria,requirements,
    assessment:'reviewed',method:'evidence-rubric-v1'};
}
