# SenraJobs: find your apprenticeship

Prepared 2026-10-09. This is a proposed product and integration plan, not a claim that AI matching, paid credits or a Sage embed have shipped.

The existing About update and source-linked research page are already live on senrajobs.com. Production HTML was verified against the local checked output this turn.

## The experience

Keep the guest faces, company lists, aggregated roles, search and filters. Add one primary action: **Find my role**. Browsing remains free and does not require an account.

1. The assistant asks four to six short, adaptive questions about the user's work, demonstrated skills, location/work eligibility, pay floor, preferred work and what they want to learn. A pasted CV is optional; start with text, without voice or document parsing.
2. It shows a short, editable profile for the user to confirm. Distinguish demonstrated skills from self-reported interests and unanswered questions.
3. It returns five to ten strong candidates, with a visible fit score, specific reasons, important gaps, unknowns, published compensation when available, and an official employer application link.
4. The user can ask why a role fits, compare two roles, change constraints or practice explaining their relevant experience. Revalidate a shortlisted listing before recommending an application.
5. Sage supplies relevant, cited founder precedents: what a founder learned as an employee, how they approached a similar decision, and a practical question or next step. Its interpretation of the user's situation is separate from the source claim.

The promise is a better-supported shortlist and a clearer next move. A score is not a hiring probability, a guarantee of employment, or a promise of access to the named founder. The user applies directly to the employer.

Use one assistant panel in the existing Senra design. Sage is a contextual capability within that experience, with a small optional advice entry for fans who are not job hunting. Avoid making users operate separate chat products or navigate a new set of tabs.

## Matching all roles without thousands of model calls

Use hard constraints to exclude incompatible location, work arrangements and user requirements. Unknown pay or eligibility is explicitly unknown; do not silently assume compatibility or reject every unknown.

Precompute job features and reusable semantic indexes when job data changes. Rank the entire eligible index cheaply, then use an LLM to explain and rerank a bounded shortlist. A starting point is the best 30 candidates, with a configurable cost limit. Reuse the approved profile for later matching; a refresh does not repeat the entire interview.

Suggested explainable score, subject to evaluation:

| Component | Points | Evidence |
| --- | ---: | --- |
| Required skills and relevant work | 40 | Job requirements matched to confirmed profile evidence |
| Scope and seniority | 20 | Responsibility and experience expectations |
| User's work preferences | 20 | Explicit preferences and supported role facts |
| What the user wants to learn | 20 | Tasks and responsibilities, with uncertainty stated |

Show score confidence separately. Missing requirements reduce confidence; they do not become invented positive evidence. Do not use protected characteristics, infer sensitive traits, or infer interest/competence from a guest's fame. Rank for the job seeker, not for employer selection. Keep the underlying evidence available alongside the score.

The current public feed has 6,785 unique role URLs, but its raw role records do not contain job descriptions or skills requirements. Reliable skill scoring therefore needs bounded ingestion of actual employer descriptions and a refresh policy first. Titles alone can support a provisional search shortlist, not a precise competency-fit claim. Treat employer text as data, never instructions for the assistant.

## What Sage can supply today

Read-only inspection of the exact `C:/Users/adamp/Aether/summon.guide` checkout found:

- `src/components/SageConversation.tsx`: streaming conversation and source display, with device-local saved chats.
- `src/lib/sagePrompt.ts`: independent AI guide, grounded in retrieved episode syntheses with exact source citations.
- `src/app/api/chat/source/route.ts`: source retrieval and OpenRouter streaming; the Founders source uses Sage's prompt.
- `src/lib/sourcePolicy.ts`: bounded synthesis retrieval; raw transcripts are disallowed in this runtime.
- `scripts/sage-rag/README.md`: a separate private transcript retrieval pilot. It is not integrated into production and its generation smoke is not production-ready.

The local generated Founders corpus contains 209 syntheses. A simple title/guest-name comparison matches 38 of the 43 SenraJobs guests. Ari Emanuel, Jeremy Stern, Alexander Taubman, Ronnie Fieg and Peter Rahal do not match. This is a coverage diagnostic, not proof that every matched guest has a complete or accurate corpus. The live public catalog labels David Senra and Founders Podcast coverage as partial.

Do not describe the existing Sage as containing every transcript. The first integration should use original public-source syntheses, disclose coverage and cite sources. Full transcript retrieval needs a separate provenance, permission, retrieval and answer-quality release process. Never publish private raw corpora or David's private highlights.

## Integration ownership

SenraJobs owns the browsing UI, guest/company relationships and role freshness. Its existing design assigns candidate intake and matching to skill.supply, whose funded Anthropic runtime remains an unresolved prerequisite in the local project documentation; no provider balance was queried this turn. Summon owns source retrieval, Sage counsel and citation formatting.

