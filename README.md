# CommitCred

CommitCred turns public GitHub commits into editable, source-linked sprint reports. Basic Report is free and requires no sign-in or credentials. Open the worked example to try the editor without GitHub.

## Run locally

Use Node.js 22 and the committed lockfile.

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:3000. Load a public repository, choose or enter a username, and pick an inclusive UTC date range. The report includes activity that GitHub attributes to that account on the default branch. Branches, reviews, unlinked identities, and some collaborative work may need separate evidence. Copy Markdown or download Markdown or TXT. Edits stay in the current browser tab.

For a local production build:

```sh
npm run build
npm start
```

From another terminal run `npm run smoke:production`. The local server listens on `0.0.0.0:8080` and the health endpoint is `/api/health`. Set `COMMITCRED_EXPECTED_ORIGIN` in the smoke terminal only when the app is running with the matching `SITE_URL`.

## Configuration

Copy [`.env.example`](.env.example) to `.env.local` for local settings. Netlify production Basic Report needs no environment variables.

| Variable | Purpose |
| --- | --- |
| `SITE_URL` | Optional public HTTPS override. Netlify production uses the assigned primary URL at build time by default. Preview builds and local builds without an origin emit noindex. |
| `GOOGLE_SITE_VERIFICATION` | Optional public verification tag value from Search Console. |
| `GITHUB_TOKEN` | Optional server-side token for higher GitHub request limits. Scope it to public access. |
| `AI_PUBLIC_ENABLED`, `AI_BETA_ENABLED` | Both off by default. See the owner setup before any AI use. |
| Supabase, Gemini, and Turnstile settings | Optional Smart Report configuration. See the owner setup for scopes, limits, and eligibility. |

Smart Report uses Gemini when enabled by the owner. Guests can earn three lifetime reports after consent and verification. Linking an unused verified Google identity adds three once. Basic stays free and account-free. Full reports and edits are not stored server-side. See [Gemini and Google setup](docs/GEMINI_AUTH_OWNER_SETUP.md) and [AI security notes](docs/AI_SECURITY_NOTES.md).

## Verify and deploy

```sh
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
npm audit --omit=dev --audit-level=high
```

Set `COMMITCRED_PRODUCTION_TEST=1` in the environment before Playwright to start the production server on port 8080. Set `COMMITCRED_LIVE_TEST=1` to include the live GitHub workflow on desktop and mobile. Set `PLAYWRIGHT_CHANNEL=chrome` to use an installed Chrome browser.

Use the [Netlify Free deployment guide](docs/NETLIFY_DEPLOYMENT.md) and [owner checklist](docs/OWNER_FINAL_STEPS.md). Host on the included HTTPS address for $0/year and monitor the team's hard credit limit. Set `COMMITCRED_BASE_URL` to run the browser suite against an existing deployment.
