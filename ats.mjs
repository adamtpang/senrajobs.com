import { ashbyPay, leverPay, normalizePay } from './job-utils.mjs';
import { basePay } from './base-pay.mjs';
import { fetchAtoms,selectAtomsBrand } from './atoms-feed.mjs';
import { isLocationUnknown, texasEvidence } from './location-utils.mjs';
import { fetchEmployerBoard } from './employer-feeds.mjs';
import { fetchSuccessFactors } from './successfactors.mjs';
import { fetchWholeFoods } from './wholefoods-feed.mjs';
import { fetchQxo } from './qxo-feed.mjs';
import { fetchMari } from './mari-feed.mjs';
import { fetchTakeTwo,fetchNaturalMotion } from './taketwo-feed.mjs';
import { fetchCanes } from './canes-feed.mjs';
import { fetchUnitedMasters } from './unitedmasters-feed.mjs';
import { fetchMedici } from './medici-feed.mjs';
import { fetchWorkday } from './workday-feed.mjs';
import { dysonPay } from './dyson-pay.mjs';
import { snapPay } from './snap-pay.mjs';
import { fetchCulinary } from './culinary-feed.mjs';
import { fetchNode,fetchCrystal } from './scoped-foundation-studio-feed.mjs';
import { fetchPayPal } from './paypal-feed.mjs';
import { fetchFlexjet } from './flexjet-feed.mjs';
import { fetchBeats } from './beats-feed.mjs';
import { fetchAdp } from './adp-feed.mjs';
import { fetchBambooHr } from './bamboohr-feed.mjs';
import { fetchDellFoundation } from './dell-foundation-feed.mjs';
import { fetchCiFinancial } from './ci-feed.mjs';
export const SOURCE_OVERRIDES = {
  'Flexjet (chairman)':{kind:'flexjet-public',slug:'flexjet',identityUrl:'https://careers.flexjet.com/us/en',scope:'Global group search plus direct public ATS. Exact requisition mirrors and public brand labels preserved; manual reconciliation required.'},
  'Sentient Jet (chairman)':{kind:'scoped-manual',slug:'sentient-jet',identityUrl:'https://sentient.com/private-jet-careers/',scope:'Named employer board; its current role mirrors Flexjet and uses the shared canonical URL.'},
  'Corporate Wings (early owner and operator)':{kind:'scoped-manual',slug:'corporate-wings',identityUrl:'https://corporatewings.com/careers',scope:'Exact Corporate Wings public board; no parent or portfolio expansion.'},
  'Flexjet Technical Services (Nextant Aerospace / Constant Aviation operations)':{kind:'flexjet-public',slug:'flexjet-technical',identityUrl:'https://careers.flexjet.com/us/en/c/aircraft-maintenance-and-support-jobs',scope:'Only explicit Technical Services assignments; parent mirrors deduplicated and other division roles remain unknown.'},
  'Beats by Dre':{kind:'beats-public',slug:'beats',identityUrl:'https://jobs.apple.com/en-us/search?product=beats-audio-accessories-BTSAA',scope:'Only postings Apple lists under its Beats product filter. Never widened to other Apple jobs.'},
  'Love.Life':{kind:'adp-public',slug:'17763c3e-6689-4e44-8e0b-eac90764d9d5|9200392115678_2',identityUrl:'https://workforcenow.adp.com/mascsr/default/mdf/recruitment/recruitment.html?cid=17763c3e-6689-4e44-8e0b-eac90764d9d5&ccId=9200392115678_2&lang=en_US',scope:'Love.Life public ADP career center only.'},
  'TrailRunner International (co-founder; former president)':{kind:'bamboohr-public',slug:'trailrunner',identityUrl:'https://trailrunner.bamboohr.com/careers',scope:'TrailRunner public BambooHR board only.'},
  'Michael & Susan Dell Foundation':{kind:'dell-foundation-public',slug:'dellfoundation',identityUrl:'https://www.dell.org/careers/',scope:'Only jobs listed on the foundation careers page.'},
  'NODE Foundation (co-founder; nonprofit)':{kind:'node-public',slug:'nodefoundation',identityUrl:'https://nodefoundation.com/careers',scope:'Named nonprofit employer. Promotional/uncertain listings and general expressions of interest are excluded.'},
  'Crystal Dynamics (former president and CEO)':{kind:'crystal-public',slug:'crystaldynamics',identityUrl:'https://www.crystaldynamics.com/careers/',scope:'Named studio board; historical Zelnick executive association. Graduate cohort eligibility and conflicting pay sections are preserved.'},
  'USC Iovine and Young Academy (co-founder; nonprofit school)':{kind:'scoped-manual',slug:'usc-academy',identityUrl:'https://iovine-young.usc.edu/faculty-positions',scope:'Only Academy-assigned roles manually verified from official descriptions. No university-wide import.'},
  '20th Century Studios (formerly 20th Century Fox; former president and COO)':{kind:'scoped-manual',slug:'20th-century-studios',identityUrl:'https://join.disneycareers.com/global/en/20th-century-studios',scope:'Only explicit studio assignments or the named film corporation as employer. Shared Disney roles are excluded; manual detail review required.'},
  'CI Financial (CEO; not founder)':{kind:'ci-public',slug:'ci-financial',identityUrl:'https://ci.wd3.myworkdayjobs.com/en-US/CI_FINANCIAL_EXTERNAL_CAREER-SITE',scope:'Separate CI public board. Manual refresh must retain verified Corient cross-post deduplication; generic Workday import would duplicate a requisition.'},
  'PayPal (Elon Musk; episode subject; historical co-founder)':{kind:'paypal-public',slug:'paypal',identityUrl:'https://paypal.eightfold.ai/careers',scope:'Public employee board. Moving totals and uncollected contractor channel make coverage partial; paced manual refresh and detail verification required.'},
  'OnePay (Walmart-Ribbit venture; Malka founding-board association)':{kind:'ashby',slug:'oneapp',identityUrl:'https://www.onepay.com/careers',scope:'Official OnePay careers page links the legacy oneapp Ashby account. Venture-building/founding-board association with Micky Malka, not a current CEO claim or a general Ribbit portfolio expansion.'},
  'Major Food Group':{kind:'culinary-public',slug:'majorfood',identityUrl:'https://www.majorfood.com/careers',scope:'Official careers page embeds Culinary Agents client CA-DS-MAJORFOOD16, majorfood-select. Restaurant brands inherit only explicit widget membership; other brand channels remain unverified.'},
  Dyson:{kind:'workday',slug:'dyson|wd3|dyson_careers',identityUrl:'https://careers.dyson.com/en-gb/job-description/national-account-manager-home-direct-ecommerce/JR37846/',scope:'Official Dyson job-detail Apply links identify the public dyson_careers Workday site. The independent careers search was exhausted and reconciled by requisition ID; additional Workday-only postings are retained with their public detail evidence.'},
  'Uber (co-founder, no longer leads)':{kind:'oracle-uber',slug:'uber',identityUrl:'https://jobs.uber.com/en/',scope:'Uber’s official careers footer links jobs.uber.com; its sign-in link identifies the public Oracle UberCareers site. Employee roles only; driver and courier sign-ups are not job postings in this inventory.'},
  'UnitedMasters / Translation (shared careers board)':{kind:'unitedmasters-public',slug:'unitedmasterstranslation',identityUrl:'https://job-boards.greenhouse.io/unitedmasterstranslation',scope:'The employer-branded shared board publishes UnitedMasters, Translation and Shared Services departments. Job brand follows its public hierarchy; neither brand receives the other’s roles.'},
  "Raising Cane's":{kind:'canes-public',slug:'raisingcanes',identityUrl:'https://jobs.raisingcanes.com/',scope:'Public Raising Cane’s careers search; emitted pagination links and advertised totals are checked. Internal/private flags are excluded.'},
  RXO:{kind:'workday',slug:'rxo|wd501|rxojobs',identityUrl:'https://rxo.com/join-our-team/'},
  'Medici Brands (co-founder; parent group)':{kind:'medici-public',slug:'all',identityUrl:'https://davidprotein.com/pages/careers',scope:'Shared group widget for Medici, David Protein, HallPass and Epogee. Brand assignments are explicit; no independent global total.'},
  'David Protein':{kind:'medici-public',slug:'David Protein',identityUrl:'https://davidprotein.com/pages/careers'},
  'HallPass (Medici brand)':{kind:'medici-public',slug:'HallPass',identityUrl:'https://davidprotein.com/pages/careers'},
  'Epogee (Medici subsidiary)':{kind:'medici-public',slug:'Epogee',identityUrl:'https://davidprotein.com/pages/careers'},
  'NaturalMotion (co-founder; now part of Zynga)':{kind:'naturalmotion-public',slug:'nmcareers',identityUrl:'https://www.naturalmotion.com/who-we-are/',scope:'The official NaturalMotion site links nmcareers. This studio still operates after acquisition; only its own public roles are associated with Torsten Reil.'},
  'MARI (founder)':{kind:'mari-public',slug:'mari',identityUrl:'https://mari.careers.hibob.com/',scope:'MARI public job ads plus TodayTix Group, explicitly linked on MARI’s careers page. Other portfolio hiring channels and city-level site detail remain unreconciled.'},
  QXO:{kind:'qxo-public',slug:'qxo',identityUrl:'https://www.qxo.com/careers',scope:'QXO external search plus officially linked TopBuild careers. Other acquired-employer channels, including Kodiak brands, remain unreconciled. TopBuild acquisition source: https://investors.qxo.com/news/news-details/2026/QXO-Completes-Acquisition-of-TopBuild/default.aspx'},
  'Take-Two Interactive (CEO)':{kind:'taketwo-public',slug:'taketwo',identityUrl:'https://careers.take2games.com/jobs',scope:'Take-Two corporate, 2K, Rockstar, NaturalMotion, Zynga and Ghost Story Games public Greenhouse accounts; mirrored requisitions deduplicated. Additional subsidiary/studio channels remain unreconciled. Parent relationships: https://careers.take2games.com/ and https://www.take2games.com/labels/en-US/.'},
  'Whole Foods Market':{kind:'wholefoods-page',slug:'wholefoods',identityUrl:'https://careers.wholefoods.com/',scope:'Public Whole Foods careers site; separately linked Amazon corporate roles are not included.'},
  '37signals':{kind:'signals-page',slug:'37signals',identityUrl:'https://37signals.com/jobs'},
  'GXO Logistics':{kind:'successfactors-page',slug:'gxo',identityUrl:'https://jobs.gxo.com/'},
  XPO:{kind:'successfactors-page',slug:'xpo',identityUrl:'https://jobs.xpo.com/'},
  'SpaceX / Starlink (Elon Musk; episode subject)':{kind:'greenhouse',slug:'spacex',identityUrl:'https://www.spacex.com/careers/'},
  'Neuralink (Elon Musk; episode subject)':{kind:'greenhouse',slug:'neuralink',identityUrl:'https://neuralink.com/careers/'},
  'xAI / X (Elon Musk; episode subject)':{kind:'greenhouse',slug:'xai',identityUrl:'https://x.ai/careers/open-roles'},
  'The Boring Company (Elon Musk; episode subject)':{kind:'boring-page',slug:'boringcompany',identityUrl:'https://www.boringcompany.com/careers'},
  'Dell Technologies':{kind:'oracle-dell',slug:'dell',identityUrl:'https://jobs.dell.com/'},
  Shopify:{kind:'shopify-page',slug:'shopify',identityUrl:'https://www.shopify.com/careers'},
  'Bending Spoons':{kind:'spoons-page',slug:'bendingspoons',identityUrl:'https://jobs.bendingspoons.com/'},
  Corient:{kind:'workday',slug:'ci|wd3|CORIENT_EXTERNAL_CAREER-SITE',identityUrl:'https://corient.com/us/en/careers'},
  OpenAI:{kind:'ashby',slug:'openai'}, ElevenLabs:{kind:'ashby',slug:'elevenlabs'}, 'Base Power':{kind:'ashby',slug:'base-power'}, 'Neko Health':{kind:'ashby',slug:'neko-health'},
  Snap:{kind:'workday',slug:'snapchat|wd1|snap'}, 'Nvidia (Ross Chief Software Architect; confirmed July 2026)':{kind:'workday',slug:'nvidia|wd5|NVIDIAExternalCareerSite'},
  'Atoms (formerly City Storage Systems)':{kind:'atoms-public',slug:'all',identityUrl:'https://atoms.co/openroles'},
  CloudKitchens:{kind:'atoms-public',slug:'CloudKitchens',identityUrl:'https://atoms.co/openroles?company=CloudKitchens'},
  'Pronto AI (Atoms group company)':{kind:'atoms-public',slug:'Pronto AI',identityUrl:'https://atoms.co/openroles?company=Pronto'},
  'Lab37 (Atoms group company)':{kind:'atoms-public',slug:'Lab37',identityUrl:'https://www.lab37.us/careers'},
  'Otter (Atoms group company)':{kind:'atoms-public',slug:'Otter',identityUrl:'https://www.tryotter.com/jobs'},
  'Picnic (Atoms group company)':{kind:'atoms-public',slug:'Picnic',identityUrl:'https://trypicnic.com/careers'},
  'WME Group (executive chairman)':{kind:'workday',slug:'wmeimg|wd1|WMEGRP',identityUrl:'https://wmegrp.com/'},
  'TKO Group Holdings':{kind:'workday',slug:'wwecorp|wd5|TKO',identityUrl:'https://tkogrp.com/contact/'},
};
const patterns=[
 ['greenhouse',/(?:boards|job-boards)(?:\.eu)?\.greenhouse\.io\/(?:embed\/job_board(?:\/js)?\?for=)?([a-z0-9_-]+)/i],
 ['greenhouse',/boards-api\.greenhouse\.io\/v1\/boards\/([a-z0-9_-]+)/i],
 ['lever',/jobs(?:\.eu)?\.lever\.co\/([a-z0-9_.-]+)/i],['ashby',/jobs\.ashbyhq\.com\/([a-z0-9_.%-]+)/i],
 ['smartrecruiters',/(?:careers|jobs)\.smartrecruiters\.com\/([a-z0-9_-]+)/i],['workable',/apply\.workable\.com\/([a-z0-9_-]+)/i],
 ['workday',/([a-z0-9-]+)\.(wd\d+)\.myworkdayjobs\.com\/(?:[a-z]{2}-[A-Z]{2}\/)?([A-Za-z0-9_-]+)/]
];
export async function requestPublic(url, options={}) {
 try { const r=await fetch(url,{...options,headers:{'user-agent':'Mozilla/5.0 (senrajobs.com public job index)',...options.headers},signal:AbortSignal.timeout(18000)}); const text=await r.text(); let data;try{data=JSON.parse(text);}catch{}return {ok:r.ok,status:r.status,url:r.url,data,text,error:r.ok?'':`HTTP ${r.status}`}; }
 catch(error){return {ok:false,url,error:error.name==='TimeoutError'?'timeout':error.message};}
}
export async function detectSource(careers,request=requestPublic) {
 const identify=text=>{for(const [kind,re]of patterns){const m=text.match(re);if(m&&!['embed','api','v1','js','static','assets','jobs','careers'].includes(m[1].toLowerCase()))return {kind,slug:kind==='workday'?`${m[1]}|${m[2]}|${m[3]}`:m[1]};}return null;};
 const direct=identify(careers);if(direct)return {source:direct};
 const page=await request(careers);if(!page.ok)return {error:page.error,failed:true};
 return {source:identify(`${page.url} ${page.text}`),error:'No supported public ATS found on the official careers page'};
}
const asArray=value=>value==null?[]:Array.isArray(value)?value:[value];
export function sourceIdentityMatches(source,name) {
 if(source.kind==='ashby'&&name==='OnePay (Walmart-Ribbit venture; Malka founding-board association)')return source.slug==='oneapp';
 const norm=value=>decodeURIComponent(value).toLowerCase().replace(/[^a-z0-9]/g,'');
 const brand=name.split(' (')[0];
 if(source.kind==='node-public')return brand==='NODE Foundation'&&source.slug==='nodefoundation';
 if(source.kind==='crystal-public')return brand==='Crystal Dynamics'&&source.slug==='crystaldynamics';
 if(source.kind==='scoped-manual')return ({'USC Iovine and Young Academy':'usc-academy','20th Century Studios':'20th-century-studios','Sentient Jet':'sentient-jet','Corporate Wings':'corporate-wings'})[brand]===source.slug;
 if(source.kind==='flexjet-public')return ({Flexjet:'flexjet','Flexjet Technical Services':'flexjet-technical'})[brand]===source.slug;
 if(source.kind==='ci-public')return brand==='CI Financial'&&source.slug==='ci-financial';
 if(source.kind==='paypal-public')return brand==='PayPal'&&source.slug==='paypal';
 if(source.kind==='beats-public')return brand==='Beats by Dre'&&source.slug==='beats';
 if(source.kind==='adp-public')return brand==='Love.Life'&&source.slug==='17763c3e-6689-4e44-8e0b-eac90764d9d5|9200392115678_2';
 if(source.kind==='bamboohr-public')return brand==='TrailRunner International'&&source.slug==='trailrunner';
 if(source.kind==='dell-foundation-public')return brand==='Michael & Susan Dell Foundation'&&source.slug==='dellfoundation';
 if(source.kind==='culinary-public')return brand==='Major Food Group'&&source.slug==='majorfood';
 if(source.kind==='unitedmasters-public')return brand==='UnitedMasters / Translation'&&source.slug==='unitedmasterstranslation';
 if(source.kind==='canes-public')return brand==="Raising Cane's"&&source.slug==='raisingcanes';
 if(source.kind==='medici-public')return ({'Medici Brands':'all','David Protein':'David Protein',HallPass:'HallPass',Epogee:'Epogee'})[brand]===source.slug;
 if(source.kind==='atoms-public')return ({Atoms:'all',CloudKitchens:'CloudKitchens','Pronto AI':'Pronto AI',Lab37:'Lab37',Otter:'Otter',Picnic:'Picnic'})[brand]===source.slug;
 // These renamed companies retain legacy Workday tenants. Trust only the
 // specific employer site linked by the current official company website.
 if(source.kind==='workday' && brand==='WME Group' && source.slug==='wmeimg|wd1|WMEGRP')return true;
 if(source.kind==='workday' && brand==='TKO Group Holdings' && source.slug==='wwecorp|wd5|TKO')return true;
  if(source.kind==='workday' && brand==='Corient' && source.slug==='ci|wd3|CORIENT_EXTERNAL_CAREER-SITE')return true;
  if(source.kind==='oracle-dell' && brand==='Dell Technologies' && source.slug==='dell')return true;
 if(source.kind==='oracle-uber')return brand==='Uber'&&source.slug==='uber';
 if(source.kind==='greenhouse'&&((brand==='SpaceX / Starlink'&&source.slug==='spacex')||(brand==='xAI / X'&&source.slug==='xai')))return true;
 if(source.kind==='boring-page'&&brand==='The Boring Company'&&source.slug==='boringcompany')return true;
 if(source.kind==='successfactors-page'&&brand==='GXO Logistics'&&source.slug==='gxo')return true;
 if(source.kind==='wholefoods-page'&&brand==='Whole Foods Market'&&source.slug==='wholefoods')return true;
 if(['greenhouse','taketwo-public'].includes(source.kind)&&brand==='Take-Two Interactive'&&source.slug==='taketwo')return true;
 if(source.kind==='naturalmotion-public'&&brand==='NaturalMotion'&&source.slug==='nmcareers')return true;
 const aliases={'Atoms':['atoms','citystoragesystems'], 'Andreessen Horowitz':['a16z','andreessenhorowitz'], 'Creative Artists Agency':['caa','creativeartistsagency'], Snap:['snapchat','snap'], 'United Rentals':['ur','unitedrentals']};
 const account=norm(source.slug.split('|')[0]);
 return [norm(brand),...(aliases[brand]||[])].some(alias=>account===alias || account===alias+'usa' || account===alias+'jobs');
}
const label=value=>typeof value==='string'?value:value?.name || value?.descriptor || '';
export function locationRecord(raw,address={},sourceUrl='',observedAt='',source='ats') {
 const a=address?.postalAddress || address || {};
 return {raw:label(raw),city:a.addressLocality||a.city||'',state:a.addressRegion||a.region||a.state||'',country:label(a.addressCountry||a.country||a.countryName),sourceUrl,observedAt,source,confidence:'published'};
}
function decode(text=''){return text.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&amp;/g,'&').replace(/&nbsp;/g,' ');}
export function structuredJob(html) {
 const found=[];
 const walk=x=>{if(Array.isArray(x))return x.forEach(walk);if(!x||typeof x!=='object')return;if(asArray(x['@type']).includes('JobPosting'))found.push(x);if(x['@graph'])walk(x['@graph']);};
 for(const m of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){try{walk(JSON.parse(m[1]));}catch{}}
 return found;
}
function payFromStructured(job){const salary=asArray(job.baseSalary)[0];const v=salary?.value;return normalizePay({min:v?.minValue??v?.value,max:v?.maxValue??v?.value,currency:salary?.currency,period:String(v?.unitText||'').toLowerCase()});}
function explicitWorkplace(content){const text=decode(content).replace(/<[^>]*>/g,' ').replace(/\s+/g,' ');const mode=text.match(/#LI-(Onsite|Hybrid|Remote)\b/i);if(mode)return {workplace:{onsite:'OnSite',hybrid:'Hybrid',remote:'Remote'}[mode[1].toLowerCase()],workplaceEvidence:mode[0]};const m=text.match(/(?:work onsite, (?:five|5) days a week|(?:5|five) days[^.]{0,45}(?:in[- ]office|in (?:the )?office|on[- ]site))/i);return m?{workplace:'OnSite',workplaceEvidence:m[0]}:{};}
export function publishedSalary(content,sourceUrl){
 const text=decode(content||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ');
 const m=text.match(/(?:base salary range|annual base salary|salary range)(?: for (?:this|the) (?:role|position))?\s*(?:is|:)?\s*\$([\d,]+(?:\.\d+)?)\s*(?:-|\u2013|to)\s*\$([\d,]+(?:\.\d+)?)\s*(?:per year|annually|a year)/i);
 return m?{min:Number(m[1].replace(/,/g,'')),max:Number(m[2].replace(/,/g,'')),currency:null,displayCurrency:'$',period:'year',type:/base/i.test(m[0])?'Base salary':'Salary',publishedText:m[0],sourceUrl}:null;
}
export function mapATSJob(kind,j,endpoint,observedAt,source={}) {
 let raw='',secondary=[],locations=[],role={id:String(j.id||j.shortcode||j.requisitionId||''),sourceUrl:endpoint,observedAt,sourceStatus:'current',locationSource:'ats'};
 const rec=(value,address)=>locationRecord(value,address,endpoint,observedAt);
 if(kind==='greenhouse'){
  // Office associations describe the employer's organization, not job-site eligibility.
  raw=j.location?.name||'';secondary=(j.metadata||[]).filter(m=>/^locations?|secondary locations?$/i.test(m.name)).flatMap(m=>asArray(m.value)).filter(v=>typeof v==='string');
  role={...role,title:j.title,url:j.absolute_url,department:j.departments?.map(d=>d.name).join(' / ')||'',publishedAt:j.first_published||j.updated_at||'',rawOfficeAssociations:j.offices||[],...explicitWorkplace(j.content)};
  if(j.pay_input_ranges?.length)role.payRanges=j.pay_input_ranges.map(range=>({min:range.min_cents/100,max:range.max_cents/100,currency:range.currency_type,period:null,type:'published salary range',label:range.title}));
  const salary=publishedSalary(j.content,endpoint);if(salary&&!role.payRanges?.length)role.payRanges=[salary];
 }else if(kind==='ashby'){
  raw=j.location||'';secondary=(j.secondaryLocations||[]).map(l=>l.location).filter(Boolean);locations=[rec(raw,j.address),...(j.secondaryLocations||[]).map(l=>rec(l.location,l.address))];
  role={...role,title:j.title,url:j.jobUrl,department:j.department||'',workplace:j.workplaceType||(j.isRemote?'Remote':''),pay:ashbyPay(j.compensation),payType:j.compensation?'Salary':'',publishedAt:j.publishedAt||'',employmentType:j.employmentType||'',rawSecondaryLocations:j.secondaryLocations||[],applicantLocationRequirements:j.applicantLocationRequirements||[]};
  Object.assign(role,basePay(j,endpoint)||{});
 }else if(kind==='lever'){
  raw=j.categories?.location||'';secondary=j.categories?.allLocations||[];
  role={...role,title:j.text,url:j.hostedUrl,department:j.categories?.department||j.categories?.team||'',workplace:j.workplaceType||'',pay:leverPay(j.salaryRange),payType:j.salaryRange?'Salary':'',employmentType:j.categories?.commitment||''};
 }else if(kind==='smartrecruiters'){
  raw=[j.location?.city,j.location?.region,j.location?.country].filter(Boolean).join(', ');locations=[rec(raw,j.location)];
  role={...role,title:j.name,url:`https://jobs.smartrecruiters.com/${source.slug}/${j.id}`,workplace:j.location?.remote?'Remote':'',department:j.department?.label||''};
 }else if(kind==='workable'){
  raw=j.location||j.city||j.country||'';if(typeof raw!=='string')raw=raw.location_str||[raw.city,raw.region,raw.country].filter(Boolean).join(', ');
  locations=[rec(raw,j)];role={...role,title:j.title,url:j.url||j.shortlink,workplace:j.telecommuting?'Remote':''};
 }else if(kind==='workday'){
  raw=j.locationsText||'';
  const [tenant,wd,site]=source.slug.split('|');const base=`https://${tenant}.${wd}.myworkdayjobs.com`;
  role={...role,title:j.title,url:`${base}/${site}${j.externalPath}`,id:j.bulletFields?.[0]||j.externalPath,detailApi:`${base}/wday/cxs/${tenant}/${site}${j.externalPath}`};
 }
 if(!locations.length)locations=[rec(raw),...secondary.map(value=>rec(value))];
 locations=locations.filter(l=>l.raw||l.city||l.state||l.country);
 return {...role,location:label(raw),rawLocation:j.location??j.locationsText??raw,secondaryLocations:[...new Set(secondary.filter(v=>typeof v==='string'&&v!==raw))],locations,locationStatus:isLocationUnknown({location:label(raw),locations})?'unknown':'published'};
}
export async function fetchBoard(source,{request=requestPublic,maxPages=500,observedAt=new Date().toISOString(),preferredUrls=[]}={}) {
 if(source.kind==='node-public')return fetchNode({request,observedAt});
 if(source.kind==='crystal-public')return fetchCrystal({request,observedAt,mapJob:mapATSJob});
 if(source.kind==='scoped-manual')return {rows:[],status:'failed',observedAt,endpoint:source.identityUrl,reason:'This scoped source requires a fresh manual employer-assignment review; retaining prior verified roles with their original observation dates. Parent-wide discovery is disabled.'};
 if(source.kind==='atoms-public'){const result=await fetchAtoms({request,observedAt,mapJob:mapATSJob,preferredUrls});return source.slug==='all'?result:selectAtomsBrand(result,source.slug);}
 if(source.kind==='flexjet-public')return fetchFlexjet(source,{request,observedAt});
 if(source.kind==='ci-public')return fetchCiFinancial({request,maxPages,observedAt,mapJob:mapATSJob});
 if(source.kind==='paypal-public')return fetchPayPal({request,observedAt});
 if(source.kind==='beats-public')return fetchBeats({request,observedAt});
 if(source.kind==='adp-public')return fetchAdp(source,{request,observedAt});
 if(source.kind==='bamboohr-public')return fetchBambooHr(source,{request,observedAt});
 if(source.kind==='dell-foundation-public')return fetchDellFoundation({request,observedAt});
 if(source.kind==='culinary-public')return fetchCulinary({request,observedAt});
 if(source.kind==='workday')return fetchWorkday(source,{request,maxPages,observedAt,mapJob:mapATSJob});
 if(source.kind==='medici-public')return fetchMedici(source,{request,observedAt});
 if(source.kind==='taketwo-public')return fetchTakeTwo({request,observedAt,mapJob:mapATSJob});
 if(source.kind==='naturalmotion-public')return fetchNaturalMotion({request,observedAt,mapJob:mapATSJob});
 if(source.kind==='canes-public')return fetchCanes({request,observedAt,maxPages});
 if(source.kind==='unitedmasters-public')return fetchUnitedMasters({request,observedAt,mapJob:mapATSJob});
 if(source.kind==='qxo-public')return fetchQxo({request,observedAt,maxPages});
 if(source.kind==='mari-public')return fetchMari({request,observedAt});
 if(source.kind==='wholefoods-page')return fetchWholeFoods({request,maxPages,observedAt});
 if(source.kind==='successfactors-page')return fetchSuccessFactors(source,{request,maxPages,observedAt});
 if(['oracle-dell','oracle-uber','shopify-page','spoons-page','boring-page','signals-page'].includes(source.kind))return fetchEmployerBoard(source,{request,maxPages,observedAt});
 if(source.kind==='rippling'){
  const endpoint=`https://ats.rippling.com/api/v2/board/${encodeURIComponent(source.slug)}/jobs`;
  const rows=[]; const seen=new Set(); let pages=0, total=null, status='complete', reason='';
  for(let page=0; page<30; page++){
   const result=await request(`${endpoint}?page=${page}`); pages++;
   const items=result.data?.items;
   if(!result.ok||!Array.isArray(items)){ status=rows.length?'partial':'failed'; reason=result.error||'Unexpected response'; break; }
   if(!items.length) break;
   if(Number.isFinite(result.data.totalItems)) total=result.data.totalItems;
   for(const job of items){
    if(!job?.url||seen.has(job.url)) continue; seen.add(job.url);
    const places=(job.locations||[]).map(l=>l.name||[l.city,l.stateCode].filter(Boolean).join(', ')).filter(Boolean);
    const workplace=(job.locations||[]).some(l=>/REMOTE/i.test(l.workplaceType||''))?'Remote':(job.locations||[]).some(l=>/ON_SITE|HYBRID/i.test(l.workplaceType||''))?'OnSite':'';
    const locations=(job.locations||[]).map(l=>locationRecord(l.name||[l.city,l.state].filter(Boolean).join(', '), l, endpoint, observedAt)).filter(l=>l.raw||l.city);
    rows.push({id:String(job.id||''),title:job.name,url:job.url,department:job.department?.name||'',workplace,location:places.join('; '),rawLocation:places.join('; '),secondaryLocations:[],locations,locationStatus:places.length?'published':'unknown',sourceUrl:endpoint,observedAt,sourceStatus:'current',locationSource:'ats',publishedAt:'',pay:null,payRanges:[]});
   }
   if(page+1>=(result.data.totalPages||page+1)) break;
  }
  if(total!=null&&rows.length<total){status=rows.length?'partial':'failed'; reason=`Feed listed ${total} postings and returned ${rows.length} unique URLs`;}
  return {status,rows,endpoint,reason,pages,total};
 }
 const {kind,slug}=source;let endpoint='',total=null,rows=[],pages=0,status='complete',reason='';
 let invalid=0;
 const process=items=>items.filter(j=>j&&(kind!=='ashby'||j.isListed!==false)).map(j=>mapATSJob(kind,j,endpoint,observedAt,source)).filter(row=>{
  const valid=typeof row.title==='string'&&row.title.trim()&&/^https?:\/\//.test(row.url||'')&&!/undefined$/.test(row.url);if(!valid)invalid++;return valid;
 });
 if(kind==='greenhouse'||kind==='ashby'||kind==='workable'){
  endpoint=kind==='greenhouse'?`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`:kind==='ashby'?`https://api.ashbyhq.com/posting-api/job-board/${slug}?includeCompensation=true`:`https://apply.workable.com/api/v1/widget/accounts/${slug}`;
  const result=await request(endpoint);if(!result.ok||!Array.isArray(result.data?.jobs))return {status:'failed',rows:[],endpoint,reason:result.error||'Unexpected response',pages:1};
  rows=process(result.data.jobs);pages=1;total=result.data.meta?.total??result.data.total??null;
  if(kind==='workable'&&total===null){status='partial';reason='Widget feed has no verifiable total or pagination contract';}
  if(total!==null&&rows.length<total){status='partial';reason='Feed returned fewer jobs than its advertised total';}
 }else{
  const seen=new Set();let ended=false;
  for(let page=0;page<maxPages;page++){
   let options={},items,result,offset=kind==='workday'?page*20:page*100;
   if(kind==='workday'){const [tenant,wd,site]=slug.split('|');endpoint=`https://${tenant}.${wd}.myworkdayjobs.com/wday/cxs/${tenant}/${site}/jobs`;options={method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({appliedFacets:{},limit:20,offset,searchText:''})};}
   else endpoint=kind==='lever'?`https://api.lever.co/v0/postings/${slug}?mode=json&skip=${offset}&limit=100`:`https://api.smartrecruiters.com/v1/companies/${slug}/postings?limit=100&offset=${offset}`;
   result=await request(endpoint,options);pages++;
   items=kind==='workday'?result.data?.jobPostings:kind==='lever'?result.data:result.data?.content;
   if(!result.ok||!Array.isArray(items)){status=rows.length?'partial':'failed';reason=result.error||'Unexpected page response';break;}
   const reported=result.data?.total??result.data?.totalFound;
   // Workday later pages can contain total:0 even when the first page reports thousands.
   if(Number.isFinite(reported) && (reported>0 || (total===null && !items.length))) total=reported;
   if(!items.length){ended=true;break;}
   let added=0;for(const row of process(items)){if(!row.url||seen.has(row.url))continue;seen.add(row.url);rows.push(row);added++;}
   if(!added){status='partial';reason='Source repeated a page; pagination could not be verified';break;}
   if(total!==null&&rows.length>=total){ended=true;break;}
  }
  if(!ended&&status==='complete'){status='partial';reason=`Bounded pagination stopped after ${maxPages} pages`;}
 }
 if(status==='complete'&&(invalid||total!==null&&rows.length<total)){status='partial';reason=invalid?`${invalid} malformed advertised records excluded; listing completeness cannot be verified`:'Feed ended before its advertised total; listing completeness cannot be verified';}
 return {rows,status,reason,total,pages,endpoint,observedAt};
}
export async function enrichRole(role,source,{request=requestPublic,observedAt=new Date().toISOString()}={}) {
 const url=role.detailApi||(source.kind==='greenhouse'?`https://boards-api.greenhouse.io/v1/boards/${source.slug}/jobs/${role.id}?pay_transparency=true`:role.url);
 const result=await request(url);if(!result.ok)return {...role,detailAttempt:{url,observedAt,status:'failed',reason:result.error}};
 let next={...role},job;
 if(source.kind==='workday'&&result.data?.jobPostingInfo){const info=result.data.jobPostingInfo;const originals=[info.location||info.jobRequisitionLocation?.descriptor,...(info.additionalLocations||[])];const values=originals.map(label).filter(Boolean);if(values.length){next.location=values[0];next.secondaryLocations=values.slice(1);next.locations=originals.map((value,index)=>locationRecord(label(value),value?.address || (index===0?{addressLocality:info.city,addressRegion:info.state,addressCountry:info.country||info.jobRequisitionLocation?.country}:{}),url,observedAt,'role-detail')).filter(record=>record.raw||record.city||record.country);next.rawDetailLocations=originals;next.locationSource='role-detail';}next.workplace=label(info.remoteType)||next.workplace;}
 if(source.kind==='greenhouse'&&result.data?.id){const mapped=mapATSJob('greenhouse',result.data,url,observedAt,source);next={...next,...mapped,sourceUrl:role.sourceUrl,observedAt:role.observedAt};}
 const jobs=structuredJob(result.text||'');job=jobs.find(j=>String(j.identifier?.value||j.identifier||'')===role.id)||jobs.find(j=>cleanTitle(j.title)===cleanTitle(role.title));
 if(job){const places=asArray(job.jobLocation).map(place=>locationRecord(place.name,place.address,url,observedAt,'job-posting')).filter(l=>l.raw||l.city||l.state||l.country);if(places.length){next.locations=[...(next.locations||[]).filter(l=>l.raw||l.city||l.country),...places];if(isLocationUnknown(role)){next.location=places.map(l=>l.raw||[l.city,l.state,l.country].filter(Boolean).join(', ')).join(' / ');next.locationSource='job-posting';}}next.applicantLocationRequirements=asArray(job.applicantLocationRequirements);if(job.jobLocationType==='TELECOMMUTE')next.workplace='Remote';if(!next.payConflict)next.pay=next.pay||payFromStructured(job);}
 if(source.kind==='workday'&&source.slug==='dyson|wd3|dyson_careers'&&result.data?.jobPostingInfo?.jobReqId===role.id)next.payRanges=dysonPay(result.data.jobPostingInfo.jobDescription,url,next.location);
 if(source.kind==='workday'&&source.slug==='snapchat|wd1|snap'&&result.data?.jobPostingInfo?.jobReqId===role.id)next.payRanges=snapPay(result.data.jobPostingInfo.jobDescription,url);
 next.locationStatus=isLocationUnknown(next)?'unknown':'published';next.detailAttempt={url,observedAt,status:'observed'};return next;
}
function cleanTitle(value){return String(value||'').trim().toLowerCase();}
export function retainBoard(previous,result,observedAt){
 if(result.status==='failed')return previous?{...previous,refreshFailed:true,lastAttempt:observedAt,coverage:{status:'failed',reason:result.reason,listingStatus:'failed',lastAttempt:observedAt,retained:true}}:{roles:[],fetched:null,lastAttempt:observedAt,refreshFailed:true,coverage:{status:'failed',listingStatus:'failed',reason:result.reason,lastAttempt:observedAt}};
 // Partial responses retain earlier records that the incomplete response cannot invalidate.
 const current=new Map(result.rows.map(role=>[role.url,role]));
 const superseded=new Set(result.rows.flatMap(role=>role.alternateUrls||[]));
 // An explicit current exclusion (e.g. a general-interest form) is positive
 // evidence; it must not reappear merely because another part of a feed failed.
 const excluded=new Set((result.excluded||[]).map(row=>row.url).filter(url=>typeof url==='string'));
 // Group coverage may be partial even when a specific public account is exhausted.
 // Absence from that complete account invalidates its old listing, not unrelated channels.
 const completedBoards=new Set((result.completedPublicBoards||[]).filter(s=>typeof s==='string'&&/^[a-z0-9-]+$/.test(s)));
 const exhausted=url=>{try{const u=new URL(url);return u.protocol==='https:'&&['job-boards.greenhouse.io','boards.greenhouse.io'].includes(u.hostname)&&/^\/[^/]+\/jobs\/\d+\/?$/.test(u.pathname)&&completedBoards.has(u.pathname.split('/')[1]);}catch{return false;}};
 if(result.status==='partial')for(const role of previous?.roles||[])if(!current.has(role.url)&&!superseded.has(role.url)&&!excluded.has(role.url)&&!exhausted(role.url))current.set(role.url,{...role,sourceStatus:'retained-previous'});
 const pageReceipts=result.pageReceipts?.map(p=>({url:p.url,...(p.page!=null?{page:p.page}:{}),...(p.start!=null?{start:p.start,end:p.end}:{}),...(p.offset!=null?{offset:p.offset,appliedFacets:p.appliedFacets,status:p.status}:{}),total:p.total,rows:p.rows,...(p.excluded!=null?{excluded:p.excluded}:{}),...(p.invalid!=null?{invalid:p.invalid}:{})}));
  const previousByUrl=new Map((previous?.roles||[]).map(role=>[role.url,role]));
  return {source:result.source,sourceUrl:result.endpoint,fetched:observedAt,roles:[...current.values()].map(role=>({...role,firstSeen:previousByUrl.get(role.url)?.firstSeen||previousByUrl.get(role.url)?.observedAt||role.observedAt||observedAt})),coverage:{status:result.status,listingStatus:result.status,reason:result.reason,total:result.total,pages:result.pages,observedAt,...(pageReceipts?{pageReceipts}:{}),...(result.partitionReceipt?{partitionReceipt:result.partitionReceipt}:{}),retained:result.status==='partial'&&!!previous}};
}
