import type { Report } from "./types";

const key = "commitcred.report.v1";
let currentReport: Report | null = null;

export function saveReport(report: Report) {
  currentReport = report;
  try { sessionStorage.setItem(key, JSON.stringify(report)); } catch { /* In-memory fallback for this tab. */ }
}

export function readReport(): Report | null {
  if (currentReport) return currentReport;
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) as Report : null;
  } catch {
    return null;
  }
}

export function clearReport() {
  currentReport = null;
  try { sessionStorage.removeItem(key); } catch { /* Storage may be unavailable. */ }
}
