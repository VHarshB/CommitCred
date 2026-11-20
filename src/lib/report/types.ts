import type { DateRange } from "../validation/input";

export interface Repository {
  owner: string;
  name: string;
  description: string | null;
  branch: string;
  url: string;
}

export interface Contributor {
  login: string;
  avatar: string;
}

export interface Commit {
  sha: string;
  message: string;
  author: string;
  date: string;
  url: string;
  files: string[];
  additions: number | null;
  deletions: number | null;
  merge: boolean;
}

export interface Activity {
  detailFetchFailed?: boolean;
  commits: Commit[];
  warnings: string[];
}

export interface Accomplishment {
  id: string;
  statement: string;
  shas: string[];
  edited?: boolean;
}

export interface Report {
  repository: Repository;
  contributor: string;
  dateRange: DateRange;
  mode: "basic" | "smart";
  commitsAnalyzed: number;
  coverageWarnings: string[];
  workAreas: string[];
  summary: string;
  accomplishments: Accomplishment[];
  technicalHighlights: Accomplishment[];
  blockers: string;
  nextSteps: string;
  evidenceLinks: Commit[];
  sample?: boolean;
}
