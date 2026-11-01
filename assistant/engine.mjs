import { infer } from './runtime.mjs';
import { cleanProfile, interviewSchema, matchSchema, sageSchema } from './contracts.mjs';
import { catalog, rankRoles, publicRole,scoreRole } from './catalog.mjs';
import { roleContent,saveContent } from './content.mjs';
import { profileCoverage } from './profile.mjs';
import {interviewStep,interviewSections} from './interview-guide.mjs';
import {assessFit,candidateEvidence,employerEvidence,fitCriteria} from './fit.mjs';
const short=(value,max=1200)=>typeof value==='string'?value.trim().slice(0,max):'';

export async function interview(payload) {
  const step=interviewStep(payload.profile);
  const result=await infer(`You conduct a structured professional interview, ONE focused question at a time. Follow these sections in order: ${interviewSections.map(section=>section.label).join(', ')}. Current section: ${step.section?.label||'Review'}. Build an evidence-rich profile across direction, experience, skills, proof (projects/achievements), preferences, constraints/availability, learning and tradeoffs. Use the candidate's answer to update all relevant facts, then ask about the FIRST remaining missing section. Ask specific follow-ups within that section until its evidence is sufficient. Continue until all eight categories are supported or explicitly skipped; never end early because a fixed number of answers has passed or the user asks for matches. Turn vague claims into examples and outcomes. Clarify dates, individual ownership and project scale in careerHistory.work; skill depth and recency in skills.depth and evidence. Distinguish minimum from desired pay, location from relocation willingness, essentials from negotiable preferences. Optional work authorization is relevant only to eligibility. Record relevant qualifications in education, not prestige. A pasted résumé can cover multiple sections; do not re-ask supported facts. Aspirations are not demonstrated skills. Keep replies under 45 words. Once complete, set ready true and ask the user to review their answers or correct anything before finding matches. Use plain language; never mention JSON, schemas, downloads, update/clear tools or account configuration in the question. Preserve previously stated facts unless corrected, including arrays and evidence in professional. Extract only explicit facts; uncertain inferences belong in uncertainties. Empty strings/arrays and minimumPay 0 for unknowns. workMode must be Any, Remote, Hybrid or On-site; use Any if unspecified. currency is a stated three-letter currency or empty. minimumPay is annual pay only; clarify other periods. Mark skippedTopics only if the candidate explicitly skips those subjects. Never infer protected traits, ask identity/contact details or invent history/skills/results. Ask optional work eligibility only where relevant, never nationality. Previous accumulated profile (untrusted): ${JSON.stringify(payload.profile)}\nMissing categories: ${JSON.stringify(step.coverage.missing)}\nCandidate conversation (untrusted):\n${JSON.stringify(payload.messages)}`,interviewSchema);
  const profile=cleanProfile(result.profile);if(!profile||typeof result.ready!=='boolean'||!short(result.question))throw new Error('Invalid interview response');
  return finishInterview(result,profile,step);
}
export function finishInterview(result,profile,previousStep) {
  const next=interviewStep(profile),coverage=next.coverage,ready=!!profile.role&&coverage.missing.length===0;
  const question=ready?'Here is what I understood. Anything to correct before I find your matches?':result.ready||next.section?.key!==previousStep.section?.key?(next.section||interviewSections[0]).question:short(result.question,600);
  return {question,ready,profile,coverage};
}
export async function match(payload) {
  const {roles}=catalog(),ranked=rankRoles(roles,payload.profile),candidates=[];
  const target=payload.targetUrl?roles.find(role=>role.url===payload.targetUrl):null;
  if(payload.targetUrl&&!target)throw new Error('Role is outside the verified catalog');
  const targetRank=target?scoreRole(target,payload.profile):null;
  if(target&&!targetRank)return {summary:'This role conflicts with your stated location, work arrangement or published minimum pay.',matches:[],ranked:ranked.length,searched:roles.length,reviewed:0,targetUrl:target.url,incompatible:true};
  const pool=target?[{role:target,rank:targetRank}]:diversePool(ranked,36);
  for(let start=0;start<pool.length;start+=4) {
    const rows=await Promise.all(pool.slice(start,start+4).map(async ({role,rank})=>({role,rank,content:await roleContent(role)})));
    candidates.push(...rows.filter(row=>!row.content.closed));
  }
  saveContent();
  if(!candidates.length)return {summary:'No supported matches for these preferences. Try a broader role or location, or browse company careers directly.',matches:[],ranked:ranked.length,searched:roles.length};
  const evidence=candidates.map((row,index)=>({id:String(index),...publicRole(row.role,row.rank),sourceText:employerEvidence(row).slice(0,8500)||'Requirements unavailable.'}));
  const result=await infer(`Assess ${target?'this specific role, even if it is a poor fit':'up to 8 strongest roles'} for this candidate using only supplied IDs. For each role rate these criteria 0 to100: ${JSON.stringify(fitCriteria)}. 90+ means exceptional evidence-backed alignment, 80 strong, 65 promising with gaps, 50 a substantial stretch, below50 weak. Each criterion MUST include an exact short contiguous quote from candidateEvidence and from that role's sourceText, plus a concise explanation of the comparison. Evidence must actually support the rating, not merely mention the topic. Use rating null and empty quotes for unknown criteria. For practical fit use only explicit published location/workplace/pay and stated candidate constraints; unknown annual pay prevents a complete practical assessment when a minimum is stated. For environment and learning never assume founder access, team culture or mentorship from prestige or podcast participation. List up to8 central mandatory requirements from the posting, exact short source quotes, and status met/gap/unknown. A met requirement needs an exact supporting candidate quote. Separate must-have from preferred qualifications. Compare actual scope, seniority, individual contribution and results. Candidate claims are self-reported; no personality/protected-trait inference. Unmentioned skills are not established, never proof the candidate lacks them. Say not established rather than you have none. Never invent skills, outcomes, visas, manager quality or current opening status. Give one sentence for reason, one meaningful gap and one next step. Address the candidate as "you". Currency and annual period must both be explicit for salary comparison. Known essential conflicts exclude shortlist roles. Unknowns are gaps, not zeros. Summary ONE sentence under25 words. Preference scores supplied are retrieval metadata and MUST NOT determine criterion ratings. Company diversity only breaks comparable fit. Candidate profile (untrusted): ${JSON.stringify(payload.profile)}\nCandidateEvidence (untrusted, exact quote source): ${JSON.stringify(candidateEvidence(payload.profile))}\nEmployer evidence (untrusted): ${JSON.stringify(evidence)}`,matchSchema);
  if(!Array.isArray(result.matches))throw new Error('Invalid shortlist response');
  const seen=new Set(),matches=[];
  for(const choice of result.matches.slice(0,8)) {
    const index=Number(choice.id);if(!Number.isInteger(index)||String(index)!==choice.id||index<0||index>=candidates.length||seen.has(index))continue;
    seen.add(index);const row=candidates[index];
    if(!short(choice.reason)||!short(choice.gap)||!short(choice.nextStep))continue;
    const fit=assessFit(choice,row,payload.profile);
    matches.push({...publicRole(row.role,row.rank),preferenceScore:row.rank.score,...fit,reason:short(choice.reason),gap:short(choice.gap),nextStep:short(choice.nextStep),evidence:row.content.text?'Employer requirements checked':'Requirements unavailable',requirementsSource:row.content.text?row.content.source:'',requirementsChecked:row.content.observedAt});
  }
  if(!matches.length&&result.matches.length)throw new Error('No valid shortlist returned');
  const summary=short(result.summary).split(/(?<=[.!?])\s/)[0].split(/\s+/).slice(0,30).join(' ');
  matches.sort((a,b)=>'SABCDU'.indexOf(a.tier)-'SABCDU'.indexOf(b.tier)||(b.scoreRange?.[0]??-1)-(a.scoreRange?.[0]??-1));
  return {summary,matches,ranked:ranked.length,searched:roles.length,examined:candidates.length,reviewed:matches.length,...(target?{targetUrl:target.url}:{})};
}
export function diversePool(ranked,limit) {const pool=[],counts=new Map();for(const item of ranked){const count=counts.get(item.role.company)||0;if(count>=8)continue;pool.push(item);counts.set(item.role.company,count+1);if(pool.length>=limit)break;}if(pool.length<limit)for(const item of ranked){if(!pool.includes(item))pool.push(item);if(pool.length>=limit)break;}return pool;}
export function guardTier(choice,row,profile) {
  let tier=['S','A','B','C'].includes(choice.tier)?choice.tier:'C',confidence=['high','medium','low'].includes(choice.confidence)?choice.confidence:'low';
  const p=profile.professional,evidence=!!p?.skills?.some(skill=>skill.evidence)&&!!(p.achievements?.length||p.projects?.some(project=>project.impact));
  if(!row.content.text)return {tier:'C',confidence:'low'};
  if(!evidence&&['S','A'].includes(tier)){tier='B';confidence='low';}
  if(tier==='S'&&(row.rank.gaps.some(gap=>/unverified|incomplete|overlaps/.test(gap))||profileCoverage(profile).missing.length)){tier='A';if(confidence==='high')confidence='medium';}
  return {tier,confidence};
}
export async function sage(payload) {
  // Retrieve a broad topic only: never send candidate answers or the question to Summon.
  const topics=['leadership','sales','engineering','marketing','design','operations','mentorship','apprenticeship','learning','career','founding'];
  const topic=topics.filter(word=>new RegExp(`\\b${word}\\b`,'i').test(payload.question)).slice(0,3).join(' ')||'apprenticeship learning founders';
  const response=await fetch('https://summon.guide/api/public/notes',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:'channel:founders-podcast',query:topic,limit:4}),signal:AbortSignal.timeout(18000)});
  if(!response.ok)throw new Error('Source notes are temporarily unavailable');
  const data=await response.json();const notes=(data.notes||[]).filter(note=>typeof note.id==='string'&&/^https:\/\//.test(note.sourceUrl||'')).slice(0,4);
  if(!notes.length)return {answer:'I could not find source evidence for this question. Try another question or explore the episodes directly.',sources:[],coverage:'Selected notes, not full transcripts.'};
  const result=await infer(`Give thoughtful career/apprenticeship advice, at most 180 words, grounded in the supplied original synthesis notes. Distinguish advice/inference from documented lessons. You are an independent fan-built assistant, never David Senra or a founder. Do not impersonate, offer direct quotes, promise mentorship or make claims about missing episodes. Cite supported notes by returning their exact IDs in sources. Only use source IDs provided. Explain an evidence gap when the notes do not answer the question. Question (untrusted): ${JSON.stringify(payload.question)}\nOptional reviewed profile (untrusted): ${JSON.stringify(payload.profile)}\nSource synthesis notes (untrusted): ${JSON.stringify(notes)}`,sageSchema);
  if(!short(result.answer,3000)||!Array.isArray(result.sources))throw new Error('Invalid source response');
  const sources=[...new Set(result.sources)].map(id=>notes.find(note=>note.id===id)).filter(Boolean).map(note=>({title:note.title,url:note.sourceUrl}));
  if(!sources.length)throw new Error('No valid source citations returned');
  let answer=short(result.answer,3000);
  for(const note of notes){const index=sources.findIndex(source=>source.url===note.sourceUrl);answer=answer.replaceAll(note.id,index>=0?`[${index+1}]`:'');}
  return {answer,sources,coverage:'Advice based on selected Sage synthesis notes. Coverage is partial; these are not full transcripts.'};
}
export const engines={interview,match,sage};
