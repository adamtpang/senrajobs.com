// The public research page and About figures use the same source-linked records.
export function careerResearch(study) {
  const esc = value => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const founders = study.records.filter(record => record.beforeFirst !== 'not_applicable');
  const confirmed = founders.filter(record => record.beforeFirst === 'confirmed').length;
  const unclear = founders.filter(record => record.beforeFirst === 'unclear').length;
  const percent = Math.round(100 * confirmed / founders.length);
  const labels = {confirmed:'Confirmed employment first', unclear:'Sequence unclear', not_applicable:'Founder role not established'};
  const rows = study.records.map(record => `<details class="record"><summary>${esc(record.name)}<span>${labels[record.beforeFirst]}</span></summary>
    <p><b>Earliest identifiable business:</b> ${esc(record.firstKnownBusiness || 'Not established')}</p>
    <p><b>Employment:</b> ${esc(record.employment || 'Not established')}</p>
    <p>${esc(record.evidence)}</p>
    <p class="sources">${record.sources.map((url, index) => `<a href="${esc(url)}" rel="noopener">Source ${index + 1} · ${esc(new URL(url).hostname.replace(/^www\./, ''))}</a>`).join(' ')}</p>
  </details>`).join('\n');
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Employees first · Senra Jobs research</title><meta name="description" content="Source-linked research on employment before founding among David Senra's interview guests.">
<link rel="canonical" href="https://senrajobs.com/research.html"><link rel="stylesheet" href="https://use.typekit.net/qcy7obf.css">
<style>
@font-face{font-family:"Schmalfette Grotesk";src:url("https://cdn.prod.website-files.com/68a3314e7e1c857e33d93b10/68b94590f437128b666278c3_SchmalfetteGrotesk.woff2") format("woff2");font-weight:400;font-display:swap}
*{box-sizing:border-box}body{margin:0;background:#fff;color:#000;font:18px/1.4 "tt-commons-pro",Arial,sans-serif;-webkit-font-smoothing:antialiased}main{max-width:840px;margin:auto;padding:48px 40px}a{color:inherit;text-underline-offset:4px}:focus-visible{outline:2px solid #000;outline-offset:4px}h1{font:400 clamp(68px,12vw,120px)/.9 "Schmalfette Grotesk",Impact,sans-serif;text-transform:uppercase;margin:32px 0 24px}h2{font-size:24px;font-weight:500;margin:32px 0 16px}p{margin:0 0 16px}.lead{font-size:24px}.note{color:#666;font-size:15px}.record{border-top:1px solid #e3e3e3;padding:12px 0}.record>summary{cursor:pointer;padding:8px 0;min-height:44px;font-weight:500}.record>summary span{display:block;color:#666;font-size:14px;font-weight:400;margin:4px 0 0 18px}.record p{font-size:16px;margin:16px 0}.sources{display:flex;flex-wrap:wrap;gap:12px}.sources a{overflow-wrap:anywhere}footer{border-top:1px solid #e3e3e3;margin-top:32px;padding-top:20px;color:#666;font-size:13px}@media(max-width:650px){main{padding:28px 16px}.lead{font-size:22px}}
</style></head><body><main>
<a href="/">← Senra Jobs</a><h1>Employees first.</h1>
<p class="lead">${confirmed} of ${founders.length} founder guests researched (${percent}%) worked for someone else before their earliest documented business.</p>
<p>${unclear} histories remain unclear. We count jobs, internships and apprenticeships; compensation is not always reported. Student status, mentorship, investing and self-employment alone do not count.</p>
<p class="note">Checked ${esc(study.checkedOn)}. ${study.records.length} unique guests from the David Senra interview show, through Ari Emanuel. Repeat interviews count once. This is not the wider Founders podcast biography catalog. Jeremy Stern and Doug Leone are excluded from the founder denominator because no commercial founder role was established in this research.</p>
<h2>What the number means</h2>
<p>This is a confirmed minimum based on public career histories. The earliest documented business may not be someone's first-ever venture. Unclear means we could not establish the sequence, not that the guest never had a job.</p>
<p>The apprenticeship idea is why Senra Jobs exists. These histories show that employment can precede founding; they do not establish that every guest worked directly for a great founder or that employment caused their success.</p>
<p class="note">Sources include first-person interviews, official biographies and institutional records, supplemented by secondary biographies. David Baszucki and Tobi Lutke rely partly on secondary biographies. This is a manual research pass; stronger evidence can change a classification.</p>
<h2>All ${study.records.length} guests</h2>${rows}
<footer>Free fan project. Not affiliated with <a href="https://www.davidsenra.com/">David Senra</a>.</footer>
</main></body></html>`;
  return {confirmed, cohort:founders.length, percent, html};
}
