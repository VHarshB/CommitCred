# CommitCred

CommitCred turns public GitHub commits into editable, source-linked sprint reports. Basic Report is free and requires no sign-in or credentials. Open the worked example to try the editor without GitHub.

## Run locally

Use Node.js 22 and the committed lockfile.

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:3000. Load a public repository, choose or enter a username, and pick an inclusive UTC date range. The report includes activity that GitHub attributes to that account on the default branch. Branches, reviews, unlinked identities, and some collaborative work may need separate evidence. Copy Markdown or download Markdown or TXT. Edits stay in the current browser tab.

For the same production process that App Runner uses:

```sh
npm run build
npm start
```

From another terminal run `npm run smoke:production`. The server listens on `0.0.0.0:8080` and the health endpoint is `/api/health`. Set `COMMITCRED_EXPECTED_ORIGIN` in the smoke terminal only when the app is running with the matching `SITE_URL`.

## Configuration

Copy [`.env.example`](.env.example) to `.env.local` for local settings. AWS runtime configuration is documented separately.

| Variable | Purpose |
| --- | --- |
| `SITE_URL` | Actual public HTTPS origin. Set at runtime in production. Blank or invalid values suppress canonicals and leave pages noindex. |
| `GOOGLE_SITE_VERIFICATION` | Optional public verification tag value from Search Console. |
| `GITHUB_TOKEN` | Optional server-side token for higher GitHub request limits. Scope it to public access. |
| `AI_LOCAL_ENABLED` | Optional local development flag. Keep development on loopback. |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | Optional local OpenAI settings. Use a model supporting Chat Completions structured outputs. |

Public Smart Report stays disabled. The local mode can send selected public commit evidence to OpenAI. The app stores no report history on the server.

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

Use the [AWS deployment runbook](docs/AWS_DEPLOYMENT.md) and [owner checklist](docs/OWNER_FINAL_STEPS.md). App Runner source deployment requires an eligible AWS account. Ordinary CI requires no AWS credentials.
