# Deploy CommitCred to AWS App Runner

AWS closed App Runner to new customers on April 30, 2026. An existing eligible customer can still create services. Check eligibility before authorizing spend. If the account is ineligible, the source deployment described here is blocked. AWS recommends ECS Express Mode, which introduces an Application Load Balancer and needs a separately approved architecture and cost review for this project. [AWS availability notice](https://docs.aws.amazon.com/apprunner/latest/dg/apprunner-availability-change.html)

## Local dry run

Use Node.js 22 and run `npm ci --include=dev`, `npm run build`, then `npm start`. In another terminal run `npm run smoke:production`. App Runner uses the same build and start commands from [apprunner.yaml](../apprunner.yaml). It runs a normal Next.js Node server on `0.0.0.0:8080`. HTTP `GET /api/health` returns `200 {"status":"ok"}` without upstream calls.

The revised Node 22 build copies the application directory to the run image. Build output and installed dependencies stay under that directory. CommitCred uses `next start` so it can serve `.next/static` and run API routes directly. No global runtime install or `pre-run` step is needed. The local check exercises the same commands. The managed container copy and AWS health probes still need cloud verification. [AWS managed Node runtimes and build](https://docs.aws.amazon.com/apprunner/latest/dg/service-source-code-nodejs.html)

## Create the service

1. Sign in with an authorized IAM Identity Center or assumed role, select an eligible App Runner region, and verify the intended CLI identity with `aws sts get-caller-identity` if using the CLI. Use the account’s approved billing contact and complete AWS billing verification as needed. Approve usage and configure the budget before creating resources.
2. In **App Runner → GitHub connections**, create a connection. In GitHub, authorize the AWS Connector for GitHub installation with access limited to `VHarshB/CommitCred`. Wait for the connection to be available.
3. In **App Runner → Services → Create service**, select **Source code repository → GitHub** and the connection. Choose `VHarshB/CommitCred`, branch `main`, repository root, and **Manual** deployments. The verified release must be pushed to the selected branch. Under configuration select **Use a configuration file**.
4. Name the service `commitcred`. Start with 1 vCPU and 2 GB RAM. Use an autoscaling configuration with minimum 1, maximum 2, and maximum concurrency 10 as a starting point, then review saturation and spend before increasing. Keep ingress public and default public egress so GitHub is reachable. Under **Health check**, set protocol HTTP, path `/api/health`, interval 10 seconds, timeout 5 seconds, healthy threshold 1, and unhealthy threshold 5. Port 8080 comes from the file.
5. Review the actual region’s charges, then create the service. Wait for **Running** and copy the assigned HTTPS URL from **Service overview**. Test the endpoint and generate a Basic Report using a public repo with current activity.

### CLI alternative to the service creation screen

After the owner creates and authorizes the GitHub connection, run the following with a Bash-compatible shell. Export `AWS_REGION`, `CONNECTION_ARN`, and `AUTOSCALE_ARN` using values from the selected account and region. The latter is the ARN of the autoscaling configuration described above.

```sh
aws apprunner create-service --region "$AWS_REGION" --service-name commitcred \
  --source-configuration "CodeRepository={RepositoryUrl=https://github.com/VHarshB/CommitCred,SourceCodeVersion={Type=BRANCH,Value=main},CodeConfiguration={ConfigurationSource=REPOSITORY}},AuthenticationConfiguration={ConnectionArn=$CONNECTION_ARN},AutoDeploymentsEnabled=false" \
  --instance-configuration Cpu=1024,Memory=2048 \
  --auto-scaling-configuration-arn "$AUTOSCALE_ARN" \
  --health-check-configuration Protocol=HTTP,Path=/api/health,Interval=10,Timeout=5,HealthyThreshold=1,UnhealthyThreshold=5
```

Use the returned `ServiceArn` as `SERVICE_ARN` for `aws apprunner describe-service --region "$AWS_REGION" --service-arn "$SERVICE_ARN"` and `aws apprunner start-deployment --region "$AWS_REGION" --service-arn "$SERVICE_ARN"`. Review operation status in the console or with `list-operations`. [AWS source configuration](https://docs.aws.amazon.com/apprunner/latest/dg/service-source-code.html)

## Configure the public origin and any optional credential

With repository configuration, add the actual HTTPS origin under `run.env` in `apprunner.yaml` using an entry with `name: SITE_URL` and `value` set to the copied origin. This public value goes in the deployment branch. Push the configuration and manually deploy that revision. The app reads it at request time. There is no build-time public URL and there is no fallback canonical hostname.

Basic Report needs no token. If needed, put a least-privilege GitHub token into AWS Secrets Manager or SSM SecureString. Reference its ARN as `GITHUB_TOKEN` in `run.secrets` and assign an App Runner runtime instance role limited to that secret or parameter. Add KMS decrypt narrowly if a customer-managed key requires it. Keep credentials out of Git, including build-time variables and console output. After rotation, redeploy so App Runner loads the updated value. [AWS environment and secret configuration](https://docs.aws.amazon.com/apprunner/latest/dg/env-variable-manage.html)

After configuring the origin, set `COMMITCRED_EXPECTED_ORIGIN` to it, then run `npm run smoke:production -- "$COMMITCRED_EXPECTED_ORIGIN"`. Check the service region, deployed Git SHA, HTTPS status, and real Basic Report flow. Use manual deployments unless the repository owner explicitly approves automatic deployment.

## Optional domain

Use a domain you already control or register one separately with approval. In **App Runner → Services → commitcred → Custom domains**, link the chosen domain. Add AWS’s DNS routing and certificate-validation records in the authoritative DNS zone. Keep certificate verification records, wait for **Active**, and verify HTTPS before updating `SITE_URL` and deploying again. Start with one public hostname. If the default AWS hostname remains reachable after the switch, keep canonicals and the sitemap pointed at the custom hostname and publish only that hostname. Use a permanent redirect at an edge you control if you later need to retire traffic from an old custom hostname. Preview services must omit `SITE_URL`. [AWS custom domain setup](https://docs.aws.amazon.com/apprunner/latest/dg/manage-custom-domains.html)

## Cost controls, monitoring, and rollback

- App Runner has baseline provisioned capacity charges even at low traffic. Region, active compute, data transfer, CloudWatch log retention/ingestion, optional DNS, and optional AWS WAF change cost. Estimate with the actual service settings. [App Runner pricing](https://aws.amazon.com/apprunner/pricing/) [AWS Pricing Calculator](https://calculator.aws/)
- In **Billing and Cost Management → Budgets → Create budget**, create a low monthly cost budget and configure actual and forecast email alerts at owner-approved thresholds. Alerts can lag and are not spending caps. Check AWS Cost Explorer after launch. [AWS Budgets](https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-managing-costs.html)
- In **Service → Logs**, check deployment and application streams. In **Metrics** and CloudWatch, review HTTP errors, request latency, concurrency, CPU and memory. Set log retention and owner-approved alarms. Consider a regional WAF rate-based rule scoped to the two GitHub/report API paths after reviewing costs and testing count mode. [CloudWatch logs](https://docs.aws.amazon.com/apprunner/latest/dg/monitor-cwl.html) [App Runner WAF support](https://docs.aws.amazon.com/apprunner/latest/dg/waf-manage.html)
- Record the last healthy Git SHA and environment settings. On application regression, revert the release commit in the source branch, restore the last healthy runtime configuration if it changed, and manually deploy. Alternatively, point the service at a rollback branch cut from the recorded healthy SHA. Wait for **Running**, rerun both smoke tests, then update the release record. Avoid rewriting shared branch history.
- To stop service charges, delete the App Runner service and confirm it is gone. Remove unused custom domain records, connection, autoscaling configuration, WAF ACL, CloudWatch log groups/alarms, optional secrets and roles, and any dedicated DNS resources after confirming they are unused. Standalone resources can continue costing money after service deletion.
