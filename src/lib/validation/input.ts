import { z } from "zod";

export const usernameSchema = z.string().trim().regex(/^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i, "Enter a valid GitHub username.");

export const repositorySchema = z.string().trim().max(260).transform((value, context) => {
  const match = /^https:\/\/github\.com\/([a-z\d][a-z\d-]{0,38})\/([a-z\d_.-]{1,100})\/?$/i.exec(value);
  const name = match?.[2].replace(/\.git$/i, "");
  if (!match || !name || name === "." || name === "..") {
    context.addIssue({ code: "custom", message: "Enter a public repository URL like https://github.com/owner/repository." });
    return z.NEVER;
  }
  return { owner: match[1], name };
});

const date = z.iso.date();

export const rangeSchema = z.object({ start: date, end: date }).refine(({ start, end }) => {
  const days = (Date.parse(end) - Date.parse(start)) / 86_400_000;
  return days >= 0 && days < 366 && end <= new Date().toISOString().slice(0, 10);
}, "Choose an ordered UTC date range of up to 366 days ending today or earlier.");

export const generationSchema = z.object({
  repository: repositorySchema,
  contributor: usernameSchema,
  range: rangeSchema,
  mode: z.enum(["basic", "smart"]),
}).strict();

export type RepositoryInput = z.output<typeof repositorySchema>;
export type DateRange = z.output<typeof rangeSchema>;

export function recentRange(days: number, now = new Date()): DateRange {
  const start = new Date(now);
  start.setUTCDate(start.getUTCDate() - days + 1);
  return { start: start.toISOString().slice(0, 10), end: now.toISOString().slice(0, 10) };
}
