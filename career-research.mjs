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
<html lang="en" data-theme="senra"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Employees first · Senra Jobs research</title><meta name="description" content="Source-linked research on employment before founding among David Senra's interview guests.">
<link rel="canonical" href="https://senrajobs.com/research.html">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Anton&amp;family=Inter:ital,wght@0,400;0,500;0,600&amp;family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&amp;family=Source+Sans+3:ital,wght@0,400;0,500;0,600&amp;display=swap">
<link rel="stylesheet" href="/assets/theme.css">
<script>try{var t=localStorage.getItem("senrajobs-theme");if(t==="senra"||t==="founders")document.documentElement.setAttribute("data-theme",t);}catch(e){}</script>
<style>
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:var(--body-size)/var(--body-leading) var(--font-sans);-webkit-font-smoothing:antialiased}main{max-width:min(840px,var(--site-width));margin:auto;padding:var(--page-pad-y) var(--page-pad-x) 64px}a{color:inherit;text-underline-offset:4px}:focus-visible{outline:2px solid var(--focus);outline-offset:3px}h1{font-family:var(--font-display);font-weight:var(--display-weight);font-size:var(--display-size);line-height:var(--display-leading);letter-spacing:var(--display-tracking);text-transform:var(--display-transform);font-style:var(--display-style);margin:12px 0 24px;overflow-wrap:anywhere}h2{font-family:var(--font-sans);font-size:1.5rem;font-weight:500;margin:32px 0 16px}p{margin:0 0 16px}.lead{font-size:1.35rem}.note{color:var(--muted);font-size:15px}.record{border-top:1px solid var(--line);padding:12px 0}.record>summary{cursor:pointer;padding:8px 0;min-height:44px;font-weight:500}.record>summary span{display:block;color:var(--muted);font-size:14px;font-weight:400;margin:4px 0 0 18px}.record p{font-size:16px;margin:16px 0}.sources{display:flex;flex-wrap:wrap;gap:12px}.sources a{overflow-wrap:anywhere}footer{border-top:1px solid var(--line);margin-top:32px;padding-top:20px;color:var(--muted);font-size:13px}@media(max-width:650px){main{padding:28px 16px}}
</style></head><body><main>
<nav class="site-nav" aria-label="Site"><a class="wordmark" href="/">senrajobs.com</a><div class="site-nav-links"><a href="/">Jobs</a><a href="/founders">Episodes</a></div><div class="mode-switch" role="group" aria-label="Look and feel"><button type="button" data-set-theme="senra" aria-pressed="true">David Senra</button><button type="button" data-set-theme="founders" aria-pressed="false">Founders</button></div></nav>
<h1><span class="title-senra">Employees first.</span><span class="title-founders">Employees first.</span></h1>
<p class="lead">${confirmed} of ${founders.length} founder guests researched (${percent}%) worked for someone else before their earliest documented business.</p>
<p>${unclear} histories remain unclear. We count jobs, internships and apprenticeships; compensation is not always reported. Student status, mentorship, investing and self-employment alone do not count.</p>
<p class="note">Checked ${esc(study.checkedOn)}. ${study.records.length} unique guests from the David Senra interview show, through Ari Emanuel. Repeat interviews count once. This is not the wider Founders podcast biography catalog. That catalog is the <a href="/founders">episode index</a>. Jeremy Stern and Doug Leone are excluded from the founder denominator because no commercial founder role was established in this research.</p>
<h2>What the number means</h2>
<p>This is a confirmed minimum based on public career histories. The earliest documented business may not be someone's first-ever venture. Unclear means we could not establish the sequence, not that the guest never had a job.</p>
<p>The apprenticeship idea is why Senra Jobs exists. These histories show that employment can precede founding; they do not establish that every guest worked directly for a great founder or that employment caused their success.</p>
<p class="note">Sources include first-person interviews, official biographies and institutional records, supplemented by secondary biographies. David Baszucki and Tobi Lutke rely partly on secondary biographies. This is a manual research pass; stronger evidence can change a classification.</p>
<h2>All ${study.records.length} guests</h2>${rows}
<footer>Independent fan project. Not affiliated with <a href="https://www.davidsenra.com/">David Senra</a> or <a href="https://www.founderspodcast.com/">Founders</a>.</footer>
</main><script src="/assets/theme.js" defer></script></body></html>`;
  return {confirmed, cohort:founders.length, percent, html};
}
