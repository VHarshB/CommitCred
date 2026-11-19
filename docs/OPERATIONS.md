# CommitCred operations

Use Netlify’s deploy log to find the deployed Git revision and OpenNext build results. Check the server function logs when dynamic pages or API calls fail. Keep GitHub tokens, report contents, and request bodies out of logs and incident transcripts.

| Symptom | Diagnosis and recovery |
| --- | --- |
| Build fails | Confirm Node.js 22, repository root, lockfile, `npm run build`, `.next`, and the automatically detected Next.js adapter. |
| APIs show 404 | Check the deploy log for the OpenNext function and routing configuration. Confirm the project was imported from Git and did not get deployed as a static folder. |
| Site or function returns 5xx | Verify `/api/health`, inspect the deploy and function logs, and compare with the last known good revision. Roll back from **Deploys** if needed. |
| CSS or share image missing | Run the production smoke script against the public deployment. Check its built CSS, icon, and `/opengraph-image` responses. |
| GitHub 403 or 429 | Verify the repository is public. For a quota error, wait before retrying and check whether an optional server-side token is needed. |
| Report is empty | Check the linked GitHub author, inclusive UTC date range, and default branch. A username can be entered manually. |
| Canonicals absent or wrong | Confirm the build was a production deploy. Check its primary HTTPS hostname and any `SITE_URL` override. Preview builds intentionally emit noindex and an empty sitemap. |
| Smart Report unavailable | Expected in production. Basic Report uses GitHub only. |
| Site paused | Check shared team credits in **Usage & billing**. A Free project resumes when usage resets in the next billing cycle. |
