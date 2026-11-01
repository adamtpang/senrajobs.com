// Import rendered official pages. This is not an automatic refresh adapter.
export function enrichQuantumLightDetails(board, details) {
  const content = {}, failures = [];
  const roles = board.roles.map(role => {
    try {
      const d = details[role.url], url = new URL(role.url);
      if (url.origin !== 'https://revolutpeople.com' || !url.pathname.startsWith('/quantum-light/public/careers/position/')) throw Error('Unexpected employer URL');
      if (!d || d.title !== role.title || d.text?.split('\n')[0] !== role.title || !/^About the role$/im.test(d.text) || !Number.isFinite(Date.parse(d.observedAt))) throw Error('Detail identity or body mismatch');
      if (!d.apply?.length || d.apply.some(u => u !== role.url.replace('/position/', '/apply/'))) throw Error('Application identity mismatch');
      const lines = d.text.split('Apply for this role')[0].trim().split('\n').slice(1).map(s => s.trim()).filter(Boolean);
      const locations = []; let workplace;
      for (const line of lines) {
        if (/^(Office|Remote):$/.test(line)) { workplace = line.slice(0, -1); continue; }
        if (line === '|') continue;
        if (!workplace || /^\+\d+$/.test(line)) throw Error('Unresolved location');
        locations.push({raw:line, workplace, source:'employer-public-page', sourceUrl:role.url, observedAt:d.observedAt, confidence:'published'});
      }
      if (!locations.length) throw Error('Missing published location');
      const remote = locations.filter(l => l.workplace === 'Remote').map(l => l.raw);
      content[role.url] = {text:d.text, source:role.url, observedAt:d.observedAt, closed:false, extraction:'rendered-public-employer-detail'};
      return {...role, location:locations[0].raw, secondaryLocations:[...new Set(locations.slice(1).map(l => l.raw))], locations, workplace:locations.every(l => l.workplace === 'Remote')?'Remote':'', remoteEligibility:remote.length?`Remote locations published by employer: ${remote.join(', ')}`:'', locationStatus:'published', detailObservedAt:d.observedAt};
    } catch (e) { failures.push({url:role.url, reason:e.message}); return role; }
  });
  const collected = Object.keys(content).length;
  return {board:{...board, roles, coverage:{...board.coverage, status:failures.length?'partial':'complete', detailCollected:collected, detailFailures:failures.length, reason:`All ${roles.length} displayed listings collected; ${collected} matching official descriptions and location records read. Compensation is not inferred. Manual browser observation; no automatic refresh adapter.`, detailObservationEndedAt:Object.values(content).map(d => d.observedAt).sort().at(-1)}}, content, failures};
}
