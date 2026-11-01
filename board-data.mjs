// Merge repeated company boards and job URLs without losing founder context.
export function compileRoles(guests, jobs) {
  const rows = new Map();
  for (const guest of guests) for (const company of guest.companies) {
    const board = jobs[company.name];
    if (company.note === 'acquired or closed' || !board) continue;
    const careers = company.careers || board.careersUrl;
    if (!careers) continue;
    // Pagination receipts belong to the board; do not repeat hundreds of URLs per role.
    const {pageReceipts,partitionReceipt,...roleCoverage}=board.coverage||{status:'partial',reason:'Legacy record; coverage not measured'};
    for (const role of board.roles) {
      if (!/^https?:\/\//.test(role.url || '') || typeof role.title!=='string' || !role.title.trim() || /undefined$/.test(role.url)) continue;
      const key = role.url;
      if (!rows.has(key)) rows.set(key, { ...role, company: company.name, careers, fetched: board.fetched, refreshFailed: !!board.refreshFailed, sourceStatus:board.refreshFailed?'stale':role.sourceStatus||'current', observedAt:role.observedAt||board.fetched, sourceUrl:role.sourceUrl||board.sourceUrl||role.url, coverage:roleCoverage, lastAttempt:board.lastAttempt||board.coverage?.lastAttempt||board.fetched, founders: [], companyAssociations:[] });
      const row = rows.get(key);
      if (!row.companyAssociations.includes(company.name)) row.companyAssociations.push(company.name);
      row.secondaryLocations = [...new Set([...(row.secondaryLocations||[]),...(role.secondaryLocations||[])])];
      row.locations = [...new Map([...(row.locations||[]),...(role.locations||[])].map(location=>[JSON.stringify(location),location])).values()];
      if (!row.founders.some(f => f.name === guest.name)) row.founders.push({ name: guest.name, episode: guest.episode, ...(company.connection?{connection:company.connection}:{}) });
    }
  }
  return [...rows.values()].sort((a, b) => a.company.localeCompare(b.company) || a.title.localeCompare(b.title));
}

export function compileCompanies(guests, roles, logos = {}) {
  const companies = new Map();
  for (const guest of guests) for (const company of guest.companies) {
    if (company.note === 'acquired or closed') continue;
    const name = company.name.split(' (')[0];
    if (!companies.has(name)) companies.set(name, { name, logo:logos[name]?.src || '', guests:[], connections:[], careers:company.careers || '', note:company.note || '', roles:[] });
    const row = companies.get(name);
    if (!row.guests.includes(guest.name)) row.guests.push(guest.name);
    if(company.connection&&!row.connections.some(c=>c.guest===guest.name))row.connections.push({guest:guest.name,...company.connection});
    if (company.careers) row.careers ||= company.careers;
  }
  for (const role of roles) {
    for(const name of new Set((role.companyAssociations||[role.company]).map(name=>name.split(' (')[0]))){
      const row=companies.get(name);
      if(row){row.roles.push(role);row.careers ||= role.careers;}
    }
  }
  return [...companies.values()].sort((a,b) => a.name.localeCompare(b.name));
}
