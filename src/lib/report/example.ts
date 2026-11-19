import { recentRange } from "../validation/input";
import { buildReport } from "./basic";
import type { Commit, Repository } from "./types";

export function exampleReport() {
  const repository: Repository = { owner: "sample-team", name: "campus-planner", branch: "main", description: null, url: "" };
  const contributor = "sample-developer";
  const dateRange = recentRange(7);
  const makeCommit = (index: number, message: string, files: string[]): Commit => ({
    sha: String(index).padStart(40, "0"), message, files, author: contributor, date: dateRange.end,
    url: "", additions: null, deletions: null, merge: false,
  });
  return {
    ...buildReport(repository, contributor, dateRange, {
      commits: [
        makeCommit(1, "Add event date filters", ["src/events/filters.ts", "src/events/list.tsx"]),
        makeCommit(2, "Cover date filter boundaries", ["tests/events.test.ts"]),
        makeCommit(3, "Document calendar setup", ["docs/calendar.md"]),
      ],
      warnings: ["Sample data. These fictional commits do not represent real GitHub activity."],
    }),
    sample: true,
  };
}
