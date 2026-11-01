import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { compileRoles } from '../board-data.mjs';
import { matchesLocation, displayLocation, texasEvidence,isUSRemotePossibility,isLocationUnknown } from '../location-utils.mjs';
import { formatPublishedPay } from '../job-utils.mjs';
import { loadContent } from './content.mjs';
export function catalog() {const guests=JSON.parse(fs.readFileSync(new URL('../guests.json',import.meta.url))),jobs=JSON.parse(fs.readFileSync(new URL('../jobs.json',import.meta.url)));const roles=compileRoles(guests,jobs);return {roles,version:createHash('sha256').update(JSON.stringify(roles.map(r=>[r.url,r.fetched]))).digest('hex').slice(0,16)};}
const stop=new Set('a an and at for from i in is of on or the to with want would work job role years experience'.split(' '));
export function tokens(value) {return [...new Set(String(value).toLowerCase().match(/[a-z0-9+#.]{2,}/g)||[])].filter(word=>!stop.has(word));}
const aliases={engineering:['engineer','developer','software'],engineer:['engineering','developer'],developer:['software','engineer'],sales:['account','business development'],design:['designer','design'],operations:['operations','operator'],marketing:['marketing','growth'],leadership:['director','head','manager'],ai:['machine learning','applied','research','technical staff'],growth:['growth','marketing'],product:['product','program'],automation:['automation','applied','solutions'],founder:['entrepreneur','operator','chief of staff']};
export function preferenceLocation(role,value) {
  return matchesLocation(role,value.trim());
}
export function scoreRole(role,profile) {
  const wanted=tokens([profile.role,...(profile.professional?.targetRoles||[])].join(' ')),terms=[...new Set(wanted.flatMap(word=>[word,...(aliases[word]||[])]))];
  const title=`${role.title} ${role.department||''}`.toLowerCase();
  const roleMatch=terms.length?Math.min(1,terms.filter(term=>title.includes(term)).length/Math.max(1,Math.min(terms.length,3))):0;
  const experience=tokens([profile.experience,...(profile.professional?.skills||[]).map(skill=>skill.name)].join(' ')).filter(word=>title.includes(word));
  const parts={role:Math.round(roleMatch*60),experience:Math.min(10,experience.length*3),location:0,pay:0};
  const gaps=[];
  const locations=profile.professional?.locations?.length?profile.professional.locations:profile.location?[profile.location]:[];
  if(locations.length) {
    if(isLocationUnknown(role))gaps.push('Job location is unverified.');
    else if(!locations.some(location=>preferenceLocation(role,location))){
      if(locations.some(location=>texasEvidence({location}).length)&&isUSRemotePossibility(role))gaps.push('Remote Texas eligibility is unverified.');
      else return null;
    }else parts.location=20;
  }else gaps.push('No location preference set.');
  if(profile.workMode==='Remote' && role.workplace&&!/^remote$/i.test(role.workplace))return null;
  if(profile.workMode==='On-site' && /^remote$/i.test(role.workplace||''))return null;
  if(profile.workMode==='Hybrid' && role.workplace&&!/^hybrid$/i.test(role.workplace))return null;
  if(profile.workMode!=='Any'&&!role.workplace&&!/\bremote\b/i.test(role.location||''))gaps.push('Work style is unverified.');
  if(profile.minimumPay) {
    if(role.pay?.period==='year'&&role.pay.currency===profile.currency&&Number.isFinite(role.pay.max)) {
      if(role.pay.max<profile.minimumPay)return null;
      parts.pay=10; if(!Number.isFinite(role.pay.min)||role.pay.min<profile.minimumPay)gaps.push('The published range overlaps your minimum; an offer is not guaranteed.');
    }else gaps.push('Annual pay in your chosen currency is unverified.');
  }else gaps.push('No minimum pay set.');
  if(role.refreshFailed||role.sourceStatus!=='current')gaps.push('Source refresh is incomplete; confirm this listing with the employer.');
  return {score:Object.values(parts).reduce((sum,n)=>sum+n,0),parts,gaps};
}
export function rankRoles(roles,profile) {
  const content=loadContent(),skills=tokens((profile.professional?.skills||[]).map(skill=>skill.name).join(' '));
  return roles.map(role=>{const rank=scoreRole(role,profile);if(!rank)return {role,rank:null};const description=(content[role.url]?.text||'').toLowerCase();rank.relevance=rank.score+Math.min(20,skills.filter(skill=>description.includes(skill)).length*4);return {role,rank};}).filter(x=>x.rank&&x.rank.parts.role>0&&!content[x.role.url]?.closed).sort((a,b)=>b.rank.relevance-a.rank.relevance||a.role.url.localeCompare(b.role.url));
}
export function publicRole(role,rank) {return {url:role.url,title:role.title,company:role.company.split(' (')[0],location:displayLocation(role),pay:formatPublishedPay(role),guests:role.founders.map(f=>f.name),score:rank.score,parts:rank.parts,gaps:rank.gaps,checked:role.fetched};}
