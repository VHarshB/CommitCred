import Link from "next/link";

export function ResourcePage({ title, intro, children }: { title: string; intro: string; children: React.ReactNode }) {
  return <main id="main" className="narrow prose-page resource-page">
    <h1>{title}</h1>
    <p>{intro}</p>
    {children}
    <Link href="/#report-generator" className="button primary">Open the report generator</Link>
  </main>;
}
