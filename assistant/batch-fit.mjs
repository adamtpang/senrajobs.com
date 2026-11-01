// Private batch helpers. This module never submits an application or publishes data.
import {createHash} from 'node:crypto';
import {matchesLocation,texasEvidence,locationValues,displayLocation,isUSRemotePossibility} from '../location-utils.mjs';
import {emptyProfessional,cleanProfile} from './profile.mjs';
import {fitCriteria,tierForScore,assessFit,candidateEvidence} from './fit.mjs';

export const batchMethod='private-batch-v3-global-full-text';
export const digest=value=>createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
export function postingIdentity(role){
  const u=new URL(role.url);const requisition=u.pathname.match(/_((?:JR|REQ|R)[-]?\d+(?:-\d+)?)$/i)?.[1];
  if(role.detailApi&&requisition)return `${role.company}|${requisition.toUpperCase()}`;
  if(/^\d{4,}$|^[a-f0-9]{8}-[a-f0-9-]{27,}$/i.test(String(role.id||'')))return `${role.company}|${role.id}`;
  return `${role.company}|${role.url}`;
}
export const normalize=value=>String(value||'').toLowerCase().replace(/\s+/g,' ').trim();
export const anchored=(quote,text)=>typeof quote==='string'&&quote.trim().length>=8&&normalize(text).includes(normalize(quote));
export const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function safeLink(value){try{const u=new URL(value);return u.protocol==='https:'?u.href:'';}catch{return '';}}

export function professionalProfile(raw){
  if(!raw?.experience||!raw?.direction||!Array.isArray(raw.facts)||!raw.facts.length||!Array.isArray(raw.proof)||!raw.proof.length)throw Error('Candidate source profile is missing required evidence for the contract');
  const p=emptyProfessional(),facts=raw.facts||[],proof=raw.proof||[],constraints=raw.currentConfirmedConstraints||{};
  p.headline='AI-assisted product builder, automation and customer-facing work; energy first.';
  p.careerHistory=facts.filter(x=>x.id!=='F8').slice(0,10).map(x=>({role:x.id,organization:'Candidate-reported history',work:x.fact.slice(0,1500),impact:''}));
  const skills=raw.confirmedSkillsUsed||[];
  p.skills=skills.slice(0,30).map(name=>({name,evidence:`Candidate reports practical use of ${name}.`,depth:'Practical use; independent depth and production scale remain unassessed.'}));
  const selected=[...(raw.selectedPortfolio?.primary||[]),...(raw.selectedPortfolio?.secondary||[])];
  p.projects=proof.filter(x=>selected.includes(x.id)).sort((a,b)=>selected.indexOf(a.id)-selected.indexOf(b.id)).slice(0,10).map(x=>({name:x.id,work:x.fact.slice(0,1500),impact:'Evidence and limits are stated in the project description; no additional metrics inferred.',url:safeLink(x.url)}));
  p.achievements=proof.filter(x=>['P5','P9'].includes(x.id)).map(x=>x.fact.slice(0,1000));
  p.education=facts.filter(x=>x.id==='F8').map(x=>x.fact);
  p.strengths=['AI-assisted product iteration','Workflow automation','B2B sales and customer onboarding'];
  p.gaps=(raw.nonClaims||[]).map(x=>x.slice(0,1000));
  p.targetRoles=['Software/product building','Growth or operations automation','Customer onboarding and implementation','Technical sales and early-career operations'];
  p.industries=['Energy first; Base Power is the first-choice company'];p.locations=['Austin, Texas preferred; worldwide roles considered'];
  p.environment='Willing to work on-site. Wants useful responsibility, feedback and exposure to operating problems. Specific manager, mentorship and founder access unknown.';
  p.constraints=[constraints.commute||'Commute unverified',`Car access: ${constraints.carAccess===false?'no car': 'unverified'}. No university degree or current student enrollment established.`,constraints.salaryFloor||'No salary floor; higher pay is a preference.'];
  p.tradeoffs=['Austin and surrounding areas first; all locations considered. Work authorization outside the US remains unverified.','Base and energy first; all Senra-connected companies are in scope.','Regular customer travel of roughly 25–50% is acceptable if based in Austin.','No salary floor; higher pay, learning and useful contribution matter.'];
  p.availability=constraints.startDate||'Exact start date unknown';p.workAuthorization=constraints.USWorkAuthorization||'Unknown';
  p.uncertainties=['Personal coding depth and exact professional engineering tenure remain unassessed.','Do not equate AI assistance with inability; PR evidence demonstrates building, not every claimed skill.'];
  const profile={role:p.targetRoles.join(', '),experience:raw.experience||'',location:'Austin preferred; worldwide opportunities considered',workMode:'Any',learning:raw.direction?.slice(0,2000)||'Useful contribution and learning.',minimumPay:0,currency:'USD',professional:p};
  if(!cleanProfile(profile))throw Error('Candidate profile exceeds the validated contract');return profile;
}