Prefer a native Senra assistant UI backed by an authenticated server gateway, rather than embedding the entire dark Sage application. A plain iframe can prototype counsel, but cannot implement role matching, shared credits, profile handoff, consistent design or reliable cross-site sessions by itself.

Expose a bounded, versioned Sage service contract with source filters, latest approved user question, optional user-approved role context, citations and usage metadata. Use short-lived scoped authorization and streaming responses. Keep provider credentials on the server. Personal context is reviewed before being sent; never place a CV or profile in a URL. Profile saving is explicit and deletable.

## Credits and pilot pricing

Proposed initial offer, pending measured usage and payment configuration:

| Allowance or action | Proposed amount |
| --- | --- |
| Welcome allowance | 20 credits once, enough for an interview and first shortlist |
| Daily free allowance | 5 credits per signed-in user, resets at a disclosed UTC time, does not accumulate |
| Standard short assistant answer | 1 credit within its cost/context budget |
| Shortlist refresh with explanation | 5 credits within its bounded candidate/model budget |
| Starter pack | US$5 for 100 credits |
| Power pack | US$15 for 400 credits |

Paid balances are separate from the daily free bucket and should not expire. Browsing, filtering, opening applications and viewing existing results never consume AI credits. Show any higher-cost action's price before it runs; never silently charge a user for the number of roles searched.

The credit unit must have a server-enforced execution budget, not mean unlimited context or arbitrary model calls. Reserve credits atomically before work, record usage for every model attempt, and settle or release the reservation afterward. Refund failed user operations even if the provider incurred a cost. Payment webhooks must be verified and idempotent; the browser never grants or deducts an authoritative balance.

Sage currently does not call the credits endpoint, and its source-chat route does not consult credits or membership. The separate credit endpoint has a read-then-decrement pattern. This is not a ready-made daily-credit/payment system. Build a transactional ledger, concurrency handling and an authenticated metered Sage path before offering paid credit packs. A Senra gateway cannot enforce credits if its upstream paid service is publicly bypassable.

## Cost model

Summon's local default paid-model routing caps are US$0.25 per million input tokens and US$1.50 per million output tokens; these are configured caps, not proof of the current deployed environment or a model quality guarantee. Routes also try free models, whose availability is unsuitable as the sole basis of a paid-service budget.

At those caps, an illustrative 7,000-input/1,000-output-token call costs $0.00325 in inference, approximately $0.00343 with OpenRouter's currently published 5.5% Standard platform fee. This is a hypothetical bounded call, not measured Sage session cost. Sage's existing output ceiling can be 6,000 tokens and retries can add cost. Conversation history, reasoning, retrieval, embeddings, hosting, payment processing, taxes, support and free-user subsidy also matter.

Source for the platform fee: [OpenRouter pricing](https://openrouter.ai/pricing), checked 2026-10-09. Model catalogs and actual routed usage must be measured at implementation time.

Measure median and p95 delivered-answer and shortlist costs with representative conversations before fixing pack allowances. Aim for paid-credit revenue comfortably above fully loaded cost, with a global free-usage spend cap. Five free replies for 1,000 daily users at the illustrative call cost would already be about $17/day in inference plus platform fee, before the other costs. Free access requires a subsidy budget even when individual calls are cheap.

## Build order and release evidence

1. Improve shortlist description coverage and freshness; define profile, ranking and evidence contracts.
2. Implement a private text interview and editable profile, then an explainable shortlist. Evaluate actual relevance and false matches against human judgments. Deliver a useful result before asking the user to save a profile or pay.
3. Add source-cited Sage counsel in the same experience, initially using supported syntheses and explicit coverage gaps.
4. Add authenticated free quotas and the transactional ledger; exercise concurrent requests, aborted streams, model retries, failed operations and payment webhook replays.
5. Launch one credit-pack offer after measured costs and successful checkout-to-balance verification; expand pricing only when usage supports it.

Useful events: interview started/completed, profile corrected, shortlist viewed, result judged useful, employer link opened, repeat visit, credits exhausted and pack purchased. Keep CVs, chat content and sensitive profile fields out of analytics. The core outcome is a useful application or career decision, not a high chat-message count.

## repos.chat receipt

Exact-checkout status verified both `senrajobs.com` and `summon.guide` as assigned with valid manifests. Neither had a live watcher lease. The portfolio-wide lookup initially resolved a differently named Summon clone; rechecking with the exact Summon checkout as root resolved the intended repository. Any future route must use that verified identity, not the similarly named clone.

No manifest, kin edge, exchange, neighbor repository or external task was changed. No rep was dispatched, no prompt was sent to a hosted model, no credit purchase or payment object was created, and no AI capability was deployed. A future cross-repository implementation needs a concrete contract and a bounded authorized exchange; branding or a hypothetical integration is not sufficient evidence for a kin edge.
