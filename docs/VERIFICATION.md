# Release verification

The Netlify migration was tested in a clean temporary copy with Node.js 22.23.4, Next.js 16.4.6 from the lockfile, and installed Chrome.

| Check | Result |
| --- | --- |
| `npm ci --include=dev --no-audit` | Passed. |
| `npm run lint` | Passed. |
| `npm run typecheck` | Passed. |
| `npm test` | 49 passed in 7 files, including Netlify production origin selection and preview noindex policy. |
| `npm run build` | Passed. |
| `npm run test:e2e` with the local production build | 10 passed. Mocked journeys covered 375, 390, 768, and 1440 px. Live `nodejs/node` reports passed at 390 and 1440 px. |
| `netlify serve --offline --context production --port 8889` | Netlify CLI 27.20.0 and OpenNext 5.16.8 built the Next.js app and bundled the server function. The adapter was explicitly loaded only in the unlinked temporary copy. |
| `npm run test:e2e` against the Netlify emulator | 10 passed. Both live GitHub report flows, API validation, and SEO smoke passed through the OpenNext bundle. |

The browser suite checks source links, editing, clipboard, Markdown and TXT export across live and mocked paths, keyboard navigation, and touch. The production smoke script checks pages, built CSS, the icon, the 1200×630 social PNG, robots, sitemap, canonical URLs, structured data, noindex on the report, request-validation errors, and disabled production Smart Report.

No hosted deployment was performed. Netlify CLI reported `NOT_LOGGED_IN` and no linked project. The imported project’s real HTTPS origin, cloud function routing, and third-party crawler rendering need verification after the owner authorizes GitHub access and imports the site. The origin used in local tests is a test fixture.
