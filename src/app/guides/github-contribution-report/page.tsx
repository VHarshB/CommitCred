import Link from "next/link";
import { ResourcePage } from "../../../components/layout/resource-page";
import { pageMetadata } from "../../../lib/seo/site";

export const dynamic = "force-dynamic";

const title = "How to build a GitHub contribution report";
const intro = "Use commit history to show what changed, which work you contributed, and where a reviewer can check the evidence.";

export function generateMetadata() {
  return pageMetadata("/guides/github-contribution-report", title, intro);
}

export default function GitHubGuide() {
  return <ResourcePage title={title} intro={intro}>
    <h2>Start with the repository, account, and dates</h2>
    <p>Choose the public repository and the GitHub account that authored the work. CommitCred checks commits reachable from the default branch, then filters on the linked GitHub account and the commit’s author date within the selected UTC range. If your account is missing from the contributor list, enter it manually.</p>
    <h2>Check attribution before sharing</h2>
    <p>A commit with an unlinked author may be absent. A squash merge can compress several people’s work into one commit, and a merge commit records integration. Work on an unmerged feature branch and activity such as code reviews, design, and planning may need separate evidence. An empty report is a reason to check the dates and account, not proof that no work happened.</p>
    <h2>Explain the change and link to it</h2>
    <p>Use a file diff to support a specific statement. If you only have the commit title “Handle invalid event dates,” say that the history records a change related to invalid dates. Verify the diff and any relevant test or CI run before claiming behavior was fixed or tests passed.</p>
    <p>See a <Link href="/examples/sprint-report">worked example with fictional commits</Link> for how to turn individual changes into a short recap.</p>
  </ResourcePage>;
}
