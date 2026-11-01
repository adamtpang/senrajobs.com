# Employer expansion — October 26, 2026

Progress classification: progress. Prior turn added current coverage auditing, RXBAR successor evidence, corrected shared-brand counts and Supply Chain draft; it was not a no-progress turn. This turn integrates previously missing official boards and fresh candidate comparisons. Goal stays active, incomplete.

## Collection and validation

- Raising Cane’s: old marketing careers path was blocked; official jobs.raisingcanes.com is accessible. New canes-feed.mjs parses the public preload payload and follows emitted next-page links only. Collected2936/2936 roles over294pages, advertised total stable. Public-field allowlist, internal/private-record exclusions, strict job/pagination URL origins, duplicate/changed-total/bound checks. Scope is this official public careers search, not unseen hiring channels.
- RXO: official rxo.com/join-our-team/ links rxo.wd501.myworkdayjobs.com/rxojobs. Replaced obsolete careers.rxo.com;356/356 roles collected. Added --company exact-name refresh option so one employer can refresh without rewriting unrelated feeds or refreshing the whole guest group. Rejects unknown companies and simultaneous --guest/--company.
- UnitedMasters and Translation: official Translation homepage links an instapage careers landing page that blocks automated fetching. Public Greenhouse page explicitly brands the joint employer;20/20 openings and department hierarchy accessible. New unitedmasters-feed.mjs maps brands using the actual department tree; shared services and unknown brand cases are explicit. Consolidated the two formerly empty registry rows into one shared board, retaining per-role UnitedMasters/Translation labels. No reciprocal link from the blocked landing page is claimed. Public proof cached in employer-expansion directory.
- NaturalMotion was implemented earlier but absent from canonical jobs.json. Refreshed Torsten Reil:4/4 NaturalMotion and158/158 Helsing. Refreshed Take-Two six-label collector:35corporate,1022K,24Rockstar,4NaturalMotion,43Zynga,4GhostStory;8mirrors collapsed. Partial parent scope retains unresolved historical rows (226 indexed). Additional subsidiaries remain uncollected. Updated GUESTS research with actual refresh dates/counts.
- AppLovin: the earlier high-screen Customer Growth Associate detail API returned404; refreshed complete board has41roles and excludes it. Marked private content closed using both pieces of evidence. Do not recommend its old screening score as current availability.

Latest canonical build:20453 unique URLs,48guests,64careers links. Audit .cache/coverage-current/summary.json has feed observation2026-10-26T16:48:04.238Z:50items,49interviews,48distinct/matched guests;88association rows,73nonhistorical employer labels;37complete-source,14partial,6failed,16link-only;11historical/successor rows.2892Texas-location roles,288separate US-remote possibilities,821unknown locations,193retained/stale roles. These are indexed and observed-source counts, not a claim every role is fresh or employer mapping exhaustive.

Passed: Cane’s collector fixtures, shared-board brand hierarchy fixtures, Take-Two tests, build,20453-role board checks, geography/source/Workday/partial checks, company connections, compact-client parity/search/pay/location/sort. HTML14.74MB/1.07MBgzip. Native public IAB verified16Austin Cane’s rows and20joint-board roles with correct employer-brand sublabels. Screenshot reports/unitedmasters-translation-preview.png. Latest public-only artifact .cache/public-deploy-BzHarK prepared; NOT deployed. Production remains Nik release dpl_AMEpWQaRFh5iYGzCbXJBgxZXK7La. No commits.

## Candidate progress

New sources contain17Austin roles (16Cane’s and1RXO),646otherTexas rows. This is a location count, not a fit tier. Created .cache/employer-expansion-2026-10-26/NEW-OPTIONS.html and candidate-comparisons.json with6source-by-source assistant comparisons, explicitly separate from automated numeric reviews:

- SpaceX Applied AI, Bastrop: live current API; degree OR2years professional software,1year fullstack; on-site. Software/AI interest aligns, but production timeline, depth and commute remain unresolved. Preferred tools are not promoted to mandatory requirements. Technical stretch after Base.
- Cane’s IT Support Representative I, Plano: troubleshooting/customer-facing direction; basic PC/network/install experience required. Restaurant experience, education alternatives and POS/headset experience are preferred. PublishedOct7; salary absent. Need an actual troubleshooting example and relocation/commute plan.
- Translation Jr. Producer, Brooklyn: reported event work relevant;2–4years production, budgets/deadlines and overnighttravel remain unproven. PublishedNY/CA range65–75k, period not explicit. Creative stretch, not engineering.
- RXO FDE, Southfield: explicit quantitative bachelor’s minimum (no stated substitute),3yearsAI/ML/analytics, statistics/optimization/CPLEX/predictive-model deployment. Lower priority than Base given documented degree/experience gaps.
- RXO Austin Last Mile lead:2yearssupervision,5yearslogistics, reliable transportation and15–20personwarehouseleadership; not a strong current-evidence fit merely due location.
- RXO Plano Carrier Sales: sales evidence relevant, but1yearprocurement is minimum and not established.

Saved6fresh descriptions to global private content cache, including the SpaceX role. No invented hiring percentages/confirmedS-A claims. No forms filled, uploads, submissions or person-to-person communications. Base existing7-role application queue and draft priority remains first.

## Running process / next

Screening exec72490 confirmed live at final poll:1525/2000selected,batch63/80,481failed/unavailable. It still uses frozen17131-role/7152-description inputs; newer global cache and20453canonical roles are not yet part of that run. Do not restart on silence. Poll until authoritative terminal completion, then reconcile the snapshot and rebuild fingerprint-current indexes/queues. No other tool/collector sessions started this turn remain active. Public devserver PID2784 unchanged. One automatic approval observation timed out before a documentation patch; a safe retry succeeded, and final patch/checks completed. No unresolved approval rejection.

Next priorities: finish and reconcile current screening, enrich missing descriptions including new sources, review promising roles and prepare accurate application previews; continue remaining explicit coverage gaps. Prefer current source evidence over old summary counts. No complete-goal claim.
