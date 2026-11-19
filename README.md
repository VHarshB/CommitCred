# CommitCred

Turn public GitHub contributions into an editable, source-linked sprint recap.

## Local development

Requires Node.js 22 or newer.

```sh
npm install
npm run dev
```

Open http://localhost:3000. Paste a public repository URL, load contributors, choose a username and a UTC date range, then generate. The example works without external services. Reports live in the current browser tab and can be copied or downloaded as Markdown or plain text.

```sh
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

The browser suite mocks API responses by default. Set `COMMITCRED_LIVE_TEST=1` to include the live GitHub acceptance tests at desktop and mobile widths. Set `PLAYWRIGHT_CHANNEL=chrome` to use an installed Google Chrome browser.

## Project structure

- `src/app` contains pages and server route handlers.
- `src/components` contains the repository form, report editor, and shared layout.
- `src/lib` contains validation, GitHub and OpenAI clients, quota enforcement, report generation, and exports.
- `tests/unit` covers validation, attribution, generation, quotas, and exports. `tests/e2e` exercises the browser flow.

## Configuration

Copy `.env.example` to `.env.local` for optional settings. Basic Report requires no credentials. `GITHUB_TOKEN` raises GitHub's request limits. Use a credential with minimal permissions and access to public content only.

Smart Report requires `OPENAI_API_KEY` and `OPENAI_MODEL`. Choose a model supporting Chat Completions structured outputs, such as `gpt-4.1-mini` if available on your account. Set `AI_LOCAL_ENABLED=true` for local development.

On Vercel, set `AI_PUBLIC_ENABLED=true`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, and `AI_CLIENT_HASH_SECRET` (at least 32 random characters) along with the OpenAI settings. Redis atomically reserves a share of the UTC daily budget before calling OpenAI. Configure `AI_DAILY_BUDGET` and `AI_CLIENT_DAILY_LIMIT` to size the daily request allowance. Public Smart Report fails closed when durable quota checks or Vercel client identity are unavailable. Use separate Redis stores for environments that need independent budgets.

## Deploy to Vercel

1. Commit the verified files and push to the CommitCred GitHub repository.
2. Import the repository as a Vercel project. Use the Next.js preset and Node.js 22 or newer.
3. Add any optional server-side environment variables in Project Settings.
4. Deploy. Open the deployment and generate a Basic Report against a public repository. If Smart Report is enabled, verify generation and quotas with your configured services.

## Coverage

The report covers GitHub-attributed commits on the repository's default branch. Related branches, unlinked identities, co-authorship, reviews, and other work may be missed. UTC dates are inclusive. GitHub's date filtering, bounded pagination, and available commit details can limit coverage. Merge commits appear as integration activity, and merge diffs are excluded from authorship summaries. Review all generated statements and source links before sharing. Smart Report sends a limited set of public evidence to OpenAI.
