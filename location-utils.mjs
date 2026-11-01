// Match published job locations only. Never consume titles, biographies or headquarters.
export function locationValues(role) {
  const evidence = (role.locations || []).flatMap(item => typeof item === 'string' ? [item] : [item.raw,item.city,item.state,item.country]);
  return [...new Set([role.location,...(role.secondaryLocations || []).map(item => typeof item === 'string' ? item : item.location),...evidence].filter(value => typeof value === 'string' && value.trim()))];
}
const cleanLocation = value => String(value || '').toLowerCase().replace(/\s+/g,' ').trim();
const texasCities = ['austin','round rock','new braunfels','san antonio','dallas','fort worth','houston','san marcos','georgetown','pflugerville','cedar park','leander','kyle','buda','temple','killeen','waco','plano','frisco','irving','arlington','richardson','mckinney','denton','garland','mesquite','grand prairie','carrollton','grapevine','lewisville','el paso','lubbock','amarillo','midland','odessa','corpus christi','brownsville','mcallen','beaumont','college station','bryan','tyler','longview','laredo','sugar land','katy','pearland','pasadena','the woodlands','conroe','humble','baytown'];
const usCountries = /^(?:us|usa|u\.s\.?a?\.?|united states(?: of america)?)$/i;
// Some ATS boards publish several city names in one US location field.
// Require every comma-separated value to be a known city, so an explicit
// state such as "Austin, MN" cannot be mistaken for a multi-city list.
const usCityNames = new Set([...texasCities,'san francisco','new york','new york city','seattle','boston','chicago','los angeles','palo alto','menlo park','san jose','san diego','denver','atlanta','miami','washington','washington dc']);
export function texasEvidence(role) {
  const records = role.locations?.length ? role.locations : [role.location,...(role.secondaryLocations || [])].filter(Boolean).map(raw=>({raw}));
  const matches=[];
  for (const original of records) {
    const item=typeof original==='string' ? {raw:original} : original;
    if (item.country && !usCountries.test(item.country)) continue;
    if (item.state && !/^(?:texas|tx|us-tx)$/i.test(item.state)) continue;
    const raw=cleanLocation(item.raw);
    if (/\b(?:texas|tx|us-tx)\b/.test(raw) || /^(?:texas|tx|us-tx)$/i.test(item.state || '')) { matches.push({location:item.raw || item.city || item.state,basis:'explicit-state'}); continue; }
    // This named metro spans Texas cities; do not mistake a worksite in it for an unknown state.
    if (/^dallas\s*[-–/]\s*fort worth(?:\s+(?:area|metroplex|metropolitan area))?$/.test(raw)) { matches.push({location:item.raw,basis:'named-texas-metro'}); continue; }
    const cityList=raw.split(',').map(value=>value.trim());
    if (usCountries.test(item.country||'') && !item.state && cityList.length>1 && cityList.every(city=>usCityNames.has(city)) && cityList.some(city=>texasCities.includes(city))) { matches.push({location:item.raw,basis:'published-us-city-list'}); continue; }
    const fragments=raw.split(/[;/|]/);
    const cityListMatch=texasCities.some(city=>new RegExp('(?:^|[,;/|])\\s*'+city+'(?=\\s*(?:,\\s*(?:TX|Texas|US|USA)\\b|$))','i').test(raw));
    if (cityListMatch || texasCities.some(city => fragments.some(fragment => {
      const part=fragment.trim().replace(/^usa?\s*[-:,]\s*/, '');
      if (part===city || cleanLocation(item.city)===city) {
        // A provided non-Texas state/country overrides a city-name shorthand.
        return !item.state;
      }
      if (!part.startsWith(city)) return false;
      const tail=part.slice(city.length);
      if (/^\s*,\s*[a-z]{2}\b/.test(tail) && !/^\s*,\s*(?:tx|us)\b/.test(tail)) return false;
      return /^\s*(?:,|-|\()\s*(?:united states|usa|us|texas|tx)\b/.test(tail);
    }))) matches.push({location:item.raw || item.city,basis:'city-name-shorthand'});
  }
  return matches;
}
export function isLocationUnknown(role) {
  return !locationValues(role).some(value => !/^\d+\s+locations?$/i.test(value.trim()));
}
export function isUSRemotePossibility(role) {
  const values=locationValues(role);
  if (!/remote|telecommut/i.test(`${role.workplace || ''} ${values.join(' ')}`)) return false;
  const restrictions=(role.applicantLocationRequirements || []).flatMap(item=>typeof item==='string' ? [item] : [item.name,item.addressRegion]).filter(Boolean);
  if (restrictions.length && !restrictions.some(value=>usCountries.test(value) || /\b(?:texas|tx|us-tx)\b/i.test(value))) return false;
  if (texasEvidence(role).length) return false;
  const restrictedStateNames=/\b(?:alabama|alaska|arizona|arkansas|california|colorado|connecticut|delaware|florida|georgia|hawaii|idaho|illinois|indiana|iowa|kansas|kentucky|louisiana|maine|maryland|massachusetts|michigan|minnesota|mississippi|missouri|montana|nebraska|nevada|new hampshire|new jersey|new mexico|new york|north carolina|north dakota|ohio|oklahoma|oregon|pennsylvania|rhode island|south carolina|south dakota|tennessee|utah|vermont|virginia|washington|west virginia|wisconsin|wyoming)\b/i;
  if(values.some(value=>restrictedStateNames.test(value) || /\bUS[-, ]+\s*(?:CA|NY|WA|MA|FL|GA|IL|CO|NC|OR)\b/.test(value) || /\b(?:excluding|except|not eligible in)\s+(?:texas|tx)\b/i.test(value)))return false;
  // US country metadata on a California-only remote job is not nationwide eligibility.
  if (role.locations?.length && role.locations.every(item=>item.state && !/^(?:texas|tx|us-tx)$/i.test(item.state))) return false;
  return values.some(value=>/\b(?:united states|usa|u\.s\.|us)\b/i.test(value)) && !values.some(value=>/\b(?:only|restricted to)\b.*\b(?:california|new york|canada|uk)\b/i.test(value));
}
export function matchesLocation(role,query) {
  const value=cleanLocation(query);
  if (!value) return true;
  if (value==='texas' || value==='tx') return texasEvidence(role).length>0;
  const cityTexas=value.match(/^(.+?)[,\s]+(?:texas|tx)(?:,?\s+(?:us|usa|united states))?$/);
  if(cityTexas){
    const city=cityTexas[1].replace(/,$/,'').trim();
    const records=role.locations?.length?role.locations:[role.location,...(role.secondaryLocations||[])].filter(Boolean).map(raw=>({raw:typeof raw==='string'?raw:raw.location}));
    return records.some(item=>texasEvidence({locations:[item]}).length&&locationValues({locations:[item]}).some(value=>new RegExp('(?:^|[^a-z])'+city.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?:$|[^a-z])','i').test(value)));
  }
  if (['unknown','location unknown'].includes(value)) return isLocationUnknown(role);
  if (['us remote','us-remote'].includes(value)) return isUSRemotePossibility(role);
  return cleanLocation(`${locationValues(role).join(' ')} ${role.workplace || ''}`).includes(value);
}
export function displayLocation(role) {
  const raw=[role.location,...(role.secondaryLocations || []).map(item=>typeof item==='string' ? item : item.location),...(role.locations||[]).map(item=>typeof item==='string'?item:item.raw||[item.city,item.state,item.country].filter(Boolean).join(', '))].filter(value=>value&&!/^\d+ locations?$/i.test(value));
  return isLocationUnknown(role) ? 'Location unknown' : [...new Set(raw)].join(' / ') || locationValues(role).join(', ');
}
