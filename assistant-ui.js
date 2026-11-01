import { cleanProfile } from './assistant/profile.mjs';
import { interviewStep,interviewSections,interviewProgress } from './assistant/interview-guide.mjs';

(() => {
  const $=id=>document.getElementById(id),content=$('assistant-content'),composer=$('role-message');
  const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const storageKey='senra-professional-profile-v2';
  const panel=$('assistant'),toggle=$('chat-toggle');
  function showChat(open) {
    panel.hidden=!open;toggle.hidden=open;toggle.setAttribute('aria-expanded',String(open));
    if(open)composer.focus({preventScroll:true});else toggle.focus({preventScroll:true});
  }
  toggle.addEventListener('click',()=>showChat(panel.hidden));
  $('chat-close').addEventListener('click',()=>showChat(false));
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!panel.hidden){event.preventDefault();showChat(false);}});
  function fitViewport() {
    const viewport=window.visualViewport;
    document.documentElement.style.setProperty('--chat-offset',`${viewport?Math.max(0,innerHeight-viewport.height-viewport.offsetTop):0}px`);
    document.documentElement.style.setProperty('--chat-viewport',`${viewport?.height||innerHeight}px`);
  }
  window.visualViewport?.addEventListener('resize',fitViewport);
  window.visualViewport?.addEventListener('scroll',fitViewport);
  window.addEventListener('resize',fitViewport);fitViewport();
  let messages=[{role:'assistant',text:interviewSections[0].question}],profile=null,shortlist=null,stage='interview',busy=false,generation=0,credits=null;
  try {const saved=localStorage.getItem(storageKey);if(saved){profile=cleanProfile(JSON.parse(saved));if(profile){const step=interviewStep(profile);stage=step.section?'interview':'ready';messages=[{role:'assistant',text:step.section?`Welcome back. ${step.section.question}`:'Welcome back. Review your answers below, or tell me what has changed.'}];}}}catch{}
  const tierLabels={S:'Exceptional fit',A:'Strong fit',B:'Promising',C:'Stretch',D:'Weak alignment',U:'Provisional'};
  const scoreLabel=role=>role.score!==null&&Number.isFinite(role.score)?`${role.score}/100`:role.scoreRange?`${role.scoreRange[0]}–${role.scoreRange[1]}/100`:'Not enough evidence';
  function notifyMatches(result) {window.dispatchEvent(new CustomEvent('senra:matches',{detail:result}));}
  function notice(text='') {$('assistant-notice').textContent=text;}
  function safeUrl(value) {try{const url=new URL(value);return ['http:','https:'].includes(url.protocol)?url.href:'';}catch{return '';}}
  function historyForRequest() {const recent=messages.slice(-30).map(({role,text})=>({role,text}));while(new TextEncoder().encode(JSON.stringify(recent)).length>23500&&recent.length>1)recent.shift();return recent;}
  async function connect() {try{const response=await fetch('/api/assistant',{cache:'no-store'}),data=await response.json();credits=data.credits??null;return data;}catch{return {online:false};}}
  function setBusy(value) {busy=value;composer.disabled=value;$('chat-send').disabled=value;$('rank-roles')?.toggleAttribute('disabled',value);$('assistant-progress').hidden=!value;}
  function render() {
    content.hidden=!messages.length&&!shortlist;
    content.innerHTML=messages.slice(-12).map(message=>`<p class="chat-message ${message.role==='user'?'chat-user':'chat-answer'}">${esc(message.text)}</p>`).join('');
    if(stage==='ready'&&profile) {
      const p=profile.professional;
      content.insertAdjacentHTML('beforeend',`<div class="interview-review"><h3>Your direction</h3><p>${esc(profile.role)}</p><p>${esc(profile.experience)}</p>${p.skills.length?`<p>${esc(p.skills.map(skill=>skill.name).join(', '))}</p>`:''}<p>${esc([profile.location,profile.workMode,profile.minimumPay?`${profile.currency} ${profile.minimumPay.toLocaleString()}/year minimum`:''].filter(Boolean).join(' · '))}</p>${p.constraints.length?`<p>${esc(p.constraints.join(' · '))}</p>`:''}${profile.learning?`<p>Learn: ${esc(profile.learning)}</p>`:''}${p.tradeoffs.length?`<p>${esc(p.tradeoffs.join(' · '))}</p>`:''}<button id="rank-roles" class="chat-rank" type="button">Find my matches →</button></div>`);
    }
    if(shortlist&&stage==='matches') {
      content.insertAdjacentHTML('beforeend',`<div class="ranked-roles">${shortlist.matches.map(role=>`<article class="ranked-role"><div class="rank-line"><span class="tier tier-${role.tier}">${esc(role.tier==='U'?'—':role.tier)}</span><div><h3><a href="${esc(safeUrl(role.url))}" target="_blank" rel="noopener">${esc(role.title)} ↗</a></h3><p class="fit-score">${esc(scoreLabel(role))} · ${esc(role.confidence)} confidence${role.provisional?' · provisional':''}</p><p class="role-caption">${esc(role.company)} · ${esc(role.location)}${role.pay!=='Pay not listed'?` · ${esc(role.pay)}`:''}</p></div></div><p class="fit-reason">${esc(role.reason)}</p><details><summary>Why this fit?</summary><div class="fit-criteria">${(role.criteria||[]).map(c=>`<div class="fit-criterion"><p><strong>${esc(c.label)}</strong><span>${c.rating===null?'Unknown':`${Number((c.rating*c.weight/100).toFixed(1))}/${c.weight}`}</span></p><p>${esc(c.reason)}</p>${c.rating!==null?`<details><summary>Evidence</summary><p>You: ${esc(c.candidateEvidence)}</p><p>Posting: ${esc(c.jobEvidence)}</p></details>`:''}</div>`).join('')}</div><p>${esc(role.gap)}</p>${role.gaps.length?`<p>${esc(role.gaps.join(' '))}</p>`:''}<p>${esc(role.nextStep)}</p><p class="role-caption">${esc(role.evidence)}${role.requirementsSource&&safeUrl(role.requirementsSource)?` · <a href="${esc(safeUrl(role.requirementsSource))}" target="_blank" rel="noopener">Employer source ↗</a>`:''}</p></details></article>`).join('')}<button id="all-matches" class="chat-rank" type="button">Explore all roles →</button><details class="ranking-method"><summary>How fit works</summary><p>${shortlist.searched.toLocaleString()} indexed roles searched; ${shortlist.reviewed||0} assessed in detail. Other roles can be assessed individually.</p><p>Skills 30 · Experience 25 · Direction 20 · Environment 15 · Practical fit 10. Unknown criteria widen the score range. S 90+ · A 80+ · B 65+ · C 50+ · D below 50. S also requires high confidence and supported core requirements. These are alignment estimates, not hiring odds.</p></details></div>`);
    }
    $('assistant-reply').textContent=messages.filter(message=>message.role==='assistant').at(-1)?.text||'';
    const step=interviewProgress(profile);
    $('interview-step').textContent=stage==='matches'?'Your matches':stage==='ready'||!step.section?'Review your answers':`${step.index+1} of 8 · ${step.section.label}`;
    $('interview-eta').textContent=stage==='interview'?step.eta:stage==='ready'?'Check your direction before matching.':'Based on your professional profile';
    $('interview-meter').hidden=stage!=='interview';$('interview-meter').value=step.percent;
    $('interview-start-hint').hidden=!!profile||messages.length>1;
    composer.placeholder=stage==='matches'?'Tell me what to change…':stage==='ready'?'Anything to correct or add?':'Your answer…';
    setBusy(busy);
    if(!busy&&messages.length&&!panel.hidden&&panel.contains(document.activeElement))composer.focus({preventScroll:true});
    requestAnimationFrame(()=>{
      const summary=stage==='matches'?[...content.children].filter(node=>node.classList.contains('chat-answer')).at(-1):null;
      content.scrollTop=summary?content.scrollTop+summary.getBoundingClientRect().top-content.getBoundingClientRect().top:content.scrollHeight;
    });
  }
  async function request(kind,payload) {
    const current=generation;setBusy(true);notice();$('assistant-progress').textContent=kind==='match'?'Reading roles and ranking your fit…':'Thinking…';
    try {
      const response=await fetch('/api/assistant',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind,...payload})}),queued=await response.json();
      if(!response.ok)throw new Error(queued.error||'Please try again.');
      credits=queued.credits;
      const deadline=Date.now()+420000;
      while(Date.now()<deadline&&current===generation) {
        await new Promise(resolve=>setTimeout(resolve,1800));if(current!==generation)throw new Error('Request cleared');
        const poll=await fetch(`/api/assistant?id=${encodeURIComponent(queued.id)}`,{cache:'no-store'}),job=await poll.json();if(current!==generation)throw new Error('Request cleared');
        if(!poll.ok)throw new Error(job.error||'The request expired. Please try again.');
        if(job.status==='done')return job.result;
        if(['failed','deleted'].includes(job.status))throw new Error(job.error||'Request cleared');
        if(deadline-Date.now()<390000)$('assistant-progress').textContent=job.status==='pending'?'Waiting for the assistant…':'Still thinking…';
      }
      throw new Error('This is taking longer than expected. Please try again later.');
    }catch(error){if(current===generation)notice(error.message);throw error;}
    finally{if(current===generation){setBusy(false);connect();}}
  }
  async function rank(targetUrl) {
    if(busy||!profile)return;
    try {const result=await request('match',{profile,...(targetUrl?{targetUrl}:{})});shortlist=result;stage='matches';messages.push({role:'assistant',text:result.summary});notifyMatches(result);render();}catch{}
  }
  $('role-chat').addEventListener('submit',async event=>{
    event.preventDefault();if(busy)return;const answer=composer.value.trim();if(!answer)return;
    if(answer.length>8000){notice('Please send your context in shorter messages.');return;}
    const previous={stage,shortlist};messages.push({role:'user',text:answer});composer.value='';shortlist=null;stage='interview';render();
    try {const result=await request('interview',{messages:historyForRequest(),profile});profile=result.profile;window.dispatchEvent(new Event('senra:profile-changed'));messages.push({role:'assistant',text:result.question});if(result.ready&&interviewStep(profile).coverage.missing.length===0)stage='ready';render();}
    catch {const failed=messages.at(-1);if(failed?.role==='user'){composer.value=failed.text;messages.pop();stage=previous.stage;shortlist=previous.shortlist;render();}}
  });
  content.addEventListener('click',event=>{if(event.target.closest('#rank-roles'))rank();if(event.target.closest('#all-matches')){showChat(false);window.dispatchEvent(new Event('senra:explore-matches'));}});
  window.addEventListener('senra:assess-role',event=>{showChat(true);if(busy){notice('Your current assessment is still running.');return;}if(profile&&interviewStep(profile).coverage.missing.length===0)rank(event.detail.url);else notice('Finish your interview first so I can compare this role with your experience.');});
  composer.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing&&event.keyCode!==229&&!event.repeat){event.preventDefault();if(!busy)$('role-chat').requestSubmit();}});
  render();connect();
})();
