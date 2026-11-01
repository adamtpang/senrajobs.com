# Workday coverage repair — October 26, 2026

## Final status (supersedes running notes below)

All collection and screening processes described below finished. NVIDIA has 2,727 current distinct listings and 2,705 collected descriptions; 363 older unconfirmed rows remain explicitly retained. United Rentals reconciliation confirmed 89 of 439 checked rows active, with 350 unresolved permission responses retained. Neither source is claimed complete.

Uber's new official careers source added 722 advertised employee roles, 721 descriptions and 361 explicit annual base-pay ranges. A frontend count discrepancy and one placeholder description keep overall coverage partial. Current compiled inventory is 31,039 unique URLs across 48 guests, with 13,613 private descriptions. The private candidate snapshot matches canonical membership; 4,913 preliminary comparisons and 33 detailed comparisons remain current. No applications or messages were sent.

Build, board integrity and compact client-data checks passed. The strict snapshot validation receipt at 2026-10-26T20:12:40.845Z reports no added, removed or changed roles. Public-only artifact pointer now identifies `.cache/public-deploy-dVV6vj`. This expanded catalog is a local preview, not a production deployment. Production retains the verified Nik Storonsky guest update. The broader aggregation goal remains incomplete.

The latest guest was rechecked against the official feed and production: Nik Storonsky is already live. The broader aggregation goal remains active.

## Completed

- Added `workday-feed.mjs`, used by the public ATS collector. It detects apparent capped searches, collects published facets, checks the deduplicated union against corroborating facet counts, records each request's offset and facet selection, and keeps repeated, malformed, changing or incomplete sources partial.
- TKO: 66 current advertised listings collected in four pages; 66 descriptions collected; no unresolved locations. This replaces the older 82-row partial inventory.
- United Rentals initial pass: 1,264 valid listings from 1,266 advertised records. Two records contain only requisition IDs. 1,180 descriptions succeeded; 84 were rate limited. Existing unconfirmed rows remain explicitly retained. A slower detail reconciliation is running.
- NVIDIA: the unfiltered search exposes a 2,000 cap. The collection observed 2,736 jobs across 15 published categories and retrieved 2,727 distinct valid listings. Three malformed rows and six repeated records leave a real gap. This is partial, not a complete-global-board claim. Listing receipt is `.cache/workday-refresh-2026-10-26/nvidia-listing.json`. Description/location collection is running.
- Private Dell options and a short introduction draft saved at `.cache/dell-action-2026-10-26/REVIEW.md`. Base remains first. No hiring probability, guaranteed commission or non-student internship eligibility claimed.

## Validation

Workday fixtures cover ordinary pagination, zero results, capped facet enumeration, corroboration, retained receipts, changing totals, malformed/repeated pages, failures and page bounds. Workday, existing geography, employer feeds, company connections and client projection checks pass. Board-level partition receipts are not duplicated into every role. Coverage exports now distinguish the routine 75-detail default from focused collections that attempt every detail.

## Running work — do not restart without checking handles

- Screening session 69851: 1,000 selected roles from the frozen October 19 private snapshot, with full collected requirements; 600 processed at last observed progress, zero failures then. Local subscription inference; no applications sent.
- Slow NVIDIA collection session 17092: resumes validated saved pages; two workers, delay and bounded 429 backoff. Last observed 400 of 2,727 details. Original fast collector session 61261 was intentionally stopped and returned terminal exit 1 after United Rentals rate limits; restarting the slow collector was deliberate, not inferred from a timeout.
- United Rentals reconciliation session 61662: 439 retained/rate-limited details; only official 404/410 or a matching `canApply:false` can exclude a role. Permission-denied 403 responses remain unresolved. Last observed 350 checked.
- Validation session 19224 completed successfully.

After the collection and screen processes finish: inspect receipts and unresolved records; reconcile the canonical role/content snapshot while preserving the candidate profile and existing assessments; regenerate current assessment and application indexes; build and audit coverage; run relevant checks and prepare a new public-only release. Current collection changes are not deployed. Do not claim the new catalog or private screening is finished. Do not submit applications or send messages.
