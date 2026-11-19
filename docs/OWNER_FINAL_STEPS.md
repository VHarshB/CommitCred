# Owner-only launch steps

1. Confirm the AWS account can create App Runner services, choose the region, and authorize provisioning and expected monthly spend. Sign in with an authorized role, verify billing, and configure budget alerts. App Runner accounts created without prior eligibility need a separately approved hosting path.
2. Approve the AWS Connector GitHub installation for `VHarshB/CommitCred`. Provide the authorized deployment branch and grant AWS access via sign-in or an assumed role. Follow [service setup](AWS_DEPLOYMENT.md#create-the-service) using manual deployments. The region, account, and connection ARN are account-specific.
3. Approve the assigned HTTPS origin as the public canonical. If using a custom domain, confirm ownership and add the App Runner DNS validation/routing records at the domain’s provider. An optional GitHub token goes into an account-side secret with a scoped runtime role. Keep public Smart Report disabled.
4. Verify the live origin in Google Search Console as the owner. Submit `sitemap.xml`, test the live home and guide URLs, and request indexing. Use [SEO launch steps](SEO_LAUNCH.md) for the property and verification details.
