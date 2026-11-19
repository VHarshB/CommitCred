import { describe, expect, it } from "vitest";
import { applySmartOutput, enhanceReport } from "../../src/lib/ai/smart";
import { formatReport, reportFilename } from "../../src/lib/export/report";
import { buildReport } from "../../src/lib/report/basic";
import { exampleReport } from "../../src/lib/report/example";
import { recentRange, repositorySchema } from "../../src/lib/validation/input";

describe("input validation", () => {
  it("normalizes supported URLs", () => {
    expect(repositorySchema.parse(" https://github.com/Team/project.git/ ")).toEqual({ owner: "Team", name: "project" });
  });

  it.each(["https://elsewhere.test/a/b", "github.com/a/b", "https://github.com/a/b/issues", "https://github.com/a/..", "https://github.com/a/b?token=123"])("rejects %s", (url) => {
    expect(repositorySchema.safeParse(url).success).toBe(false);
  });

  it("uses inclusive UTC calendar days", () => {
    expect(recentRange(7, new Date("2026-11-02T23:00:00Z"))).toEqual({ start: "2026-10-27", end: "2026-11-02" });
  });
});

describe("reports and exports", () => {
  it("groups evidence and describes vague commits without inferring an achievement", () => {
    const example = exampleReport();
    const activity = { warnings: [], commits: example.evidenceLinks.map((commit, index) => index === 0 ? { ...commit, files: [], message: "fix auth bug" } : commit) };
    const report = buildReport(example.repository, example.contributor, example.dateRange, activity);
    expect(buildReport(example.repository, example.contributor, example.dateRange, activity)).toEqual(report);
    expect(report.accomplishments).toContainEqual(expect.objectContaining({
      statement: "Recorded commit activity titled “fix auth bug”.", shas: [activity.commits[0].sha],
    }));
  });

  it("validates model references and rejects unsupported or malformed output", () => {
    const report = exampleReport();
    const sha = report.evidenceLinks[0].sha;
    const allowed = new Set([sha]);
    const modelOutput = (reference: string) => ({
      accomplishments: [{ statement: "Updated filters.", shas: [reference] }],
      technicalHighlights: [],
    });
    expect(applySmartOutput(report, modelOutput(sha), allowed).mode).toBe("smart");
    expect(() => applySmartOutput(report, modelOutput("fake"), allowed)).toThrow();
    expect(() => applySmartOutput(report, {}, allowed)).toThrow();
  });

  it("offers Basic guidance when Smart has no authored evidence", async () => {
    const report = { ...exampleReport(), evidenceLinks: [] };
    await expect(enhanceReport(report, AbortSignal.timeout(100))).rejects.toMatchObject({ code: "smart_failed" });
  });

  it("exports edited text and matching evidence URLs with safe filenames", () => {
    const report = exampleReport();
    const commit = report.evidenceLinks[0];
    commit.url = `https://github.com/owner/project/commit/${commit.sha}`;
    report.accomplishments = [{ id: "edit", statement: "<b>Edited</b>", shas: [commit.sha], edited: true }];
    report.blockers = "Waiting for feedback";
    const markdown = formatReport(report, "md");
    expect(markdown).toContain("# Sprint Contribution Report");
    expect(markdown).toContain("\\<b\\>Edited");
    expect(markdown).toContain("(user edited)");
    expect(markdown).toContain(`[0000000](${commit.url})`);
    expect(markdown).toContain("Waiting for feedback");
    expect(formatReport(report, "txt")).toContain("<b>Edited</b>");
    expect(reportFilename("md", new Date("2026-11-18T00:00:00Z"))).toBe("commitcred-report-2026-11-18.md");
  });
});
