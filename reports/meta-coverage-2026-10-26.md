# Meta public board — October 26, 2026

Collected the official [Meta employee search](https://www.metacareers.com/jobsearch/?sort_by_new=true) using its public browser interface. Applied Newest sorting before collection. All 129 pages yielded 1,285 distinct posting URLs; the final page contained five cards, disabled Next, and still advertised 1,285 items. Some offscreen page headers were not returned; their totals remain null in receipts rather than being filled in.

All 91 cards with truncated locations were expanded on the corresponding detail pages. Inspected 199 complete descriptions: all 120 postings with Austin in the published locations, additional multi-location postings, and six postings whose cards omitted locations. Those six detail pages also omit a location; their location remains unknown. No city is inferred from a department or job title.

197 inspected descriptions publish a US compensation range. These are stored as location-specific base ranges with their published interval and source. Bonus, equity and benefits are separate from base compensation. Other postings have unknown pay until inspected; no estimates are substituted.

The employee listing count is reconciled for this observation. Overall employer coverage remains partial: the separately linked contractor channel is uncollected, 1,086 descriptions remain unread, and this browser collection has no automated refresh adapter. This does not establish that all channels are exhaustive or all postings will remain open.

Meta is included through Alexandr Wang's executive employment. He is not represented as Meta's founder.

Local receipts: `.cache/meta-2026-10-26/pages.json`, `final-page.json`, `details.json`, `receipt.json`. Import assertions require sequential page numbers, correct card counts, stable observed totals, unique URLs, matching detail titles and expanded truncated locations. No candidate information, application submission or account interaction was used.

Related geography correction: published US city lists with Austin in the middle (for example Cognition's “San Francisco, Austin, New York City”) now match Austin/Texas. The matcher requires US country metadata and known city components; explicit non-Texas states and countries remain excluded. This restores four additional Austin records. The rebuilt catalog contains 32,886 unique roles, including 1,827 Austin and 4,891 Texas postings. These counts are indexed source observations, not guarantees of current availability.
