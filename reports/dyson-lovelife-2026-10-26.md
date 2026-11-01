# Coverage expansion — October 26, 2026

Local catalog now contains 31,525 unique role URLs for 48 reconciled guests. Production remains the previously verified Nik Storonsky release; these broader changes are a prepared preview, not a deployment.

## Source evidence

- Dyson: its official detail-page Apply link identifies `dyson.wd3.myworkdayjobs.com/dyson_careers`. The main careers search was expanded through 48 browser pages to all 476 advertised requisitions. All 476 occur in the linked Workday board, which advertises 480 records over 24 pages. All 480 matching details were read and explicitly allow applications. Four Workday-only records remain included. One has no published location after detail enrichment, so overall coverage is partial while listing pagination is complete. Sixteen salary/compensation ranges were extracted; dollar symbols and omitted periods remain explicit uncertainties rather than invented ISO currencies or annual pay.
- Love.Life: the old `www.love.life/careers` path returns AccessDenied. The current `https://love.life/` footer links an official ADP Career Center. All six of six openings and matching descriptions were read. Five publish hourly pay. Two Cleaning Team Member postings are distinct part-time/full-time requisitions. Collection is manual public-browser observation, not a new automatic adapter.
- Fresh official feed audit at 20:40:45 UTC reconciles 50 feed items, 49 interviews, 48 distinct guests. Latest guest remains Nik Storonsky. Coverage is 43 complete, 15 partial, two failed and 13 link-only employer sources; 742 retained/stale roles remain disclosed. Neither all employer associations nor all hiring channels are proven complete.

Public raw receipts and import scripts are in ignored `.cache/dyson-2026-10-26/` and `.cache/lovelife-2026-10-26/`. Those directories also contain private candidate work and must never be deployed wholesale.

## Implementation and validation

Added the verified Dyson Workday override, conservative pay parser and public ADP browser-evidence importer. Workday detail enrichment now uses the published requisition-location descriptor when the primary field is empty. Employment type survives the client projection and appears in role metadata/search. Assessment fingerprints now include detailed pay ranges, preventing stale comparisons after changes to amount, currency, interval or compensation basis.

Build, 31,525-role board integrity, client-data parity, location, Workday pagination, pay/sorting, ADP evidence identity, pay-fingerprint, candidate batch-fit, association deduplication and guest-census checks pass. Native browser verified James Dyson → 480 roles, pay rendering/search, and John Mackey → six Love.Life roles with distinct full-time/part-time labels. Desktop screenshots were inspected; no new mobile-viewport test was performed this turn.

Prepared public-only release: `.cache/public-deploy-5KR8eG`. Private application drafts and profile data remain outside it. No messages or applications were submitted. The broader aggregation and application-queue goal remains active.

## Private queue reconciliation

The final private snapshot exactly matches all 31,525 canonical URLs and the unchanged candidate profile. It has 14,099 descriptions, 5,404 current valid preliminary comparisons and 39 detailed comparisons, including 15 Base reviews. These counts exclude invalid or stale assessment fingerprints; they are not a claim that every role has been evaluated. All collection, model and validation processes in this turn returned terminal exit 0. Six additional source-reviewed comparisons and a Growth Analytics answer draft are saved privately. Actual application forms show the two additional Base internships offer spring/summer 2027 terms, so the private review defers them for the immediate-income search. Adam still performs every final submission.
