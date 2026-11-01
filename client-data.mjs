// Browsing needs a small projection; full public source records remain in jobs.json.
export function clientRole(role) {
  const keys = ['title','url','company','companyAssociations','employerBrand','department','employmentType','workplace','location','secondaryLocations','applicantLocationRequirements','pay','payRanges','payNote','fetched','observedAt','sourceStatus'];
  const row = Object.fromEntries(keys.filter(key => role[key] !== undefined).map(key => [key,role[key]]));
  row.founders = role.founders.map(({name,connection}) => ({name,...(connection?{connection:{type:connection.type,subject:connection.subject,label:connection.label,source:connection.source}}:{})}));
  row.coverage = {status:role.coverage.status,...(role.coverage.listingStatus?{listingStatus:role.coverage.listingStatus}:{})};
  if (role.locations) row.locations = role.locations.map(item => typeof item === 'string' ? item : Object.fromEntries(['raw','city','state','country'].filter(key => item[key] !== undefined).map(key => [key,item[key]])));
  return row;
}
