import Link from "next/link";
import { FilePenLine, GitCommitHorizontal, Github, Sparkles } from "lucide-react";
import { GeneratorForm } from "../components/home/generator-form";
import { aiSettings } from "../lib/ai/availability";
import { homeStructuredData, pageMetadata, serializeJsonLd, siteDescription, siteOrigin, siteTitle } from "../lib/seo/site";

export const dynamic = "force-dynamic";

export function generateMetadata() {
  return pageMetadata("/", siteTitle, siteDescription);
}

export default function Home() {
  const origin = siteOrigin();
  return <main id="main" className="home">
    {origin && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(homeStructuredData(origin)) }}/>}
    <section className="hero narrow">
      <span className="hero-badge"><Sparkles size={14}/> Built for developers who ship</span>
      <h1><span className="desktop-title">You wrote the code.<br/><em>Get the credit.</em></span>
        <span className="mobile-title">Your code.<br/><em>Your credit.</em></span></h1>
      <p>Turn your GitHub contributions into a clear, evidence-backed sprint report in seconds.</p>
    </section>
    <div className="narrow" id="report-generator"><GeneratorForm smartConfigured={Boolean(aiSettings())}/></div>
    <section className="site-width how" id="how-it-works">
      <h2>How it works</h2>
      <div className="steps">
        <div><Github/><h3>Connect a repository</h3><p>Paste a public GitHub URL and choose your username.</p></div>
        <div><GitCommitHorizontal/><h3>Gather the evidence</h3><p>Pick a date range to summarize commits on the default branch.</p></div>
        <div><FilePenLine/><h3>Make it yours</h3><p>Review the source links, edit your recap, and export it.</p></div>
      </div>
      <ul className="resource-links" aria-label="Examples and guides">
        <li><Link href="/examples/sprint-report">Sprint report example</Link></li>
        <li><Link href="/guides/github-contribution-report">GitHub contribution guide</Link></li>
        <li><Link href="/guides/how-to-write-a-sprint-report">Writing a sprint report</Link></li>
      </ul>
    </section>
  </main>;
}
