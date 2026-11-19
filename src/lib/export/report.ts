import { commitTitle } from "../report/basic";
import type { Accomplishment, Report } from "../report/types";

function escapeMarkdown(value: string) {
  return value.replace(/[^\S\r\n]+/g, " ").replace(/[\r\n]+/g, " ").replace(/[\\`*_{}\[\]()#+\-.!|<>~=&]/g, "\\$&").trim();
}

export function formatReport(report: Report, format: "md" | "txt") {
  const markdown = format === "md";
  const safe = markdown ? escapeMarkdown : (value: string) => value.replace(/[\r\n]+/g, " ").trim();
  const heading = (value: string, top = false) => markdown ? `${top ? "#" : "##"} ${value}` : value;
  const evidence = new Map(report.evidenceLinks.map((commit) => [commit.sha, commit]));
  const bullet = (item: Accomplishment) => {
    const links = item.shas.map((sha) => evidence.get(sha)).filter((commit) => commit !== undefined).map((commit) =>
      commit.url ? (markdown ? `[${commit.sha.slice(0, 7)}](${commit.url})` : commit.url) : `sample ${commit.sha.slice(-7)}`,
    );
    const label = item.edited ? (item.shas.length ? " (user edited)" : " (user added)") : "";
    return `- ${safe(item.statement)}${label}${links.length ? ` — ${links.join(", ")}` : ""}`;
  };
  const section = (title: string, items: string[]) => [heading(title), ...(items.length ? items : ["—"]), ""];
  return [
    heading("Sprint Contribution Report", true), "",
    ...(report.sample ? ["SAMPLE DATA — fictional contributions", ""] : []),
    `Repository: ${safe(`${report.repository.owner}/${report.repository.name}`)}`,
    `Contributor: ${safe(report.contributor)}`,
    `Period: ${report.dateRange.start} to ${report.dateRange.end} (UTC)`,
    `Mode: ${report.mode === "smart" ? "Smart Report" : "Basic Report"}`, "",
    ...section("Summary", [safe(report.summary)]),
    ...section("What I Accomplished", report.accomplishments.map(bullet)),
    ...section("Technical Highlights", report.technicalHighlights.map(bullet)),
    ...section("Challenges and Blockers", report.blockers.split(/\r?\n/).map(safe).filter(Boolean)),
    ...section("Next Steps", report.nextSteps.split(/\r?\n/).map(safe).filter(Boolean)),
    ...section("Supporting Evidence", report.evidenceLinks.map((commit) => `- ${commit.sha.slice(commit.url ? 0 : -7, commit.url ? 7 : undefined)} · ${safe(commitTitle(commit))} · ${commit.date.slice(0, 10)}${commit.url ? ` · ${commit.url}` : ""}`)),
    ...section("Coverage", report.coverageWarnings.map(safe)),
  ].join("\n");
}

export function reportFilename(format: "md" | "txt", now = new Date()) {
  return `commitcred-report-${now.toISOString().slice(0, 10)}.${format}`;
}
