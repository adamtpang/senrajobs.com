import {decodeShopifyDetail} from '../employer-feeds.mjs';

const decode=value=>String(value||'').replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16))).replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n))).replace(/&(?:amp|quot|apos|lt|gt|nbsp);/g,x=>({'&amp;':'&','&quot;':'"','&apos;':"'",'&lt;':'<','&gt;':'>','&nbsp;':' '}[x]));
const normalize=value=>decode(value).replace(/\s+/g,' ').trim().toLowerCase();
const meta=(html,name)=>{
  for(const [tag]of html.matchAll(/<meta\b[^>]*>/gi)){
    const attrs=Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*(["'])([\s\S]*?)\2/g)].map(m=>[m[1].toLowerCase(),m[3]]));
    if((attrs.property||attrs.name)===name)return decode(attrs.content);
  }
  return '';
};

export function employerDetailUrl(role) {
  const url=new URL(role.url);
  if(url.origin==='https://jobs.uber.com'&&/^\/en\/jobs\/\d+\/$/.test(url.pathname)&&url.pathname.split('/').filter(Boolean).at(-1)===String(role.id)){
    return 'https://iaziqy.fa.ocs.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitionDetails?onlyData=true&finder=ById;Id='+encodeURIComponent('"'+role.id+'"')+',siteNumber=UberCareers';
  }
  if(url.origin==='https://enterpriseplatform.dell.com'&&/^\/hcmUI\/CandidateExperience\/en\/sites\/careers\/job\/[A-Z]?\d+\/?$/.test(url.pathname)&&url.pathname.replace(/\/$/,'').endsWith('/'+role.id)){
    return 'https://enterpriseplatform.dell.com/hcmRestApi/resources/latest/recruitingCEJobRequisitionDetails?onlyData=true&finder=ById;Id='+encodeURIComponent('"'+role.id+'"')+',siteNumber=CX_1001';
  }
  return null;
}

export function employerDescription(role,html,data) {
  const url=new URL(role.url);
  if(employerDetailUrl(role)){
    const detail=data?.items?.find(x=>String(x.Id)===String(role.id));
    if(!detail||normalize(detail.Title)!==normalize(role.title))throw Error('Public Oracle detail identity mismatch');
    // Oracle returns internal and external fields together. Never ingest the internal fields.
    const description=[detail.ExternalDescriptionStr,detail.ExternalResponsibilitiesStr,detail.ExternalQualificationsStr].filter(Boolean).join('\n');
    if(!description)throw Error('Public Oracle description unavailable');
    return {description,extraction:'oracle-external-description'};
  }
  if(url.origin==='https://www.shopify.com'&&url.pathname.startsWith('/careers')){
    const detail=decodeShopifyDetail(html,role.id);
    if(normalize(detail.title)!==normalize(role.title))throw Error('Public Shopify title mismatch');
    return {description:detail.description,extraction:'shopify-published-detail'};
  }
  if(url.origin==='https://www.boringcompany.com'&&url.pathname.startsWith('/job/')){
    if(normalize(meta(html,'og:title'))!==normalize(role.title))throw Error('Public Boring Company title mismatch');
    const description=meta(html,'description')||meta(html,'og:description');
    if(description.length<80)throw Error('Public Boring Company description unavailable');
    return {description,extraction:'employer-job-description-metadata'};
  }
  return null;
}
