import { pageMetadata } from "../../lib/seo/site";

export const dynamic = "force-dynamic";

export function generateMetadata() {
  return pageMetadata("/privacy", "Privacy", "How CommitCred handles public GitHub activity, network requests, and editable reports.");
}

export default function PrivacyPage() {
  return <main id="main" className="narrow prose-page">
    <h1>Privacy</h1>
    <h2>Repository activity</h2>
    <p>CommitCred uses the public repository URL, contributor username, and dates you supply to fetch repository metadata and attributed commits from GitHub. The repository lookup passes your public repository URL in the request URL. GitHub may serve contributor avatars directly to your browser. Public repository metadata may be cached briefly.</p>
    <h2>Report modes and hosting</h2>
    <p>Public Basic Report uses no AI provider. An explicitly enabled local development mode can send selected public titles, SHAs, file paths, and line counts to OpenAI. Public Smart Report is disabled.</p>
    <p>The application includes no analytics scripts and does not intentionally log report contents. Hosting and upstream services may retain operational records such as request paths, timestamps, and status codes.</p>
    <h2>Editing and exports</h2>
    <p>The app holds your report and edits in your browser tab’s session storage so a refresh can restore them. Copying writes to your clipboard. Downloads are saved by your browser. CommitCred does not keep a server-side archive of your generated reports or edits.</p>
  </main>;
}
