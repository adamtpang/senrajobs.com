# Global catalog expansion — October 26, 2026

Local, reviewable release only. Production remains the verified Nik Storonsky release `dpl_AMEpWQaRFh5iYGzCbXJBgxZXK7La`; this broader expansion was not deployed.

## Current inventory

- 48 distinct guests reconcile against 49 interviews and one trailer in the official David Senra feed. Michael Ovitz has two interview entries.
- 29,102 unique role URLs; 4,421 published Texas matches, including 1,546 Austin matches. These are collected listings, not a certification that every employer channel is covered or every vacancy will remain open.
- Coverage audit: 73 employer labels; 41 complete observed sources, 14 partial, five failed, 13 link-only. There are 836 unknown locations and 193 retained/stale roles. The complete-source label describes the observed board, not exhaustive employer/subsidiary coverage.

## Tesla

Captured every displayed position in the unfiltered official global careers list: 8,254 advertised rows, 8,254 unique URLs, all indices 0–8,253 present. The collection has 1,161 scroll observations with overlapping-position URL checks. All 1,495 Texas-subset URLs occur in the global collection; 1,024 are labeled Austin.

Fifteen cards omit a location. All fifteen official detail pages were checked and their Location fields are also blank. They remain unknown; geography was not inferred from titles. Four Japanese-language postings have valid `/-<numeric-id>` paths with an empty Latin slug; the validator now accepts that observed URL shape while retaining strict host, path and numeric-ID checks.

Twenty-nine official descriptions were collected. This is not full-description coverage for 8,254 roles. Global listing status is complete; overall source metadata remains partial because of unknown locations and incomplete enrichment. Public UI now distinguishes “Some source details unavailable” from incomplete listing collection. The collapsed disclosure states the source-specific limitation. Direct public HTTP detail retrieval still returns 403; browser observations succeeded.

Source: https://www.tesla.com/careers/search/ . Raw receipts: `.cache/tesla-2026-10-26/listing-progress.json`, `texas-list.json`, `details.json`, `integration.json`. Reproducible import: `scripts/import-tesla-browser.mjs`; parser/checks: `tesla-feed.mjs`, `scripts/check-tesla-feed.mjs`.

## Newly verified employer sources

**Groq:** The official https://groq.com/ homepage links https://jobs.gem.com/groq . Captured all 37 advertised postings and all 37 descriptions. Matching requisition ID, title and department resolves these to 23 distinct roles; all alternate URLs and location variants are retained. This supersedes the previous no-public-careers-page finding. Compensation preserves total cash including potential bonus, separate staff-level ranges and explicit hourly units. Salary intervals are not guessed where unstated. The board requires manual refresh.

**Andreessen Horowitz:** https://a16z.com/about/jobs/ embeds the employer’s own `a16z` Greenhouse board. All 14 advertised jobs and their descriptions were collected. The former crypto careers URL redirects to https://a16zfrontier.com/jobs/ ; selecting the firm tab reveals one role, requisition 8042143003, already present on the main board. Portfolio-company jobs were excluded. Source-discovery observations are under `.cache/employer-discovery-2026-10-26/`.

## Validation and artifact

Board integrity, compact-client parity, location boundaries, pay/sorting, Groq requisition deduplication and Tesla row-continuity checks pass. Dallas–Fort Worth Area is now recognized as Texas; conflicting explicit state/country metadata still overrides the metro shorthand. Fixed-price hourly amounts render once, and total-cash bonus inclusion is visible.

Native public preview verifies Jonathan Ross → Groq 23, Marc Andreessen → a16z 14, Eric Jorgenson → explicitly labeled Elon episode-subject companies → Tesla 8,254, Tesla Austin filtering at 1,024, Agentic role search, source disclosure and no desktop horizontal overflow. Screenshot: `reports/global-catalog-preview-2026-10-26.png`; expanded disclosure: `reports/tesla-complete-preview-2026-10-26.png`.

Final prepared public-only artifact: `.cache/public-deploy-sh80vD`. It excludes private cache, reports, candidate documents, local-worker source, handoffs and environment files. No deployment, application submission or personal communication occurred. Existing shared uncommitted work was preserved.

## Remaining coverage work

Guest census is reconciled; exhaustive employer/subsidiary mapping and all hiring channels are not certified. Remaining work includes the 14 partial, five failed and 13 link-only source groups, broader description enrichment and candidate review. Current audit is `.cache/coverage-current/`; public disclosure is `data/coverage.json`. This turn is progress, not completion of the persistent goal.
