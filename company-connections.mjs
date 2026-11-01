// Explicit indirect connections keep interview subjects distinct from interview guests.
export function applyCompanyConnections(guests, records) {
  const seen=new Set();
  for(const record of records){
    const {guest:name,company:nameOfCompany,type,subject,source,companySource,checkedOn}=record;
    const guest=guests.find(g=>g.name===name);
    const company=guest?.companies.find(c=>c.name.split(' (')[0]===nameOfCompany);
    if(!company)throw Error(`Connection has no matching guest/company: ${name} / ${nameOfCompany}`);
    if(type!=='episode-subject'||typeof subject!=='string'||!subject.trim())throw Error('Invalid episode-subject connection');
    if(![source,companySource].every(url=>typeof url==='string'&&url.startsWith('https://')))throw Error('Connection requires HTTPS evidence sources');
    if(source!==guest.episode.url)throw Error('Episode connection must cite this guest’s episode');
    const key=JSON.stringify([name,nameOfCompany]);if(seen.has(key))throw Error(`Duplicate connection: ${key}`);seen.add(key);
    company.connection={type,subject,source,companySource,checkedOn,label:`Episode topic: ${subject}`};
  }
  return guests;
}
