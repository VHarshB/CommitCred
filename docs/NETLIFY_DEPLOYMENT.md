# Deploy CommitCred on Netlify Free

Use a Netlify team on the **Free** plan and the included `.netlify.app` HTTPS address. Hosting budget is $0/year. A domain is optional and outside these steps. Any later domain decision must fit the $15/year total, including renewal and fees.

## Import from GitHub

1. Sign in to Netlify with the account that will own the project. On the team’s **Usage & billing** page, confirm the team is on the **Free** plan. If the selected team is on a paid plan, stop before importing.
2. Go to **Projects → Add new project → Import an existing project → GitHub**. Approve the Netlify GitHub App with access to `VHarshB/CommitCred` and select that repository.
3. Choose the `main` production branch. Use the repository root as the base directory, leave package directory blank, and verify build command `npm run build` and publish directory `.next`. These values and Node.js 22 come from [netlify.toml](../netlify.toml).
4. Keep the automatically applied OpenNext adapter. Leave the Functions directory at its default. Start the deployment when the settings match. If Netlify offers a project name before deploying, choose it there to avoid a later rename and rebuild.
5. Once the deploy succeeds, use **Domain management → Production domains** to copy the actual HTTPS address. If Netlify shows the project as private, use its publish control to make the intended production project public.
6. In the deploy log, confirm the Next.js/OpenNext adapter built the project and packaged the server function. From a terminal, set `COMMITCRED_EXPECTED_ORIGIN` to the actual HTTPS origin, then run `npm run smoke:production -- "$COMMITCRED_EXPECTED_ORIGIN"`. On PowerShell pass `$env:COMMITCRED_EXPECTED_ORIGIN` as the URL argument. Run the live report test below before announcing the site.

Netlify’s current OpenNext adapter is applied automatically at build time. It serves App Router pages and route handlers through Netlify Functions, including `/api/health`, `/api/github/repository`, and `/api/report/generate`. The application keeps its normal Next.js build for local testing. [Netlify import guide](https://docs.netlify.com/start/quickstarts/deploy-from-repository/) · [Netlify’s Next.js adapter](https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/)

## Environment variables

**None are required for a Basic Report launch.** In a Netlify production build, CommitCred uses Netlify’s system-provided primary `URL` as the effective `SITE_URL`. It includes that public origin in the Next.js build for canonicals, structured data, the sitemap, and social metadata. Preview and branch builds omit the origin and emit noindex, even if they can see the primary URL.

| Variable | When to set it |
| --- | --- |
| `SITE_URL` | Optional production build override. Leave unset for the included address. If overriding, use the actual public HTTPS origin without a path. Verify it in **Production domains** first. Changing it or renaming the site requires a new production build. |
| `GITHUB_TOKEN` | Optional runtime secret if public API quota becomes a problem. Set it in **Project configuration → Environment variables** with server/function availability. Use minimum permissions and keep it out of Git and client code. |
| `GOOGLE_SITE_VERIFICATION` | Optional public verification tag value. Set with function availability, then deploy once when ready to verify in Search Console. |
| `AI_PUBLIC_ENABLED`, `AI_BETA_ENABLED` | Leave both false for a Basic-only launch. Optional Smart Report uses the [separate owner setup](GEMINI_AUTH_OWNER_SETUP.md). |

Configure any optional settings you already need before the first build. Use the assigned production URL rather than a deploy permalink or preview URL for live acceptance checks. [Netlify build variables](https://docs.netlify.com/build/configure-builds/environment-variables/)

## Verify a live report

Set `COMMITCRED_BASE_URL` and `COMMITCRED_EXPECTED_ORIGIN` to the actual HTTPS origin. Set `COMMITCRED_PRODUCTION_TEST=1` and `COMMITCRED_LIVE_TEST=1`. Run `npm run test:e2e -- tests/e2e/live.spec.ts tests/e2e/production.spec.ts`. This exercises the real repository and report endpoints against the deployment, verifies source links and exports, and checks the SEO endpoints, response headers, and social image. The browser suite can also target a locally served build with `COMMITCRED_BASE_URL`.

## Stay within the hard limit

- Netlify Free currently includes **300 credits per billing cycle**, shared across the team, with a hard limit and no auto-recharge. If the team exhausts its credits, its projects pause until the next billing cycle. Keep the plan Free.
- Production deploys use **15 credits each**. Deploy Previews and branch deploys have no deployment charge, though requests and compute used to test them can consume credits. Current rates are **10 credits per GB-hour** of compute, **20 per GB** of bandwidth, and **2 per 10,000 requests**.
- Use **Team → Usage & billing → Usage** to review the team balance and which projects consume credits. Check usage after the first launch and after unusually busy days. Use local CI checks, batch release changes, and use `[skip netlify]` in a commit message when a push should not trigger a Netlify deploy.
- Under **Deploys**, **Lock** stops automatic publishing while builds continue. Use it if reviewing releases before publishing. Roll back by opening a previous successful deploy and selecting **Publish deploy**. Lock the release during a rollback so a later Git push does not overwrite it.

[Netlify Free pricing and credits](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/) · [Metered usage](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/how-credits-work/) · [Deploy controls](https://docs.netlify.com/deploy/manage-deploys/manage-deploys-overview/)
