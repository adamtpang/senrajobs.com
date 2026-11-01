// Bounded official-source collectors. Import-ready; no writes or broad parent boards.
import {normalizePay} from './job-utils.mjs';
import {atomsPlainText} from './atoms-feed.mjs';
export const NODE_URL='https://nodefoundation.com/careers';
export const CRYSTAL_URL='https://boards-api.greenhouse.io/v1/boards/crystaldynamics/jobs?content=true';
export const plain=s=>atomsPlainText(s).replace(/&mdash;/g,'—').replace(/&ndash;/g,'–').replace(/&(?:rsquo|lsquo);/g,"'").replace(/&(?:rdquo|ldquo);/g,'"').replace(/&copy;/g,'©');
const locationRecord=(raw,address,sourceUrl,observedAt,source)=>({raw,city:'',state:'',country:'',sourceUrl,observedAt,source,confidence:'published'});
const knownNode=new Set(['Staff: Guest Experience','Gallery Manager','CryptoPunks General Manager','Content Engineer','Robot Dog Walker','General Application']);
const checkedUrl=(value,origin,pattern)=>{const u=new URL(value);if(u.origin!==origin||u.username||u.password||!pattern.test(u.pathname)||u.search||u.hash)throw Error('Unexpected official role URL');return u;};
export function parseNodeLinks(html){
 const main=html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1];
 if(!main)throw Error('NODE careers structure missing');
 const links=[...new Set([...main.matchAll(/href="(\/careers\/[^"?#]+)"/g)].map(m=>new URL(m[1],NODE_URL).href))];
 if(!links.length||links.length>25)throw Error('NODE bounded listing missing or expanded; review required');
 return links;
}
export function parseNodeRole(html,url,observedAt){
 const u=checkedUrl(url,'https://nodefoundation.com',/^\/careers\/[a-z-]+$/);
 const main=html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1];
 const heading=main?.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i),title=plain(heading?.[1]);
 if(!heading||!knownNode.has(title))throw Error('Unknown NODE role; manual classification required');
 const description=plain(main.slice(heading.index)).split('NETWORK MAKES ART WORK')[0].replace(/ Apply Now.*$/s,'').trim();
 if(description.length<150)throw Error('NODE description missing');
 if(title==='General Application')return {excluded:{title,url,reason:'General expression of interest; not a specific vacancy'}};
 if(title==='Robot Dog Walker'){
   if(!/may or may not be real/i.test(description))throw Error('Promotional role wording changed; manual review required');
   return {excluded:{title,url,reason:'Employer says this position may or may not be real; promotional/uncertain'}};
 }
 const meta=plain(main.slice(0,heading.index)).split('← Back').at(-1).trim().split(' • ');
 if(meta.length!==3||!['Part-time','Full-time'].includes(meta[2]))throw Error('NODE location/type structure changed');
 const [department,publishedLocation,employmentType]=meta;
 const hybrid=publishedLocation==='Hybrid',location=hybrid?'':publishedLocation;
 const row={id:u.pathname.split('/').at(-1),title,url,employerBrand:'NODE Foundation',employerBrandSource:'official-employer-page',sourceEmployerLabel:'NODE Foundation',department,employmentType,location,secondaryLocations:[],locations:location?[locationRecord(location,{},url,observedAt,'employer-job-description')]:[],locationStatus:location?'published':'unknown',workplace:hybrid?'Hybrid':'',...(hybrid?{publishedLocationLabel:'Hybrid',workplaceEvidence:'Job header publishes Hybrid without a geographic location.'}:{}),pay:null,payRanges:[],publishedAt:'',sourceUrl:url,observedAt,detailObservedAt:observedAt,sourceStatus:'current',sourceJobIdentity:'node:'+u.pathname.split('/').at(-1),description};
 if(title==='Staff: Guest Experience'){
   if(!description.includes('$35/hour'))throw Error('NODE guest-experience pay changed; review required');
   row.payRanges=[{min:35,max:35,currency:null,displayCurrency:'$',period:'hour',type:'Hourly pay',publishedText:'$35/hour',sourceUrl:url}];
   row.payNote='Employer publishes $35/hour; currency is not explicitly named.';
 }else if(title==='Content Engineer')row.payNote=/competitive hourly rate/i.test(description)?'Competitive hourly rate; amount not published.':'';
 return {row};
}
export async function fetchNode({request,observedAt}){
 const rows=[],excluded=[],failures=[],pageReceipts=[];
 try{
   const r=await request(NODE_URL);if(!r.ok)throw Error(r.error||'NODE careers unavailable');
   const urls=parseNodeLinks(r.text);pageReceipts.push({url:NODE_URL,page:1,observedAt,advertisedEntries:urls.length});
   for(const url of urls){try{const d=await request(url);if(!d.ok||d.url!==url)throw Error(d.error||'NODE detail unavailable or redirected');const parsed=parseNodeRole(d.text,url,observedAt);if(parsed.row)rows.push(parsed.row);else excluded.push(parsed.excluded);pageReceipts.push({url,observedAt,identityMatched:true});}catch(error){failures.push({url,error:error.message});}}
   return {rows,excluded,failures,endpoint:NODE_URL,status:'partial',listingStatus:failures.length?'partial':'complete',observedAt,total:null,pages:1,pageReceipts,reason:`${urls.length} current official entries inspected; ${rows.length} substantive vacancies, ${excluded.length} explicitly excluded expressions/promotional entries and ${failures.length} failures. No independent pagination/total contract or other hiring-channel census; failed reads cannot invalidate older roles.`};
 }catch(error){return {rows,excluded,failures,endpoint:NODE_URL,status:'failed',listingStatus:'failed',observedAt,total:null,pages:0,pageReceipts,reason:error.message};}
}

export function parseCrystalRole(job,observedAt,mapJob){
 checkedUrl(job.absolute_url,'https://job-boards.greenhouse.io',new RegExp(`^/crystaldynamics/jobs/${job.id}$`));
 if(!Number.isSafeInteger(job.id)||job.company_name!=='Crystal Dynamics')throw Error('Crystal employer or ID mismatch');
 const title=plain(job.title),description=plain(job.content);
 if(title==='General Application')return {excluded:{title,url:job.absolute_url,reason:'General expression of interest; not a specific vacancy'}};
 if(!/Intern.*\[Spring 2027\]$/.test(title)||description.length<500)throw Error('New Crystal role or cohort requires review');
 const eligibility=description.match(/Eligibility Criteria:\s*(.*?)\s*What You Will Gain:/)?.[1];
 if(!eligibility||!eligibility.includes('Graduated from a college or university program in 2026')||!eligibility.includes('February 1st – April 23rd, 2027'))throw Error('Crystal graduate/cohort eligibility changed');
 const mapped=mapJob('greenhouse',job,CRYSTAL_URL,observedAt,{kind:'greenhouse',slug:'crystaldynamics'});
 const {rawOfficeAssociations,rawLocation,...role}=mapped;
 const faq=description.match(/Compensation for this internship is \$(\d+(?:\.\d+)?)[–-](\d+(?:\.\d+)?)\/hr/);
 const footer=description.match(/Internship Pay Rate \(United States\) \$(\d+(?:\.\d+)?)\s*—\s*\$(\d+(?:\.\d+)?) USD/);
 if(!faq||!footer)throw Error('Crystal published hourly pay sections changed; review required');
 const different=faq[1]!==footer[1]||faq[2]!==footer[2];
 const range=(m,label)=>({min:Number(m[1]),max:Number(m[2]),currency:'USD',period:'hour',type:'Internship pay',sourceLabel:label,sourceUrl:job.absolute_url,publishedText:m[0]});
 const payRanges=different?[range(footer,'Role-specific Internship Pay Rate section'),range(faq,'Internship FAQ section')]:[{...range(footer,'Role-specific pay section and FAQ agree'),publishedText:footer[0]+'; '+faq[0]}];
 return {row:{...role,title,employmentType:'Internship',employerBrand:'Crystal Dynamics',employerBrandSource:'ats-company-name',sourceEmployerLabel:job.company_name,description,publishedAt:job.first_published||'',applicationDeadline:job.application_deadline||'',pay:different?null:normalizePay(payRanges[0]),payRanges,payNote:different?`Conflicting published hourly pay: role-specific section USD ${footer[1]}–${footer[2]}; FAQ USD ${faq[1]}–${faq[2]}. Confirm with employer.`:'',payConflict:different,workplace:'Remote',workplaceEvidence:'Remote across eligible U.S. states; mandatory first week onsite in San Carlos, CA.',eligibilitySummary:eligibility,programStart:'2027-02-01',programEnd:'2027-04-23',requiredHoursPerWeek:40,applicantLocationRequirements:['Eligible U.S. states; exact list not published in this role'],onboardingLocation:'San Carlos, CA (first week)',detailObservedAt:observedAt,sourceJobIdentity:`greenhouse:crystaldynamics:${job.internal_job_id||job.id}`}};
}
export async function fetchCrystal({request,observedAt,mapJob}){
 const rows=[],excluded=[],failures=[],pageReceipts=[];
 try{
   const result=await request(CRYSTAL_URL);if(!result.ok||!Array.isArray(result.data?.jobs))throw Error(result.error||'Crystal board unavailable');
   const data=result.data;if(data.jobs.length>30)throw Error('Crystal bounded feed expanded; review required');
   const total=Number.isSafeInteger(data.meta?.total)?data.meta.total:null;
   const seen=new Set();
   for(const job of data.jobs){try{
     if(seen.has(job.absolute_url))throw Error('Duplicate Crystal URL');seen.add(job.absolute_url);
     const parsed=parseCrystalRole(job,observedAt,mapJob);if(parsed.excluded){excluded.push(parsed.excluded);continue;}
     const detail=await request(job.absolute_url);
     if(!detail.ok||detail.url!==job.absolute_url||plain(detail.text.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/)?.[1])!==parsed.row.title)throw Error('Crystal detail status or title mismatch');
     rows.push(parsed.row);pageReceipts.push({url:job.absolute_url,observedAt,identityMatched:true});
   }catch(error){failures.push({url:job.absolute_url,error:error.message});}}
   const complete=total!==null&&total===data.jobs.length&&rows.length+excluded.length===total&&!failures.length;
   pageReceipts.unshift({url:CRYSTAL_URL,page:1,observedAt,total,rawEntries:data.jobs.length,roles:rows.length,excluded:excluded.length});
   return {rows,excluded,failures,endpoint:CRYSTAL_URL,status:'partial',completedPublicBoards:complete?['crystaldynamics']:[],listingStatus:complete?'complete':'partial',observedAt,total,pages:1,pageReceipts,reason:`Public board advertises ${total??'unknown'} entries; ${rows.length} specific Spring 2027 internships verified, ${excluded.length} general applications excluded, ${failures.length} detail/identity failures. Graduate eligibility is cohort-specific. Coverage is limited to this official board; no other studio channels inferred. Partial failures must retain older roles.`};
 }catch(error){return {rows,excluded,failures,endpoint:CRYSTAL_URL,status:'failed',listingStatus:'failed',observedAt,total:null,pages:0,pageReceipts,reason:error.message};}
}
