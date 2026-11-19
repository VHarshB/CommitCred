import { FilePenLine, GitCommitHorizontal, Github, Sparkles } from "lucide-react";
import { GeneratorForm } from "../components/home/generator-form";
import { smartEnabled } from "../lib/ai/budget";

export const dynamic = "force-dynamic";

export default function Home() {
  return <main id="main" className="home">
    <section className="hero narrow">
      <span className="hero-badge"><Sparkles size={14}/> Built for developers who ship</span>
      <h1 className="desktop-title">You wrote the code.<br/><em>Get the credit.</em></h1>
      <h1 className="mobile-title">Your code.<br/><em>Your credit.</em></h1>
      <p>Turn your GitHub contributions into a clear, evidence-backed sprint report in seconds.</p>
    </section>
    <div className="narrow"><GeneratorForm smartAvailable={smartEnabled()}/></div>
    <section className="site-width how" id="how-it-works">
      <h2>How it works</h2>
      <div className="steps">
        <div><Github/><h3>Connect a repository</h3><p>Paste a public GitHub URL and choose your username.</p></div>
        <div><GitCommitHorizontal/><h3>Gather the evidence</h3><p>Pick a date range to summarize commits on the default branch.</p></div>
        <div><FilePenLine/><h3>Make it yours</h3><p>Review the source links, edit your recap, and export it.</p></div>
      </div>
    </section>
  </main>;
}
