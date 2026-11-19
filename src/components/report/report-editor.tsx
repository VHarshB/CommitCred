"use client";

import { Check, ChevronDown, Copy, Download, ExternalLink, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { formatReport, reportFilename } from "../../lib/export/report";
import { commitTitle } from "../../lib/report/basic";
import { clearReport, readReport, saveReport } from "../../lib/report/session";
import type { Accomplishment, Commit, Report } from "../../lib/report/types";

const subscribe = () => () => {};
const serverSnapshot = () => false;
const clientSnapshot = () => true;

function EvidenceLink({ commit, compact = false }: { commit: Commit; compact?: boolean }) {
  const sha = commit.url ? commit.sha.slice(0, 7) : `sample ${commit.sha.slice(-7)}`;
  if (!commit.url) return <code>{sha}</code>;
  return <a className={compact ? "evidence-chip" : "evidence-link"} href={commit.url} target="_blank" rel="noopener noreferrer" aria-label={`Open commit ${sha} on GitHub`}><code>{sha}</code><ExternalLink size={13}/></a>;
}

function StatementList({ items, evidence, label, onChange }: {
  items: Accomplishment[];
  evidence: Map<string, Commit>;
  label: string;
  onChange: (items: Accomplishment[]) => void;
}) {
  return <div className="statement-list">
    {!items.length && <p className="muted">No statements in this section yet.</p>}
    {items.map((item, index) => <div className="statement" key={item.id}>
      <div className="statement-input">
        <textarea aria-label={`${label} ${index + 1}`} value={item.statement}
          placeholder={`Add text for this ${label.toLowerCase()}`} rows={2} onChange={(event) => {
            onChange(items.map((entry) => entry.id === item.id ? { ...entry, statement: event.target.value, edited: true } : entry));
          }}/>
        <button className="button icon-button" aria-label={`Delete ${label.toLowerCase()} ${index + 1}`} type="button" onClick={() => onChange(items.filter((entry) => entry.id !== item.id))}><Trash2 size={17}/></button>
      </div>
      <div className="evidence-chips">
        {item.edited && <span className="source-label">{item.shas.length ? "User edited" : "User added"}</span>}
        {item.shas.map((sha) => {
          const commit = evidence.get(sha);
          return commit ? <EvidenceLink key={sha} commit={commit} compact/> : null;
        })}
      </div>
    </div>)}
    <button className="button secondary add-button" type="button" onClick={() => onChange([...items, { id: crypto.randomUUID(), statement: "", shas: [], edited: true }])}><Plus size={17}/>Add {label.toLowerCase()}</button>
  </div>;
}

function downloadReport(report: Report, format: "md" | "txt") {
  const url = URL.createObjectURL(new Blob([formatReport(report, format)], { type: "text/plain;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = reportFilename(format);
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ReportEditor() {
  const mounted = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
  if (!mounted) return <main id="main" className="site-width prose-page" aria-busy="true">Loading report…</main>;
  return <EditorContent/>;
}

function EditorContent() {
  const router = useRouter();
  const [report, setReport] = useState(readReport);
  const [feedback, setFeedback] = useState("");
  if (!report) return <main id="main" className="narrow prose-page"><h1>Your Sprint Recap</h1><p>Generate a report to start editing.</p><Link className="button primary" href="/">Create a report</Link></main>;

  const evidence = new Map(report.evidenceLinks.map((commit) => [commit.sha, commit]));
  const update = (changes: Partial<Report>) => {
    const next = { ...report, ...changes };
    setReport(next);
    saveReport(next);
    setFeedback("");
  };

  return <main id="main" className="site-width report-page">
    <div className="report-header">
      <span className="success"><Check size={16}/> Report generated</span>
      {report.sample && <span className="sample-label">SAMPLE DATA</span>}
      <h1>Your Sprint Recap</h1>
      <p className="report-meta">{report.repository.owner}/{report.repository.name} <span>·</span> @{report.contributor} <span>·</span> {report.dateRange.start} to {report.dateRange.end} (UTC)</p>
      <div className="report-actions">
        <button className="button primary" type="button" onClick={async () => {
          try { await navigator.clipboard.writeText(formatReport(report, "md")); setFeedback("Markdown copied."); }
          catch { setFeedback("Clipboard access failed. You can download the Markdown instead."); }
        }}><Copy size={17}/>Copy report</button>
        <button className="button secondary" type="button" onClick={() => downloadReport(report, "md")}><Download size={17}/>Download Markdown</button>
        <button className="button secondary" type="button" onClick={() => downloadReport(report, "txt")}><Download size={17}/>Download TXT</button>
        <button className="button secondary" type="button" onClick={() => { clearReport(); router.push("/"); }}>Start over</button>
      </div>
      <p className="feedback" aria-live="polite">{feedback}</p>
    </div>
    <dl className="stats">
      <div className="card"><dt>Commits analyzed</dt><dd>{report.commitsAnalyzed}</dd></div>
      <div className="card"><dt>Work areas identified</dt><dd>{report.workAreas.length}</dd></div>
      <div className="card"><dt>Time period</dt><dd>{(Date.parse(report.dateRange.end) - Date.parse(report.dateRange.start)) / 86_400_000 + 1} days</dd></div>
    </dl>
    <div className="report-body">
      <section className="card report-section"><div className="section-heading"><h2><label htmlFor="summary">Summary</label></h2><span className="source-label">{report.mode === "smart" ? "Smart Report" : "Basic Report"}</span></div>
        <textarea id="summary" rows={3} value={report.summary} onChange={(event) => update({ summary: event.target.value })}/>
      </section>
      <section className="card report-section"><h2>What I accomplished</h2><StatementList items={report.accomplishments} evidence={evidence} label="Accomplishment" onChange={(accomplishments) => update({ accomplishments })}/></section>
      <section className="card report-section"><h2>Technical highlights</h2><StatementList items={report.technicalHighlights} evidence={evidence} label="Highlight" onChange={(technicalHighlights) => update({ technicalHighlights })}/></section>
      <section className="card report-section"><h2><label htmlFor="blockers">Challenges &amp; blockers</label></h2><textarea id="blockers" rows={3} placeholder="Add any challenges you encountered." value={report.blockers} onChange={(event) => update({ blockers: event.target.value })}/></section>
      <section className="card report-section"><h2><label htmlFor="next-steps">Next steps</label></h2><textarea id="next-steps" rows={3} placeholder="What will you work on next?" value={report.nextSteps} onChange={(event) => update({ nextSteps: event.target.value })}/></section>
      <details className="card report-section evidence-section"><summary><span>Evidence ({report.evidenceLinks.length})</span><ChevronDown size={18}/></summary>
        <ul>{report.evidenceLinks.map((commit) => <li key={commit.sha}><EvidenceLink commit={commit}/><span>{commitTitle(commit)}</span><time dateTime={commit.date}>{commit.date.slice(0, 10)}</time></li>)}</ul>
      </details>
      <div className="notice coverage"><strong>Review your report before submitting.</strong><p>GitHub activity may not capture all your work.</p><ul>{report.coverageWarnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></div>
    </div>
  </main>;
}
