# Gemini Smart Report launch status

Public and private AI are off by default. There is no new hosted deployment, provider usage, or paid plan change in this work.

| Surface | Status | Evidence |
| --- | --- | --- |
| Gemini enhancement | Implemented and mock-tested | Strict JSON, sanitized evidence, full-SHA validation, timeout, 429, invalid outputs and Basic fallback. No real Gemini request was made. |
| Google OAuth and guest sessions | Implemented and mock-tested | Supabase SSR HttpOnly cookies, Next.js route-handler session refresh, PKCE/state, link ownership, separate returning-account sign-in, CAPTCHA enrollment, and responsive credit UI. Actual Google OAuth and Turnstile still need owner credentials. |
| PostgreSQL credit migration | Implemented and locally verified | Applied to a local PostgreSQL engine with a Supabase auth schema fixture. Tested guest balances, bonus once, Google-first, deletion/recreation, RLS/privileged RPC, parallel submissions, retries, release, stale leases and global limits. The owner's Supabase database is unchanged. |
| Existing production site | Live verified | The existing published version passed the SEO/API smoke and generated real Basic Reports from `nodejs/node` at 390px and 1440px. This confirms the current site only. |
| Owner integration | Blocked on credentials and authorization | Apply the migration, configure Free projects, set dashboard secrets, verify trusted Netlify geo, and run the private US adult beta. Live Google identity linking, CAPTCHA and Gemini accounting remain unverified. |

Main implementation directories are `src/lib/ai`, `src/lib/auth`, `src/app/api/ai`, `src/app/api/report/generate`, and `supabase/migrations`. The report form and mobile dialog are in `src/components/home`. Supabase session checks and refresh stay in route handlers, which can write cookies. A separate Next.js Proxy was omitted after both Turbopack and Webpack failed to package its Edge bundle in the Windows OpenNext CLI. The Basic path and browser report editor, export and SEO workflows stay in place.

The hosted organization is the authority on free-tier eligibility and OAuth permissions. Start with [owner setup](GEMINI_AUTH_OWNER_SETUP.md) and consult [security and storage decisions](AI_SECURITY_NOTES.md). Keep public AI off through all private verification and the subsequent audience-policy decision.

## Verification record

- Clean npm install, lint, typecheck, and production build passed. Vitest passed all 75 tests. Production dependency audit reported zero known vulnerabilities. The built client assets had no Gemini or Supabase secret markers or wallet implementation.
- The final production-browser run passed 11 tests, including Smart UI at 375, 390, and 1440px and SEO/API smoke. Both opt-in GitHub tests had already passed in the local production build and on the existing live site. A later rerun hit GitHub's anonymous quota, confirmed by a remaining quota of zero, so the two opt-in cases were skipped in the final fixture run.
- Netlify CLI 27.20.0 and OpenNext 5.16.8 packaged the final build offline. This is a local artifact verification. The new feature still requires a hosted private beta and a live check of platform geo, CAPTCHA, Supabase Auth and Gemini. No credits were consumed against those services.
