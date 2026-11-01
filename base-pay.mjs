// Base's October 27, 2026 Ashby feed marks these published low-dollar ranges
// as annual even where the employer's own description explicitly says hourly.
// Restrict the repair to reviewed job IDs and their observed range signatures.
// A low annual number alone must never become an inferred hourly wage.
const reviewed = new Map([
  ['c417f390-5d7a-4291-a2eb-113973b32e65', [32, 39]],
  ['4aef22ce-be4a-4055-a32d-f359d53accf2', [32, 39]],
  ['1f0050af-113b-4ba7-9f5d-933822f04be2', [32, 39]],
  ['6f6623e0-4f1b-4868-83c3-11450b1b5470', [32, 39]],
  ['6ca84b01-7c0a-4d7f-b4cd-f4a9de88c5c9', [32, 39]],
  ['ecddbda1-4244-440f-8ffe-04a293ce8665', [32, 39]],
  ['b4800338-7878-44a8-91a3-125c4ea8e326', [32, 39]],
  ['2806076c-bcef-455d-ab60-1b77fc04e4aa', [32, 39]],
  ['af950052-12a9-4c66-ae8f-815fb42b76ca', [23, 28]],
  ['f80e6512-cfca-42c2-9cdc-2aca2737199c', [23, 28]],
  ['667ce127-66a5-4f9a-8f52-047ebe153d9d', [23, 25]],
  ['d753f04d-c397-440e-9119-fd14f6a0619f', [23, 25]],
  ['77bf04a1-a290-4884-abd9-d540d0209ecc', [23, 25]],
  ['bd6a724a-d9dc-4383-acac-84aa4995193b', [23, 25]],
  ['3043a49e-218e-4010-a071-55b930c04da3', [23, 25]],
  ['c318523e-aee1-4dc5-9810-3fd1899c4ac5', [23, 25]],
  ['090c9e00-e7e3-442a-b830-12ccfa684682', [23, 25]],
  ['d1368484-39b4-46b4-bbc8-8b2d26f30209', [23, 25]],
  ['b3acbffd-16b2-482d-89c5-73ffa9b4311e', [23, 25]],
]);

export const BASE_PAY_REVIEWED_IDS = Object.freeze([...reviewed.keys()]);

function isSource(job, sourceUrl) {
  try {
    const source = new URL(sourceUrl), listing = new URL(job.jobUrl);
    return source.origin === 'https://api.ashbyhq.com'
      && source.pathname.replace(/\/$/, '') === '/posting-api/job-board/base-power'
      && listing.origin === 'https://jobs.ashbyhq.com'
      && listing.pathname.replace(/\/$/, '') === `/base-power/${job.id}`;
  } catch { return false; }
}

