"use client";

import { ArrowRight, ChevronDown, FlaskConical, Github, LoaderCircle, Search, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { exampleReport } from "../../lib/report/example";
import { saveReport } from "../../lib/report/session";
import type { Contributor, Report, Repository } from "../../lib/report/types";
import { rangeSchema, recentRange, repositorySchema, usernameSchema } from "../../lib/validation/input";

interface RepositoryResult {
  repository: Repository;
  contributors: Contributor[];
  partial: boolean;
}

const periods = [7, 14, 30];

export function GeneratorForm({ smartAvailable }: { smartAvailable: boolean }) {
  const router = useRouter();
  const controller = useRef<AbortController | null>(null);
  const [url, setUrl] = useState("");
  const [result, setResult] = useState<RepositoryResult | null>(null);
  const [contributor, setContributor] = useState("");
  const [menu, setMenu] = useState(false);
  const [period, setPeriod] = useState("7");
  const [customRange, setCustomRange] = useState(recentRange(7));
  const [mode, setMode] = useState<Report["mode"]>(smartAvailable ? "smart" : "basic");
  const [status, setStatus] = useState<"idle" | "loading" | "generating">("idle");
  const [error, setError] = useState("");
  const [fallback, setFallback] = useState<Report | null>(null);
  const range = period === "custom" ? customRange : recentRange(Number(period));
  const matches = result?.contributors.filter((item) => item.login.toLowerCase().includes(contributor.toLowerCase())).slice(0, 8);
  const busy = status !== "idle";

  useEffect(() => () => controller.current?.abort(), []);

  function openReport(report: Report) {
    saveReport(report);
    router.push("/report");
  }

  function begin(next: "loading" | "generating") {
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    setError("");
    setFallback(null);
    setStatus(next);
    return request;
  }

  async function loadRepository() {
    const parsed = repositorySchema.safeParse(url);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    const request = begin("loading");
    try {
      const response = await fetch(`/api/github/repository?url=${encodeURIComponent(url)}`, { signal: request.signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setResult(data);
      setContributor("");
    } catch (error) {
      if (!request.signal.aborted) setError(error instanceof TypeError ? "Could not connect. Check your connection and try again." : (error as Error).message);
    } finally {
      if (!request.signal.aborted) setStatus("idle");
    }
  }

  async function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (!result) {
      await loadRepository();
      return;
    }
    const username = usernameSchema.safeParse(contributor);
    const dates = rangeSchema.safeParse(range);
    if (!username.success || !dates.success) {
      setError(!username.success ? username.error.issues[0].message : dates.error!.issues[0].message);
      return;
    }
    const request = begin("generating");
    try {
      const response = await fetch("/api/report/generate", {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: request.signal,
        body: JSON.stringify({ repository: result.repository.url, contributor: username.data, range: dates.data, mode }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (data.fallback) setFallback(data.fallback);
        throw new Error(data.error);
      }
      openReport(data);
    } catch (error) {
      if (!request.signal.aborted) setError(error instanceof TypeError ? "Could not connect. Check your connection and try again." : (error as Error).message);
    } finally {
      if (!request.signal.aborted) setStatus("idle");
    }
  }

  return <div className="generator card">
    <form onSubmit={generate} noValidate>
      <div className="field">
        <label htmlFor="repository-url">GitHub repository</label>
        <div className="repository-row">
          <div className="input-icon"><Github size={19}/><input id="repository-url" type="url" autoComplete="off" spellCheck={false} placeholder="https://github.com/owner/repository"
            value={url} disabled={busy} onChange={(event) => { setUrl(event.target.value); setResult(null); setContributor(""); setError(""); setFallback(null); }}/></div>
          <button type="button" className="button secondary load-button" onClick={loadRepository} disabled={busy}>{status === "loading" ? <LoaderCircle className="spinner" size={17} aria-label="Loading"/> : "Load repo"}</button>
        </div>
        {result && <p className="field-help">Default branch · <strong>{result.repository.branch}</strong>{result.partial && " · Contributor list may be incomplete. You can enter a username."}</p>}
      </div>
      <div className="field-grid">
        <div className="field contributor-field" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setMenu(false); }}>
          <label htmlFor="contributor">Contributor</label>
          <div className="input-icon"><Search size={17}/><input id="contributor" autoComplete="off" spellCheck={false} placeholder={result ? "Search or type a username" : "Load a repository first"}
            value={contributor} disabled={!result || busy} onFocus={() => setMenu(true)} onChange={(event) => { setContributor(event.target.value); setMenu(true); setFallback(null); }}
            onKeyDown={(event) => { if (event.key === "Escape") setMenu(false); }} aria-describedby="contributor-help"/></div>
          <span id="contributor-help" className="sr-only">Type a GitHub username or tab to a matching contributor below.</span>
          {menu && matches && matches.length > 0 && <ul className="contributor-menu" aria-label="Matching contributors">
            {matches.map((item) => <li key={item.login}><button type="button" onClick={() => { setContributor(item.login); setMenu(false); setFallback(null); }}>
              {/* GitHub supplies small public avatars. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {item.avatar && <img src={item.avatar} width={24} height={24} alt="" referrerPolicy="no-referrer"/>}{item.login}
            </button></li>)}
          </ul>}
        </div>
        <div className="field">
          <label htmlFor="period">Time range</label>
          <div className="select-wrap"><select id="period" value={period} disabled={busy} onChange={(event) => { setPeriod(event.target.value); setFallback(null); }}>
            {periods.map((days) => <option key={days} value={days}>Last {days} days</option>)}<option value="custom">Custom dates</option>
          </select><ChevronDown size={16}/></div>
        </div>
      </div>
      {period === "custom" && <div className="field-grid">
        <div className="field"><label htmlFor="range-start">Start date</label><input id="range-start" type="date" value={customRange.start} disabled={busy} max={recentRange(1).end} onChange={(event) => { setCustomRange({ ...customRange, start: event.target.value }); setFallback(null); }}/></div>
        <div className="field"><label htmlFor="range-end">End date</label><input id="range-end" type="date" value={customRange.end} disabled={busy} max={recentRange(1).end} onChange={(event) => { setCustomRange({ ...customRange, end: event.target.value }); setFallback(null); }}/></div>
      </div>}
      <p className="range-caption">{range.start && range.end ? `${range.start} to ${range.end} · UTC, inclusive` : "Select both dates · UTC, inclusive"}</p>
      <fieldset className="mode-field" disabled={busy}>
        <legend>Report mode</legend>
        <div className="mode-options">
          <label><input type="radio" name="mode" checked={mode === "basic"} onChange={() => { setMode("basic"); setFallback(null); }}/><span>Basic Report <small>No AI</small></span></label>
          <label><input type="radio" name="mode" checked={mode === "smart"} onChange={() => setMode("smart")} disabled={!smartAvailable}/><span><Sparkles size={15}/> Smart Report <small>{smartAvailable ? "AI enhanced" : "Unavailable"}</small></span></label>
        </div>
        <p className="field-help">{mode === "smart" ? "Smart Report sends selected public commit evidence to OpenAI." : !smartAvailable ? "Basic Report works without AI." : ""}</p>
      </fieldset>
      {error && <div className="notice error" role="alert">{error}{fallback && <button type="button" className="button secondary" onClick={() => openReport(fallback)}>Use Basic Report</button>}</div>}
      <button type="submit" className="button primary generate" disabled={!result || busy}>
        {status === "generating" ? <LoaderCircle className="spinner" size={18}/> : null}Generate my report<ArrowRight size={18}/>
      </button>
      <p className="form-caption" aria-live="polite">{status === "loading" ? "Loading repository and contributors…" : status === "generating" ? "Reading GitHub activity and preparing your report…" : "No sign-up · Public repositories · Editable results"}</p>
    </form>
    <div className="example-row"><button type="button" className="text-button" disabled={busy} onClick={() => openReport(exampleReport())}><FlaskConical size={16}/>Try an example</button></div>
  </div>;
}
