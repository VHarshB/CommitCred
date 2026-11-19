# Release verification

Local verification ran in clean temporary copies on Node.js 22.23.4, with Next.js 16.4.6 from the lockfile and installed Chrome. The first in-place install encountered a Windows lock on a native dependency. The clean baseline install and all baseline checks passed, including 21 unit tests and 7 browser tests with live GitHub enabled.

| Final check | Exit | Observed result |
| --- | --- | --- |
| `npm ci --include=dev` | 0 | Lockfile install completed in a clean verification directory. |
| `npm run lint` | 0 | No lint errors. |
| `npm run typecheck` | 0 | No TypeScript errors. |
| `npm test` | 0 | 41 passing tests in 6 files. |
| `npm run build` | 0 | Optimized production build completed. |
| `npm run test:e2e` with production mode, Chrome, test origin, and live GitHub enabled | 0 | 10 passing tests, including real `nodejs/node` reports at 390 and 1440 px. Checked SHA links, edits, clipboard, Markdown and TXT exports across live and mocked paths, keyboard interaction, touch, and four viewport widths. |
| `npm run test:e2e -- --grep 'production HTTP surface'` with a blank origin | 0 | Production smoke passed without canonical, sitemap entries, or indexable page metadata. |
| `npm audit --omit=dev --audit-level=high` | 0 | Registry reported zero known production dependency vulnerabilities for the committed lockfile. |
| axe WCAG 2.1 A/AA scan in Chrome | 0 | Zero detected violations across home, privacy, example, both guides, and sample report at 375 and 1440 px. This was an automated check, not a full accessibility conformance audit. |

The production browser suite invoked `npm start` from the same project build used by App Runner and called `scripts/smoke-production.mjs` at `http://127.0.0.1:8080`. It verified HTTP 200 on home, privacy, example, both guides, report shell, CSS, icon, 1200×630 PNG, robots, sitemap, and health. It checked HTTP 400 for invalid URLs and malformed JSON, 413 for oversized requests, and a 503 no-store response for production Smart Report. With a synthetic test origin it parsed canonicals and JSON-LD and checked the sitemap membership. The test origin was used only in local verification and the CI job.

`aws sts get-caller-identity` exited 253 because no credentials were available. No AWS resource was created and no AWS URL was verified. Live OpenAI/Bedrock, AWS managed runtime, live SEO tools and Search Console checks were not run. GitHub Actions is configured for future pushes and pull requests.
