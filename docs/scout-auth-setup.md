# Scout: Google sign-in setup

The local preview has a Clerk client integration, but no Clerk application/key is configured. Real OAuth has not been tested. Encrypted profile storage and the private API are implemented and tested with fictional accounts. They remain disabled until Clerk is configured; real Google OAuth is not yet tested. The user requested setup instructions rather than provisioning an account in this turn.

## Try Google sign-in locally

1. Open [Clerk Dashboard](https://dashboard.clerk.com/) and create an application named **SenraJobs**. Use its development instance for this preview.
2. Add Google under **SSO connections → Add connection → For all users**. Clerk supplies shared Google credentials for development; a custom Google OAuth client is not needed for this first test. [Official Google setup](https://clerk.com/docs/guides/configure/auth-strategies/social-connections/google).
3. Under API keys, copy the **publishable** key (`pk_test_…`). Set `CLERK_PUBLISHABLE_KEY` in the environment of the preview server process. Also set `CLERK_ISSUER` to the exact HTTPS Frontend API origin from that same Clerk instance (for example, `https://your-app.clerk.accounts.dev`). The issuer pins the server’s token verification and public-key source. Only this public key is exposed by `/auth-config.json`. Do not put a Clerk secret key or Google client secret in browser code, this document, the agent guide, or a prompt.
4. Restart only this preview's verified `scripts/scout-preview-server.mjs` Node process with that environment, then open `http://127.0.0.1:4187/` in a normal Helium window and select **Sign in**. Google can block embedded in-app browsers. Test sign-up, sign-out and returning sign-in. The client loads Clerk only when Account/Sign in is opened. [JavaScript SDK setup](https://clerk.com/docs/js-frontend/getting-started/quickstart).

The existing server PID is in `.cache/vision-preview-2026-10-18/server.pid`. Check its executable and command line before stopping it; do not stop unrelated Python or Node processes. The Node server reads process environment first and fills missing configuration from the existing ignored `.env.worker.local` JSON file through assistant/config.mjs. Do not put credentials into public preview files. It uses the existing SENRA_DATABASE_URL plus a new dedicated SENRA_PROFILE_KEY; the private key has already been generated locally without displaying it. Restarting without it returns to the honest unconfigured state.

Example environment assignment in the PowerShell session that starts the server:

```powershell
$env:CLERK_PUBLISHABLE_KEY = 'pk_test_REPLACE_WITH_YOUR_PUBLIC_KEY'
$env:CLERK_ISSUER = 'https://YOUR_APP.clerk.accounts.dev'
# Start from the SenraJobs repository after stopping only its verified preview server:
node scripts/scout-preview-server.mjs
```

This is the only browser credential needed for the prototype. Use the application-specific Frontend API domain embedded in that key. The integration currently supports Clerk development domains and the standard `clerk.<your-domain>` production domain. No candidate brief is sent to Clerk.

## Before production accounts

Create the Clerk production instance and complete its domain/DNS configuration. Enable Google with custom credentials. In Google Cloud, create a Web application OAuth client, set the deployed SenraJobs origin, and use the exact authorized redirect URI shown by Clerk. Store the Google client secret in Clerk's dashboard. Complete the Google consent/publishing setup required for the intended audience. Use the production public key in the browser and server-only keys only in the backend. Follow the official setup above rather than guessing redirect URLs.

The private API is now implemented at `/api/profile`: GET, conditional PUT and conditional DELETE. It verifies RS256 Clerk session tokens using JOSE against the configured issuer’s JWKS, checks expiry/not-before, authorized origin and session identity, and rejects pending sessions. Ownership is a hash of verified issuer + subject; the browser cannot choose another owner. Data lives in a separate `senra_scout_profiles` table, encrypted with AES-GCM and owner-bound authenticated data. Version checks reject stale writes. Deletion removes encrypted content and keeps only revision metadata to prevent stale saves from resurrecting it.

The browser restores an account’s report, structured profile, shortlist URLs and browsing filters. Submitting a report while signed in saves it; it is not silently attached on initial login. If an anonymous draft conflicts with stored context, the user can restore the saved version or explicitly submit the draft. Sign-out clears the page context and transient assistant content. Saved reports remain until deleted; no background retention limit is currently implemented. The matching queue retains content for at most 24 hours. The API and browser do not log profile text or put it in analytics, query strings or auth metadata.

The new API is currently served only by the local preview server. Before production, include it and its dependencies in the explicit public deployment bundle, configure the same production issuer and database/encryption variables server-side, and complete a real Google sign-in/save/reload/sign-out/delete acceptance test. Test tokens and fictional database fixtures have already verified ownership, encryption, expiry/origin/signature rejection, concurrent-save conflicts and deletion. Real OAuth and a production rollout are still pending.

OAuth identifies the user. It does not read ChatGPT or Claude history. Scout's provider-neutral starter prompts and manual confirmed-brief handoff remain independent of sign-in.
