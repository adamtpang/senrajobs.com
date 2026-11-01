import fs from 'node:fs';
import { requestPublic, structuredJob } from '../ats.mjs';
import { employerDescription,employerDetailUrl } from './employer-content.mjs';
export function plain(value) {return String(value||'').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'').replace(/<[^>]*>/g,' ').replace(/&(?:lt|gt|nbsp|amp|quot);/g,x=>({'&lt;':'<','&gt;':'>','&nbsp;':' ','&amp;':'&','&quot;':'"'}[x])).replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(Number(n))).replace(/\s+/g,' ').trim().slice(0,18000);}
let cache={};const file=new URL('../.cache/job-content.json',import.meta.url);
export function loadContent() {try{cache=JSON.parse(fs.readFileSync(file,'utf8'));}catch{}return cache;}
export async function roleContent(role) {
  const cached=cache[role.url];if(cached && Date.now()-Date.parse(cached.observedAt)<86400000)return cached;
  let url=employerDetailUrl(role)||role.detailApi||role.url;
  if(role.sourceUrl?.includes('boards-api.greenhouse.io'))url=role.sourceUrl.split('/jobs')[0]+`/jobs/${encodeURIComponent(role.id)}`;
  // URLs are selected exclusively from the verified local employer catalog, never browser input.
  const result=await requestPublic(url);let text='',closed=false;
  if(result.ok) {
    const data=result.data;
    let custom;try{custom=employerDescription(role,result.text||'',data);}catch{}
    text=plain(data?.jobPostingInfo?.jobDescription||data?.content||data?.descriptionHtml||data?.descriptionPlain||custom?.description||structuredJob(result.text||'').find(j=>j.title?.trim().toLowerCase()===role.title.trim().toLowerCase())?.description);
    closed=/this job is no longer|job (?:is )?no longer available|posting (?:has been|is) closed|job not found/i.test((result.text||'').slice(0,10000));
  }else closed=[404,410].includes(result.status);
  const row={text,closed,observedAt:new Date().toISOString(),source:url};cache[role.url]=row;return row;
}
export async function refreshBulkContent(jobs) {
  for(const board of Object.values(jobs)) {
    if(!board.sourceUrl||!board.roles?.length||!['ashby','greenhouse','lever'].some(x=>board.source?.startsWith(x+':')))continue;
    const result=await requestPublic(board.sourceUrl);if(!result.ok)continue;
    const items=Array.isArray(result.data)?result.data:result.data?.jobs;if(!Array.isArray(items))continue;
    for(const role of board.roles) {
      const item=items.find(item=>String(item.id)===String(role.id));if(!item)continue;
      const text=plain(item.descriptionPlain||item.descriptionHtml||item.content||[item.description,...(item.lists||[]).map(x=>x.content),item.additional].filter(Boolean).join(' '));
      if(text)cache[role.url]={text,closed:false,observedAt:new Date().toISOString(),source:board.sourceUrl};
    }
  }
  saveContent();return Object.keys(cache).length;
}
export function saveContent() {fs.mkdirSync(new URL('../.cache/',import.meta.url),{recursive:true});fs.writeFileSync(file,JSON.stringify(cache));}
