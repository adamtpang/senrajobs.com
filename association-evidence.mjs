// Explicit human-reviewed relationship evidence, separate from ATS completeness.
export function associationEvidence(guests, records = []) {
  const key = (guest, company) => JSON.stringify([guest, company]);
  const registry = new Set(guests.flatMap(g => g.companies.map(c => key(g.name, c.name))));
  const reviewed = new Map();
  for (const record of records) {
    const id = key(record.guest, record.company);
    if (!registry.has(id)) throw Error(`Association evidence has no exact registry match: ${id}`);
    if (reviewed.has(id)) throw Error(`Duplicate association evidence: ${id}`);
    if (!['co-founder', 'co-founder-former-leader', 'founder', 'executive', 'creator', 'venture-builder', 'brand-successor', 'episode-subject'].includes(record.relationship)) throw Error(`Unknown relationship: ${id}`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(record.reviewedOn || '') || !Number.isFinite(Date.parse(record.reviewedOn))) throw Error(`Missing reviewed date: ${id}`);
    if (typeof record.claim !== 'string' || record.claim.trim().length < 20) throw Error(`Missing reviewed claim: ${id}`);
    if (!Array.isArray(record.sources) || !record.sources.length || record.sources.some(s => {
      try { const u = new URL(s.url); return u.protocol !== 'https:' || !!u.username || !!u.password || !s.supports?.trim(); } catch { return true; }
    })) throw Error(`Invalid association sources: ${id}`);
    reviewed.set(id, {...record, status:'reviewed'});
  }
  return {
    get: (guest, company) => reviewed.get(key(guest, company)) || {status:'pending', reason:'Existing research has not yet been reconciled into the explicit relationship-evidence ledger.'},
    summary: {registryRows:registry.size, reviewed:reviewed.size, pending:registry.size-reviewed.size,
      allRecordedAssociationsHaveReviewedEvidence:registry.size > 0 && reviewed.size === registry.size,
      exhaustiveEmployerCensusVerified:false,
      meaning:'Reviewed means a cited relationship claim was checked. It does not prove every associated company was discovered, current guest leadership, or complete hiring-channel coverage.'}
  };
}
