import { compareRoles, formatPay, formatPublishedPay } from './assets/job-utils.js';
import { roleEmoji } from './assets/role-emoji.js';
import { matchesLocation,displayLocation,texasEvidence,isUSRemotePossibility,isLocationUnknown } from './location-utils.mjs';

const $ = id => document.getElementById(id);
// The build ships role, company and coverage data inside the same hashed script as these controls.
const embedded = id => (typeof __senraData !== 'undefined' && __senraData[id]) || JSON.parse($(id).textContent);
const guests = JSON.parse($('guest-data').textContent);
const roles = embedded('role-data');
const coverage = embedded('coverage-data');
const byUrl = new Map(roles.map(role => [role.url,role]));
const companies = embedded('company-data').map(company => ({...company,roles:company.roleUrls.map(url => byUrl.get(url)).filter(Boolean)}));
const cards = [...document.querySelectorAll('[data-guest]')];
const normalize = value => String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const escape = value => String(value || '').replace(/[&<>"']/g,ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const track = (event,properties={}) => {
  if (['senrajobs.com','www.senrajobs.com'].includes(location.hostname)) window.posthog?.capture?.(event,{site:location.hostname,...properties});
};
const payBuckets = [...new Set(roles.filter(role => role.pay).map(role => `${role.pay.currency}|${role.pay.period}`))].sort();
const sorts = {
  guests:[['latest','Latest episode'],['name','Name A to Z']],
  companies:[['name','Name A to Z'],['count','Most roles']],
  roles:[['role','Role A to Z'],['location','Location A to Z'],['department','Department A to Z'],['company','Company A to Z'],...payBuckets.map(bucket => ['pay|' + bucket,`Pay ${bucket.replace('|','/')}, high to low`])]
};
function defaults(view='guests') { return {view,guest:'',company:'',q:'',sort:sorts[view][0][0],location:'',role:'',pay:''}; }
function readState() {
  const params = new URLSearchParams(location.search);
  const guest = guests.find(guest => guest.name === params.get('guest'));
  const company = companies.find(company => company.name === params.get('company') && (!guest || company.guests.includes(guest.name)));
  const requested = params.get('view');
  const view = ['guests','companies','roles'].includes(requested) ? requested : company ? 'roles' : guest ? 'companies' : sorts.roles.some(([key])=>key===params.get('sort')) ? 'roles' : 'guests';
  const result = {...defaults(view),guest:view==='guests' ? '' : guest?.name || '',company:view==='roles' ? company?.name || '' : '',q:view==='roles' ? params.get('q') || '' : '',location:params.get('location') || '',role:params.get('role') || '',pay:params.get('pay') || ''};
  if (sorts[view].some(([key])=>key===params.get('sort'))) result.sort=params.get('sort');
  if (params.get('filter') === 'remote') result.location='remote';
  if (params.get('filter') === 'pay') result.pay='listed';
  if (!['','listed',...payBuckets].includes(result.pay)) result.pay='';
  return result;
}
let state = readState(), limit = 40, timer, renderTimer;
const personalFits=new Map();let hasProfileMatches=false,personalMode=false;
const searchCache=new Map(),locationCache=new Map();
function searchFields(role) {if(!searchCache.has(role.url))searchCache.set(role.url,{text:normalize(roleText(role)),title:normalize(role.title)});return searchCache.get(role.url);}
function locationFlags(role) {if(!locationCache.has(role.url))locationCache.set(role.url,{unknown:isLocationUnknown(role),remote:isUSRemotePossibility(role)});return locationCache.get(role.url);}
function urlFor(next) {
  const url = new URL(location.href);
  for (const key of ['view','guest','company','q','sort','location','role','pay','filter','preview']) url.searchParams.delete(key);
  for (const [key,value] of Object.entries(next)) {
    if (!value || (key==='view' && value==='guests') || (key==='sort' && value===sorts[next.view][0][0])) continue;
    url.searchParams.set(key,value);
  }
  return url;
}
function snapshot() { return {state:{...state},limit,scroll:scrollY}; }
function save() { history.replaceState({...history.state,board:true,...snapshot()},'',urlFor(state)); }
function configureControls() {
  $('directory-search').hidden=state.view!=='roles';
  $('q').value=state.q;
}
function roleText(role) { return `${role.title} ${role.company} ${role.employerBrand || ''} ${displayLocation(role)} ${role.department || ''} ${role.employmentType || ''} ${role.workplace || ''} ${role.founders.map(guest=>`${guest.name} ${guest.connection?.subject||''}`).join(' ')}`; }
function scopedCompanies() { return companies.filter(company=>!state.guest || company.guests.includes(state.guest)); }
function scopedRoles() { return roles.filter(role=>(!state.company || (role.companyAssociations||[role.company]).some(name=>name.split(' (')[0]===state.company)) && (!state.guest || role.founders.some(guest=>guest.name===state.guest))); }
function parentState() { return state.view==='roles' ? {...defaults('companies'),guest:state.guest} : defaults(); }
function renderContext() {
  document.body.classList.toggle('browsing',state.view!=='guests');
  const company=companies.find(company=>company.name===state.company);
  const guest=guests.find(guest=>guest.name===state.guest);
  $('context').hidden=state.view==='guests';
  $('context-title').textContent=company?.name || guest?.name || (state.view==='roles'?(personalMode?'Roles for you':'Roles'):'Companies');
  const connections=(company?.connections||[]).filter(c=>!state.guest||c.guest===state.guest);
  const connection=connections[0];
  $('context-connection').hidden=!connection;
  $('context-connection').replaceChildren();
  if(connection){const link=document.createElement('a');link.textContent=connection.label;link.href=connection.source;link.target='_blank';link.rel='noopener';$('context-connection').append(link);}
  const src=company?.logo || '';
  $('context-image').hidden=!src;
  if (src) $('context-image').src=src;
  $('back').textContent=state.view==='roles' ? `← ${state.guest||'Companies'}` : '← Guests';
  $('back').href=urlFor(parentState());
  document.title=company || guest ? `${company?.name || guest.name} · senrajobs.com` : 'senrajobs.com';
}
function mark(company) {
  return company.logo ? `<img class="company-logo" src="${escape(company.logo)}" alt="" width="40" height="40" loading="lazy">` : `<span class="company-initials" aria-hidden="true">${escape(company.name.split(/\s+/).slice(0,2).map(word=>word[0]).join(''))}</span>`;
}
function companyRow(company) {
  const connection=(company.connections||[]).find(c=>!state.guest||c.guest===state.guest);
  const content=`${mark(company)}<span class="company-name">${escape(company.name)}${connection?`<small class="company-connection">${escape(connection.label)}</small>`:''}</span>`;
  const count=company.roles.length ? `${company.roles.length.toLocaleString()} roles` : company.careers ? 'Careers' : 'No roles indexed';
  const direct=!company.roles.length&&company.careers;
  const link=direct?`data-careers href="${escape(company.careers)}" target="_blank" rel="noopener"`:`data-company="${escape(company.name)}" href="${escape(urlFor({...defaults('roles'),guest:state.guest,company:company.name}))}"`;
  return `<a class="company-row" ${link}>${content}<span class="company-count">${count}</span><span class="company-arrow" aria-hidden="true">${direct?'↗':'→'}</span></a>`;
}
function roleRow(role) {
  const company=companies.find(company=>company.name===(state.company||role.company.split(' (')[0]));
  const companyName=company?.name || role.company;
  const brand=role.employerBrand&&role.employerBrand!==companyName?role.employerBrand:'';
  const context=state.company&&!brand ? '' : `<p class="aggregate-context">${company?.logo&&!brand ? `<img class="company-logo" src="${escape(company.logo)}" alt="" width="24" height="24" loading="lazy">` : ''}<span>${escape(brand?(state.company?brand:`${brand} · ${companyName}`):companyName)}</span></p>`;
  const freshness=role.sourceStatus!=='current' ? `Previous data · observed ${new Date(role.observedAt).toLocaleDateString('en-US',{month:'short',day:'numeric'})}` : role.coverage?.status==='partial' ? (role.coverage.listingStatus==='complete'?'Some source details unavailable':'Partial source coverage') : '';
  const workplace=[role.employmentType,{onsite:'On-site',hybrid:'Hybrid',remote:'Remote'}[normalize(role.workplace)] || role.workplace].filter(Boolean).join(' · ');
  const fit=personalFits.get(role.url),label=fit?.incompatible?'Outside your requirements':fit?(fit.score!==null&&Number.isFinite(fit.score)?`${fit.score}/100`:fit.scoreRange?`${fit.scoreRange[0]}–${fit.scoreRange[1]}/100`:'Insufficient evidence')+' · '+(fit.tier==='U'?'provisional':fit.tier+' tier'):'Assess my fit';
  return `<article class="aggregate-role"><div><a class="aggregate-title" data-apply data-company="${escape(role.company)}" href="${escape(role.url)}" target="_blank" rel="noopener"><span class="role-emoji" aria-hidden="true">${roleEmoji(role.title)}</span><span class="role-title">${escape(role.title)}</span></a>${context}${freshness?`<p class="source-note">${escape(freshness)}</p>`:''}</div><div class="aggregate-meta"><p>${escape(displayLocation(role))}</p>${workplace?`<p>${escape(workplace)}</p>`:''}${role.pay || role.payRanges?.length ? `<p class="pay">${escape(formatPublishedPay(role))}</p>` : ''}${role.payNote?`<p class="source-note">${escape(role.payNote)}</p>`:''}${hasProfileMatches?`<button class="role-fit" data-assess="${escape(role.url)}" type="button" aria-label="${escape(label+' for '+role.title)}">${escape(label)} →</button>`:''}</div></article>`;
}
function render() {
  renderContext();
  const terms=normalize(state.q.trim()).split(/\s+/).filter(Boolean);
  const matches=text=>terms.every(term=>normalize(text).includes(term));
  $('list').hidden=state.view!=='guests'; $('companies-list').hidden=state.view!=='companies'; $('aggregate').hidden=state.view!=='roles';
  $('more-jobs').hidden=true; $('empty-careers').hidden=true; $('sort-note').hidden=true;
  $('location-note').hidden=state.view!=='roles';
  $('coverage-note').hidden=state.view!=='roles';
  $('source-details').hidden=state.view!=='roles';
  const filters=[state.q,...(state.view==='roles' ? [state.location,state.role,state.pay] : [])].filter(value=>value.trim());
  let count=0;
  if (state.view==='guests') {
    const order=[...cards];
    if (state.sort==='name') order.sort((a,b)=>a.dataset.guest.localeCompare(b.dataset.guest));
    for (const card of order) {
      const guest=guests.find(guest=>guest.name===card.dataset.guest);
      card.hidden=!matches(`${guest.name} ${guest.companies.join(' ')}`);
      count+=Number(!card.hidden); $('list').append(card);
    }
  } else if (state.view==='companies') {
    const guestOrder=guests.find(guest=>guest.name===state.guest)?.companies||[];
    const selected=scopedCompanies().filter(company=>matches(`${company.name} ${company.guests.join(' ')}`)).sort((a,b)=>state.guest ? guestOrder.indexOf(a.name)-guestOrder.indexOf(b.name) : (state.sort==='count' ? b.roles.length-a.roles.length : 0) || a.name.localeCompare(b.name));
    $('companies-list').innerHTML=selected.map(companyRow).join(''); count=selected.length;
  } else {
    const roleTerm=normalize(state.role.trim());
    const eligible=scopedRoles().filter(role=>terms.every(term=>searchFields(role).text.includes(term)) && searchFields(role).title.includes(roleTerm) && (!state.pay || (state.pay==='listed' ? !!role.pay || !!role.payRanges?.length : `${role.pay?.currency}|${role.pay?.period}`===state.pay)));
    const selected=eligible.filter(role=>matchesLocation(role,state.location)).sort((a,b)=>personalMode?((personalFits.get(b.url)?.scoreRange?.[0]??-1)-(personalFits.get(a.url)?.scoreRange?.[0]??-1)||compareRoles(a,b,state.sort)):compareRoles(a,b,state.sort));
    const unknown=eligible.filter(role=>locationFlags(role).unknown).length,remote=eligible.filter(role=>locationFlags(role).remote).length;
    const texasMode=/^(?:texas|tx)$/i.test(state.location.trim());
    const workplace=texasMode ? `${selected.filter(role=>/^(?:onsite|hybrid)$/i.test(role.workplace||'')).length} on-site/hybrid; ${selected.filter(role=>/^remote$/i.test(role.workplace||'')).length} remote; ${selected.filter(role=>!role.workplace).length} workplace unspecified. ` : '';
    $('location-note').innerHTML=`${texasMode?'Published Texas job locations. '+workplace:''}<a href="${escape(urlFor({...state,location:'US remote'}))}" data-location="US remote">${remote} US-remote possibilities</a> require Texas eligibility confirmation. <a href="${escape(urlFor({...state,location:'Location unknown'}))}" data-location="Location unknown">${unknown} unknown locations</a>.`;
    const selectedCoverage=coverage.companies.find(company=>company.company===state.company);
    const completeListing=selectedCoverage?.boards?.length&&selectedCoverage.boards.every(board=>board.listingStatus==='complete');
    const sourceNote=selectedCoverage?.status==='partial'&&completeListing?`${escape(state.company)}’s observed listing pages are fully collected; ${selectedCoverage.unknownLocations} locations remain unknown. Descriptions may be incomplete. `:'';
    $('coverage-note').innerHTML=`${sourceNote}${coverage.counts.complete}/${coverage.counts.employers} employers have complete observed coverage. This index is not exhaustive. <a href="/data/coverage.json" target="_blank" rel="noopener">Coverage</a> · <a href="/data/texas-roles.json" target="_blank" rel="noopener">Texas inventory</a>`;
    $('aggregate').innerHTML=(personalMode?'<p id="personal-fit-note">Assessed roles first. Choose any other role to check its fit.</p>':'')+selected.slice(0,limit).map(roleRow).join(''); count=selected.length; $('more-jobs').hidden=count<=limit;
    if (state.sort.startsWith('pay|')) { const [,currency,period]=state.sort.split('|'); $('sort-note').hidden=false; $('sort-note').textContent=`${currency}/${period} · Highest published maximum first; other pay follows.`; }
    if (!count && state.company && !filters.length) {
      const company=companies.find(company=>company.name===state.company);
      $('empty-message').textContent='No roles indexed yet.';
      if (company.careers) { $('empty-careers').href=company.careers; $('empty-careers').hidden=false; }
    }
  }
  const noun=state.view==='guests' ? 'guest' : state.view==='companies' ? 'company' : 'role';
  $('results').textContent=`${count.toLocaleString()} ${count===1 ? noun : noun==='company' ? 'companies' : noun+'s'}${state.view==='roles' && count>limit ? ` · showing ${limit}` : ''}`;
  $('results').hidden=state.view==='companies'&&!!state.guest;
  $('empty').hidden=count>0;
  if (state.view==='companies' && !count && state.guest && !state.q.trim()) $('empty-message').textContent='No current companies listed.';
  else if (state.view!=='roles' || !state.company || filters.length) $('empty-message').textContent='No matches. Try another search.';
  return count;
}
function go(next) {
  clearTimeout(renderTimer);
  save(); const parent=snapshot();
  personalMode=false;state={...defaults(next.view),...next}; limit=40;
  history.pushState({board:true,...snapshot(),scroll:0,parent},'',urlFor(state));
  configureControls(); render(); window.scrollTo(0,0);
  const focus=$('context').hidden ? document.querySelector('h1') : $('context-title');
  focus.focus({preventScroll:true});
}
configureControls(); render(); save();
window.addEventListener('senra:matches',event=>{
  hasProfileMatches=true;for(const match of event.detail.matches||[])if(byUrl.has(match.url))personalFits.set(match.url,match);
  if(event.detail.incompatible&&byUrl.has(event.detail.targetUrl))personalFits.set(event.detail.targetUrl,{incompatible:true});
  render();
});
window.addEventListener('senra:profile-changed',()=>{personalFits.clear();hasProfileMatches=false;personalMode=false;render();});
window.addEventListener('senra:explore-matches',()=>{go({view:'roles'});personalMode=true;render();});
window.addEventListener('popstate',()=>{
  const previousGuest=state.guest;
  personalMode=false;
  state=readState(); limit=history.state?.board ? history.state.limit || 40 : 40;
  configureControls(); render();
  requestAnimationFrame(()=>{window.scrollTo(0,history.state?.board ? history.state.scroll || 0 : 0);const focus=state.view==='guests'?cards.find(card=>card.dataset.guest===previousGuest)||document.querySelector('h1'):$('context-title');focus.focus({preventScroll:true});});
});
$('back').addEventListener('click',event=>{
  if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  const target=parentState(),previous=history.state?.parent?.state;
  if (history.state?.board && previous && ['view','guest','company'].every(key=>(previous[key]||'')===(target[key]||''))) history.back(); else go(target);
});
for (const [id,key] of [['q','q']]) {
  $(id).addEventListener('input',()=>{
    state[key]=$(id).value; limit=40; clearTimeout(renderTimer);
    const update=()=>{const count=render();save();clearTimeout(timer);timer=setTimeout(()=>track(count ? 'directory_searched' : 'directory_no_results',{view:state.view,result_count:count,has_query:!!state.q,filter:key}),700);};
    renderTimer=setTimeout(update,120);
  });
}
$('more-jobs').addEventListener('click',()=>{limit+=40;render();save();});
document.querySelector('main').addEventListener('click',event=>{
  const assess=event.target.closest('[data-assess]');
  if(assess){window.dispatchEvent(new CustomEvent('senra:assess-role',{detail:{url:assess.dataset.assess}}));return;}
  const guest=event.target.closest('[data-guest]');
  const company=event.target.closest('a[data-company]:not([data-apply]):not([data-careers])');
  if (!(event.ctrlKey || event.metaKey || event.shiftKey || event.altKey)) {
    if (guest) { event.preventDefault();go({view:'companies',guest:guest.dataset.guest});track('founder_opened',{founder:state.guest}); }
    if (company) { event.preventDefault();go({view:'roles',guest:state.guest,company:company.dataset.company});track('company_opened',{company:state.company}); }
  }
  const apply=event.target.closest('[data-apply]');
  const locationLink=event.target.closest('[data-location]');
  if(locationLink && !(event.ctrlKey || event.metaKey || event.shiftKey || event.altKey)){event.preventDefault();state.location=locationLink.dataset.location;limit=40;render();save();track('jobs_filtered',{view:state.view,filter:'location'});}
  if (apply) track('job_apply_clicked',{company:apply.dataset.company,title:apply.querySelector('.role-title').textContent});
});
