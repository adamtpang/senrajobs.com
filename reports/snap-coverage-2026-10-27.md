# Snap source reconciliation — October 27, 2026

Collected all 208 advertised Workday postings across 11 pages. The public data served with the official [careers page](https://careers.snap.com/jobs) independently contains the same 208 requisition IDs, titles and application paths. Every Workday detail returned the matching requisition/title and an active application flag. All 208 descriptions and published location lists were inspected programmatically.

This replaces the October 12 collection of 201 postings: 48 URLs added and 41 absent URLs removed from the current board. All 32 previously unresolved location records are superseded by the fresh complete collection; none of the current 208 has an unknown location. Nine current roles explicitly include Austin, Texas, often as a secondary location. Complete describes these reconciled sources at observation time, not every possible Snap hiring channel.

142 postings publish 426 US annual base salary bands. Each band retains its Zone A/B/C label; bonus and equity are not folded into base salary. The official [pay-zone page](https://careers.snap.com/us-payzones) visibly identifies Zone A as California, Washington and New York City. The inspected page did not establish Austin's zone. No Austin-specific band is inferred, and the source advises confirming the zone with a recruiter.

The existing Workday detail enrichment now extracts these scoped salary bands for Snap. Raw public receipts and the prior board are preserved locally under `.cache/snap-2026-10-27/`. No candidate data was supplied to Snap and no applications or messages were sent.
