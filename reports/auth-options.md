# Sign-in for saved interviews

Recommendation: Clerk with Google sign-in, keeping professional interview data encrypted in the existing Neon database. This is a proposed next step, not enabled production authentication.

Google is the identity provider; Clerk is an authentication/account service. Clerk provides a vanilla JavaScript SDK and prebuilt account components suitable for this static site. Its production Google connection requires a Google OAuth app and custom client credentials. We should load authentication UI only when requested.

Suggested flow: start the interview anonymously, offer Continue with Google when someone wants to save, then explicitly attach that current interview to their authenticated account. Future visits restore it after sign-in. Store private context by verified user ID, enforce ownership in every API read/write, and keep interview content out of auth token metadata, public output and analytics. Support account data deletion when adding accounts. Never trust a client-supplied user ID as authorization.

Options:

| Option | Fit here |
| --- | --- |
| Clerk + Google | Fastest complete account UI/session implementation for this site; retain existing Neon storage. |
| Supabase Auth + Google | Good option if consolidating auth and database onto Supabase; adds another service if keeping Neon. |
| Google Identity Services directly | Lean Google-only sign-in; application must verify tokens and build its own account sessions, recovery and profile ownership handling. |

No provider account, OAuth credentials, paid plan, login UI or cloud profile saving has been created. Choose the provider before configuring production.

Official sources checked October9,2026:
- https://clerk.com/docs/js-frontend/getting-started/quickstart
- https://clerk.com/docs/guides/configure/auth-strategies/social-connections/google
- https://supabase.com/docs/guides/auth/social-login/auth-google
- https://developers.google.com/identity/gsi/web/guides/verify-google-id-token
