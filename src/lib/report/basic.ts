import type { Activity, Commit, Report, Repository } from "./types";
import type { DateRange } from "../validation/input";

export function commitTitle(commit: Commit) {
  return commit.message.split(/\r?\n/, 1)[0].trim() || "Untitled commit";
}

export function buildReport(repository: Repository, contributor: string, dateRange: DateRange, activity: Activity): Report {
  const areas = new Map<string, Commit[]>();
  const titles = new Map<string, string[]>();
  const merges: string[] = [];

  for (const commit of activity.commits) {
    if (commit.merge) {
      merges.push(commit.sha);
      continue;
    }
    const directories = new Set(commit.files.map((file) => file.includes("/") ? file.split("/")[0] : "repository root"));
    for (const directory of directories) {
      const group = areas.get(directory) ?? [];
      group.push(commit);
      areas.set(directory, group);
    }
    if (!directories.size) {
      const title = commitTitle(commit);
      titles.set(title, [...(titles.get(title) ?? []), commit.sha]);
    }
  }

  const workAreas = [...areas.keys()].sort();
  const accomplishments = workAreas.map((area, index) => {
    const commits = areas.get(area)!;
    const files = new Set(commits.flatMap((commit) => commit.files.filter((file) =>
      file.includes("/") ? file.split("/")[0] === area : area === "repository root",
    )));
    return {
      id: `area-${index}`,
      statement: `Changed ${files.size} ${files.size === 1 ? "file" : "files"} in ${area} across ${commits.length} ${commits.length === 1 ? "commit" : "commits"}.`,
      shas: commits.map((commit) => commit.sha),
    };
  });
  for (const [title, shas] of titles) {
    accomplishments.push({ id: `message-${accomplishments.length}`, statement: `Recorded commit activity titled “${title}”.`, shas });
  }

  const measured = activity.commits.filter((commit) => !commit.merge && commit.additions !== null && commit.deletions !== null);
  const technicalHighlights: Report["technicalHighlights"] = [];
  if (measured.length) {
    const additions = measured.reduce((total, commit) => total + (commit.additions ?? 0), 0);
    const deletions = measured.reduce((total, commit) => total + (commit.deletions ?? 0), 0);
    technicalHighlights.push({
      id: "stats",
      statement: `GitHub recorded ${additions} lines added and ${deletions} deleted across ${measured.length} commits with available statistics.`,
      shas: measured.map((commit) => commit.sha),
    });
  }
  if (merges.length) {
    technicalHighlights.push({ id: "merges", statement: `Recorded ${merges.length} merge ${merges.length === 1 ? "commit" : "commits"} as integration activity.`, shas: merges });
  }

  return {
    repository, contributor, dateRange, mode: "basic", commitsAnalyzed: activity.commits.length,
    coverageWarnings: activity.warnings, workAreas,
    summary: `GitHub attributes ${activity.commits.length} ${activity.commits.length === 1 ? "commit" : "commits"} to @${contributor} in the selected period.`,
    accomplishments, technicalHighlights, blockers: "", nextSteps: "", evidenceLinks: activity.commits,
  };
}