function description(job) {
  return String(job.descriptionPlain || job.descriptionHtml || '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<\/(?:p|li|h\d|div)>/gi, '\n').replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').replace(/&#43;/g, '+');
}

function publishedRanges(job) {
  const tiers = (job.compensation?.compensationTiers || []).flatMap(tier =>
    (tier.components || []).filter(c => c.compensationType === 'Salary')
      .map(c => ({ min:c.minValue, max:c.maxValue, currency:c.currencyCode,
        rawInterval:c.interval, level:tier.title || null,
        publishedText:c.summary || tier.tierSummary || '' })));
  return tiers.length ? tiers : (job.compensation?.summaryComponents || [])
    .filter(c => c.compensationType === 'Salary')
    .map(c => ({ min:c.minValue, max:c.maxValue, currency:c.currencyCode,
      rawInterval:c.interval, level:null,
      publishedText:job.compensation.scrapeableCompensationSalarySummary || '' }));
}

/** Return a narrowly scoped pay override, or null to leave ordinary ATS pay alone. */
export function basePay(job, sourceUrl) {
  if (!job || !isSource(job, sourceUrl)) return null;
  const expected = reviewed.get(job.id);
  const salaries = (job.compensation?.summaryComponents || []).filter(c => c.compensationType === 'Salary');
  const salary = salaries[0];
  if (!expected || salaries.length !== 1 || salary.currencyCode !== 'USD'
    || salary.interval !== '1 YEAR' || salary.minValue !== expected[0]
    || salary.maxValue !== expected[1]) return null;

  const text = description(job), rawRanges = publishedRanges(job);
  // Do not overwrite an employer's explicit annual-pay statement, even at a
  // surprising amount, or a changed tier which needs a fresh review.
  if (/\b(?:pay|salary|compensation|rate)\s*:[^\n]{0,90}(?:annually|per year|a year|\/year|\/yr)\b/i.test(text)
    || rawRanges.some(r => r.currency !== 'USD' || r.rawInterval !== '1 YEAR'
      || !Number.isFinite(r.min) || !Number.isFinite(r.max) || r.min < expected[0]
      || r.max > expected[1] || r.min > r.max)) return null;

  const descriptionEvidence = [], explicit = [];
  const pattern = /\b(?<label>Wireman|Journeyman|Pay)\s*:\s*\$(?<min>[\d,]+(?:\.\d+)?)\s*(?:(?:\/\s*|per\s+)?(?<lowPeriod>hours?|hr)\b)?(?:\s*[-–—]\s*\$?(?<max>[\d,]+(?:\.\d+)?)\s*(?:(?:\/\s*|per\s+)?(?<highPeriod>hours?|hr)\b)?)?(?<extra>\s*\+\s*\d+(?:\.\d+)?%\s*shift differential)?/gi;
  for (const match of text.matchAll(pattern)) {
    const g = match.groups;
    const min = Number(g.min.replaceAll(',', '')), max = g.max ? Number(g.max.replaceAll(',', '')) : min;
    if (!Number.isFinite(max) || min <= 0 || max < min) continue;
    const publishedText = match[0].trim();
    descriptionEvidence.push(publishedText);
    if (!g.lowPeriod && !g.highPeriod) continue;
    explicit.push({ min, max, currency:'USD', period:'hour', type:'Base pay',
      ...(g.label.toLowerCase() !== 'pay' ? { level:g.label } : {}),
      ...(g.extra ? { additionalCompensation:g.extra.trim().replace(/^\+\s*/, '') } : {}),
      sourceUrl:job.jobUrl, publishedText });
  }

  const hourlyStatement = text.match(/\bTHIS IS AN HOURLY POSITION\b[^\n]*/i)?.[0];
  const hourlySummary = rawRanges.find(r => /\bhourly rate\b/i.test(r.publishedText))?.publishedText;
  if (hourlyStatement) descriptionEvidence.push(hourlyStatement.trim());
  let payRanges;
  if (explicit.length) {
    payRanges = explicit;
    // Partial level evidence must not silently erase a second published band.
    for (const raw of rawRanges) {
      if (raw.level && explicit.some(r => r.level)
        && !explicit.some(r => r.level?.toLowerCase() === raw.level.toLowerCase())) {
        payRanges.push({ ...raw, period:null, type:'Published pay', sourceUrl });
      }
    }
  } else {
    payRanges = rawRanges.map(raw => ({ ...raw,
      period:hourlyStatement || hourlySummary ? 'hour' : null,
      type:'Published pay', sourceUrl }));
  }
  const verifiedHourly = payRanges.every(r => r.period === 'hour');
  const titleLevels = ['Wireman','Journeyman'].filter(level =>
    new RegExp(`\\b${level}\\b`, 'i').test(job.title || ''));
  const namedLevel = titleLevels.length === 1
    ? payRanges.find(r => r.level?.toLowerCase() === titleLevels[0].toLowerCase() && r.period === 'hour')
    : null;
  const one = payRanges.length === 1 && verifiedHourly ? payRanges[0] : namedLevel;
  const pay = one ? { min:one.min, max:one.max, currency:one.currency, period:one.period } : null;
  const additional = [...new Set(payRanges.map(r => r.additionalCompensation).filter(Boolean))];
  const amountConflict = explicit.length === 1 && !explicit[0].level
    && (explicit[0].min !== salary.minValue || explicit[0].max !== salary.maxValue);
  const notes = [];
  if (additional.length) notes.push(`Plus ${additional.join('; ')}.`);
  if (amountConflict) notes.push(`Description states USD ${explicit[0].min}${explicit[0].max === explicit[0].min ? '' : '–'+explicit[0].max}/hour; the employer also publishes a conflicting USD ${salary.minValue}–${salary.maxValue} range. Confirm the rate.`);
  else if (!verifiedHourly) notes.push('Employer pay period is unconfirmed; the structured annual interval is unreliable for this reviewed posting.');
  if (!verifiedHourly && descriptionEvidence.length) notes.push(`Description also states: ${descriptionEvidence.join('; ')}.`);
  return { pay, payRanges, payNote:notes.join(' '), payEvidence:{
    sourceUrl, jobUrl:job.jobUrl, reviewedOn:'2026-10-27', sourceConflict:true,
    status:verifiedHourly ? 'description-supported-hourly' : 'period-unconfirmed',
    rawRanges, rawSummary:{ ...salary }, descriptionEvidence,
    ...(hourlySummary ? { hourlySummary } : {}),
    ...(amountConflict ? { amountConflict:true } : {}),
  } };
}
