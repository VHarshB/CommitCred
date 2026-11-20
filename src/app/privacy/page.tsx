import Link from "next/link";
import { pageMetadata } from "../../lib/seo/site";

export const dynamic = "force-dynamic";

export function generateMetadata() {
  return pageMetadata("/privacy", "Privacy", "How CommitCred handles public GitHub activity, accounts, and editable reports.");
}

export default function PrivacyPage() {
  return <main id="main" className="narrow prose-page resource-page">
    <h1>Privacy</h1>
    <h2>Repository activity</h2>
    <p>CommitCred uses the public repository URL, contributor username, and dates you supply to fetch repository metadata and attributed commits from GitHub. GitHub may serve contributor avatars directly to your browser. Public repository metadata may be cached briefly.</p>

    <h2>Basic Report and Smart Report</h2>
    <p>Basic Report uses GitHub and works without an account or AI. When Smart Report is enabled for eligible US adults, it sends full commit identifiers, selected technical keywords, coarse file categories, and line counts from public commits to Google Gemini. Google may use free-tier inputs and outputs to improve its products, including human review. Use Basic Report for sensitive, confidential, or personal information. <a href="https://ai.google.dev/gemini-api/terms" rel="noreferrer">Gemini API terms</a></p>

    <h2>Accounts, abuse prevention, and credits</h2>
    <p>Starting a guest Smart Report can create an anonymous Supabase account, protected by Cloudflare Turnstile. Supabase keeps session cookies on this site. Choosing Google sign-in shares basic identity information, including your email and profile, with Supabase. CommitCred does not display that information publicly.</p>
    <p>We check the region using Netlify request metadata and keep short-lived keyed network hashes to monitor signup abuse. The credit ledger holds account identifiers, consent, credit counts, attempt times, and general failure categories. A hashed Google identifier records the lifetime bonus to prevent duplicate credits after account recreation.</p>

    <h2>Editing, retention, and account removal</h2>
    <p>Report edits stay in this browser tab’s session storage. Copying writes to your clipboard. Downloads are saved by your browser. CommitCred does not keep a server-side archive of full reports or edits. A successful Smart request can keep an encrypted receipt of its generated statements and supporting commit identifiers for retry. Recovery expires after 15 minutes, and expired receipts are removed during later ledger activity.</p>
    <p>CommitCred includes no analytics tracking scripts. Hosting and upstream services may retain operational records. To ask about account deletion, use the <a href="https://github.com/VHarshB/CommitCred" rel="noreferrer">CommitCred repository</a> to request a private contact channel before sharing personal information. A minimal record of a previously granted Google bonus may be retained where permitted.</p>
    <Link href="/" className="button secondary">Back to CommitCred</Link>
  </main>;
}
