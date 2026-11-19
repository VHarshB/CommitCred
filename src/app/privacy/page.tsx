import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return <main id="main" className="narrow prose-page">
    <h1>Privacy</h1>
    <h2>Repository activity</h2>
    <p>CommitCred uses your public GitHub repository URL, contributor username, and date range to retrieve repository metadata, contributor profiles, and attributed commits from GitHub. Commit messages, changed file names, and line counts may appear in your report. Public repository metadata may be cached briefly.</p>
    <h2>Report modes</h2>
    <p>Basic Report processes activity without an AI provider. If you choose Smart Report, OpenAI receives a limited set of public commit titles, SHAs, file paths, and change counts. Public Smart Report uses a keyed hash of your IP address and request counters in Upstash Redis for daily usage limits. Those counters expire after two days.</p>
    <h2>Editing and exports</h2>
    <p>Your report and edits are held in your browser tab’s session storage. Copying writes to your clipboard. Downloads are saved by your browser. CommitCred does not save your generated report or edits on its server and includes no analytics scripts.</p>
  </main>;
}