const usCountry=/^(?:us|usa|u\.s\.?a?\.?|united states(?: of america)?)$/i;
export function region(role){
  if(matchesLocation(role,'Austin, Texas'))return 'Austin';if(texasEvidence(role).length)return 'Texas';
  const records=role.locations||[],values=locationValues(role).join(' ');
  if(records.some(r=>usCountry.test(r.country||''))||/\b(?:United States|USA|U\.S\.)\b|(?:^|[\s,;(])US(?:[,\s)-]|$)/i.test(values)||isUSRemotePossibility(role))return 'Other US';
  if(/\b(?:AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|UT|VT|VA|WA|WV|WI|WY)\b/.test(values)&&/[,;-]/.test(values)&&!records.some(r=>r.country&&!usCountry.test(r.country)))return 'Other US';
  if(records.length&&records.every(r=>r.country&&!usCountry.test(r.country)))return 'Outside US';
  if(/\b(?:United Kingdom|Canada|Germany|France|India|China|Taiwan|Israel|Singapore|Japan|Sweden|Netherlands|Australia|South Korea|Poland|Ireland|United Arab Emirates)\b/i.test(values)&&! /remote|global|worldwide/i.test(values))return 'Outside US';
  return 'Location unclear';
}
const target=/software|developer|engineer|automation|operations|product|growth|marketing|sales|customer|member|support|implementation|solutions|associate|intern|apprentice|business development|general interest|general application|talent community|analyst|coordinator|assistant|administrat|community|onboarding|enablement|recruit|designer|program|project|process|\bweb\b|\bIT\b/i;
const specialized=/\b(?:principal|staff|senior|sr\.?|director|vice president|vp|head of|chief|lead)\b|hardware|firmware|electrical|mechanical|silicon|asic|semiconductor|research scientist|scientific|pharmac|clinical|nurse|physician|attorney|counsel|accounting|accountant|tax|audit|cdl|driver|diesel|technician|warehouse|forklift|field service|electrician|hvac|maintenance|branch manager/i;
export function routeRole(role,content={}){
  if(content.closed||role.closed)return {route:'Closed',reason:'Absent from a complete current employer feed or explicitly closed.'};
  const area=region(role);if(area==='Outside US')return {route:'International eligibility review',reason:'Worldwide search is authorized; overseas work authorization and relocation feasibility remain unverified.'};
  if(['Base Power','Flow'].includes(role.company.split(' (')[0]))return {route:'Review',reason:'Explicitly prioritized company; review the actual requirements.'};
  if(!target.test(`${role.title} ${role.department||''}`))return {route:'Lower priority',reason:'Title/department has no obvious connection to stated target work; this is a routing judgment, not a qualification grade.'};
  if(specialized.test(role.title))return {route:'Specialist or senior review',reason:'Title suggests substantial or specialized scope not yet established in the candidate evidence; not an inferred inability.'};
  return {route:'Review',reason:'Potential connection to stated target work; full requirements must be read.'};
}
export function priority(role){
  const area=region(role);
  const companyPriority=['Base Power','Flow'].includes(role.company.split(' (')[0]) ? 0 : 100;
  return companyPriority+({Austin:0,Texas:10,'Other US':20,'Location unclear':30,'Outside US':40}[area]??30);
}
export function fingerprint(role,content,profile,stage){return digest({method:batchMethod,criteria:fitCriteria,stage,profile,role:[role.url,role.title,role.department,role.location,role.locations,role.workplace,role.pay,role.sourceStatus,...(role.employerBrand?[{employerBrand:role.employerBrand}]:[]),...(role.payRanges?.length?[{payRanges:role.payRanges}]:[])],content:[content.text,content.closed,content.observedAt]});}
export function normalizeScreen(choice,role,content,profile){
  const valid=content.text&&anchored(choice.jobEvidence,content.text)&&anchored(choice.candidateEvidence,candidateEvidence(profile));
  const parts=fitCriteria.map(c=>({key:c.key,weight:c.weight,rating:valid&&Number.isFinite(choice.ratings?.[c.key])?Math.max(0,Math.min(100,choice.ratings[c.key])):null}));
  const known=parts.filter(x=>x.rating!==null),weight=known.reduce((s,x)=>s+x.weight,0),lower=Math.floor(known.reduce((s,x)=>s+x.rating*x.weight/100,0)),upper=Math.min(100,Math.ceil(lower+100-weight));
  const screenTier=valid&&weight===100?tierForScore(lower):'U';
  return {screenScore:weight===100?lower:null,screenRange:weight?[lower,upper]:null,screenTier,screenReason:valid?choice.reason:'Source evidence could not be validated.',screenGap:choice.gap||'',screenJobEvidence:valid?choice.jobEvidence:'',screenCandidateEvidence:valid?choice.candidateEvidence:'',screenConfidence:valid?choice.confidence:'low',screenHardConflict:!!choice.hardConflict&&valid,assessmentDepth:valid?'screening':'invalid-evidence',tier:'U',score:null,confidence:'low',provisional:true};
}
export function normalizeReview(choice,role,content,profile){
  const gaps=role.sourceStatus==='current'?[]:['Source current status unverified.'];if(region(role)==='Location unclear')gaps.push('Published job location is unverified.');
  const fit=assessFit(choice,{role,content,rank:{gaps}},profile);
  const conflict=choice.hardConflict===true&&anchored(choice.conflictJobEvidence,content.text)&&anchored(choice.conflictCandidateEvidence,candidateEvidence(profile));
  const essentialGap=fit.requirements.some(x=>x.status!=='met');
  return {...fit,tier:conflict?'D':fit.tier,provisional:fit.provisional||essentialGap,applyReady:['S','A'].includes(fit.tier)&&fit.requirements.length>0&&role.sourceStatus==='current'&&!conflict&&!essentialGap&&fit.confidence!=='low',hardConflict:conflict,conflictReason:conflict?choice.conflictReason:'',reason:choice.reason,gap:choice.gap,nextStep:choice.nextStep,assessmentDepth:'detailed',requirementsSource:content.source||role.url,requirementsObservedAt:content.observedAt,assessedAt:new Date().toISOString()};
}
export function publicRow(role){return {url:role.url,title:role.title,company:role.company.split(' (')[0],...(role.employerBrand?{employerBrand:role.employerBrand}:{}),founders:(role.founders||[]).map(x=>x.name),location:displayLocation(role),region:region(role),pay:role.pay||null,payRanges:role.payRanges||[],sourceStatus:role.sourceStatus,priority:priority(role)};}
