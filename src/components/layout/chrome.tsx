import Link from "next/link";
import { Github } from "lucide-react";

const project = "https://github.com/VHarshB/CommitCred";

export function Header() {
  return <header className="site-header"><div className="site-width header-inner">
    <Link href="/" className="brand" aria-label="CommitCred home">
      <span className="brand-icon"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 12h5m8 0h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2"/></svg></span>
      commitcred<span>.</span>
    </Link>
    <nav aria-label="Main"><Link href="/#how-it-works">How it works</Link><a href={project} className="github-nav" aria-label="CommitCred on GitHub"><Github size={19}/></a></nav>
  </div></header>;
}

export function Footer() {
  return <footer className="site-footer"><div className="site-width footer-inner">
    <div><strong>CommitCred</strong><p>Your commits. Your credit.</p></div>
    <nav aria-label="Footer"><a href={project}>GitHub</a><Link href="/privacy">Privacy</Link><Link href="/#how-it-works">How it works</Link></nav>
  </div></footer>;
}
