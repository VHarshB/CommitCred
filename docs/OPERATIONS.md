# CommitCred operations

Use App Runner **Activity**, **Logs**, and **Metrics** first. Match the current service deployment to its verified source revision. Keep GitHub tokens, provider request bodies, session reports, and other secrets out of log messages and incident transcripts.

| Symptom | Diagnosis and recovery |
| --- | --- |
| Build fails | Check deployment logs for Node 22, repository root, and the lockfile. Reproduce with `npm ci --include=dev` and `npm run build`. |
| Health checks fail | Verify HTTP `/api/health`, 8080, and binding to `0.0.0.0`. The response is independent of GitHub and OpenAI. Check startup logs and process exit status. |
| CSS or image missing | Confirm the tested release contains the build under `.next` in the copied application directory. Run the production smoke script, then check static CSS, icon, and card responses. |
| GitHub 403 or 429 | A private/inaccessible repo can look missing. For a rate-limit response, wait before retrying, check token scope and GitHub quota, and review request volume. The app can share upstream quotas across users and instances. |
| Busy or timed out | Retry after a short wait or narrow the date range. Request fan-out and concurrent report work are bounded per instance. Compare CloudWatch saturation and GitHub errors before changing limits. Consider paid WAF protection only with approval. |
| Empty report | Check the linked GitHub author, UTC date range, and default branch. A missing contributor may be typed manually. |
| Repeated 500s | Compare the recent deployment revision, CloudWatch errors, and request timing. Reproduce with a safe public fixture and roll back if the issue starts with a release. |
| Canonicals absent or wrong | Read the deployed `run.env` and verify the origin is the actual HTTPS hostname without a path, port, query, or fragment. Run smoke with the matching expected origin. A blank preview intentionally returns noindex and an empty sitemap. |
| Smart Report unavailable | Expected on every production service. No paid public provider or quota store is provisioned. For local testing use loopback development, a permitted OpenAI key/model, and explicit opt-in. |
| GitHub quota abuse | Instance load shedding limits concurrent work, not sustained volume. Review ingress metrics and use measured WAF rate rules for distributed protection if approved. Avoid logging full query strings when configuring optional edge logging. |
