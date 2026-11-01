// Resolve model-selected IDs to literal source text; unknown IDs never acquire evidence.
export function evidenceSpans(text,prefix){
  const spans=[];for(const line of String(text||'').split(/\n|(?<=[.!?])\s+|\s+-\s+/)){
    const value=line.trim();if(value.length<8)continue;
    let start=0;while(start<value.length){let end=Math.min(start+380,value.length);if(end<value.length){const space=value.lastIndexOf(' ',end);if(space>start+100)end=space;}
      const span=value.slice(start,end).trim();if(span.length>=8&&!spans.some(x=>x.text===span))spans.push({id:prefix+spans.length,text:span});start=end;if(value[start]===' ')start++;
    }
  }return spans;
}
export function resolveReviewEvidence(choice,candidateSpans,jobSpans){
  const candidate=new Map(candidateSpans.map(x=>[x.id,x.text])),job=new Map(jobSpans.map(x=>[x.id,x.text]));
  return {...choice,criteria:Object.fromEntries(Object.entries(choice.criteria||{}).map(([key,c])=>[key,{rating:c.rating,reason:c.reason,candidateEvidence:candidate.get(c.candidateEvidenceId)||'',jobEvidence:job.get(c.jobEvidenceId)||''}])),requirements:(choice.requirements||[]).map(r=>({status:r.status,candidateEvidence:candidate.get(r.candidateEvidenceId)||'',jobEvidence:job.get(r.jobEvidenceId)||''})),conflictJobEvidence:job.get(choice.conflictJobEvidenceId)||'',conflictCandidateEvidence:candidate.get(choice.conflictCandidateEvidenceId)||''};
}
