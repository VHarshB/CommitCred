import { z } from "zod";
import { AppError } from "../http";
import { commitTitle } from "../report/basic";
import type { Report } from "../report/types";

const unsupportedOutcome = /\d|\b(?:tests? (?:all )?passed|deployed (?:to|successfully)|(?:fixed|resolved|eliminated) (?:a |the |an )?(?:bug|issue|error)|guaranteed|uptime)\b/i;

const statementSchema = z.object({
  statement: z.string().trim().min(1).max(400).refine((value) => !unsupportedOutcome.test(value)),
  shas: z.array(z.string().regex(/^[a-f0-9]{40}$/i)).min(1).max(12),
}).strict();
export const smartSchema = z.object({
  accomplishments: z.array(statementSchema).max(8),
  technicalHighlights: z.array(statementSchema).max(8),
}).strict().refine((value) => value.accomplishments.length + value.technicalHighlights.length > 0);

const titleWords = new Set("add added update updated remove removed rename renamed refactor refactored fix fixed change changed docs documentation test tests testing build config configuration dependency dependencies types type validation ui api route error errors render rendering layout style styles support improve accessibility keyboard mobile report export import format parser feature database query schema cache loading filter filters dates date range behavior coverage".split(" "));
const areas = new Set("src app lib components tests test docs scripts public assets config styles".split(" "));
const extensions = new Set("ts tsx js jsx css html md json yaml yml sql py rs go java rb sh".split(" "));

export function smartEvidence(report: Report) {
  return report.evidenceLinks.filter(({ sha, merge }) => !merge && /^[a-f0-9]{40}$/i.test(sha)).slice(0, 12).map((commit) => ({
    sha: commit.sha,
    titleKeywords: (commitTitle(commit).toLowerCase().match(/(?:^|\s)[a-z]+(?=$|\s)/g) ?? [])
      .map((word) => word.trim()).filter((word) => titleWords.has(word)).slice(0, 12),
    pathHints: commit.files.slice(0, 8).map((file) => {
      const root = file.includes("/") ? file.split("/")[0] : "";
      const ext = file.split(".").at(-1) ?? "";
      return { area: areas.has(root) ? root : "other", extension: extensions.has(ext) ? ext : "other" };
    }),
    additions: Number.isSafeInteger(commit.additions) ? commit.additions : null,
    deletions: Number.isSafeInteger(commit.deletions) ? commit.deletions : null,
  })).filter(({ titleKeywords, pathHints }) => titleKeywords.length || pathHints.some(({ area, extension }) => area !== "other" || extension !== "other"));
}

export interface SmartReportProvider {
  generate(evidence: ReturnType<typeof smartEvidence>, signal: AbortSignal): Promise<unknown>;
}

export function applySmartOutput(report: Report, raw: unknown, allowedShas: ReadonlySet<string>): Report {
  const output = smartSchema.parse(raw);
  function verify(items: z.infer<typeof statementSchema>[], section: string) {
    return items.map(({ statement, shas }, index) => {
      if (shas.some((sha) => !allowedShas.has(sha))) throw new Error("Invalid evidence");
      return { id: `${section}-${index}`, statement, shas: [...new Set(shas)] };
    });
  }
  return {
    ...report, mode: "smart",
    accomplishments: verify(output.accomplishments, "smart-accomplishment"),
    technicalHighlights: verify(output.technicalHighlights, "smart-highlight"),
    coverageWarnings: [...report.coverageWarnings, "Gemini summarized limited, sanitized evidence from up to 12 non-merge commits. Verify statements against the linked commits."],
  };
}

export const badEvidence = () => new AppError(422, "smart_evidence", "There is not enough usable commit evidence for Smart Report. You can use the Basic Report.");
export const invalidOutput = () => new AppError(502, "smart_failed", "Gemini did not return a verified report. You can use the Basic Report.");
