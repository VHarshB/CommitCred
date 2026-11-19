import { AppError } from "../http";
import type { Activity, Commit, Contributor, Repository } from "../report/types";
import type { DateRange, RepositoryInput } from "../validation/input";
import { github } from "./client";

interface GitHubRepository {
  owner: { login: string };
  name: string;
  description: string | null;
  default_branch: string;
  private: boolean;
  visibility?: string;
}

interface GitHubCommit {
  sha: string;
  author: { login: string } | null;
  commit: { message: string; author: { date: string } | null };
  parents: unknown[];
}

interface CommitDetails {
  files?: { filename: string }[];
  stats?: { additions: number; deletions: number };
}

const PAGE_SIZE = 25;
const MAX_PAGES = 3;
const DETAIL_LIMIT = 12;
const DETAIL_CONCURRENCY = 3;
const metadata = new Map<string, { value: Repository; expires: number }>();
const repositoryPath = (owner: string, name: string) => `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`;

export async function getRepository(input: RepositoryInput, signal: AbortSignal): Promise<Repository> {
  const key = `${input.owner}/${input.name}`.toLowerCase();
  const cached = metadata.get(key);
  if (!process.env.GITHUB_TOKEN && cached && cached.expires > Date.now()) return cached.value;
  const { data } = await github<GitHubRepository>(repositoryPath(input.owner, input.name), signal);
  if (data.private || (data.visibility && data.visibility !== "public")) {
    throw new AppError(404, "repository_unavailable", "Choose a public GitHub repository.");
  }
  const value = {
    owner: data.owner.login,
    name: data.name,
    description: data.description,
    branch: data.default_branch,
    url: `https://github.com/${data.owner.login}/${data.name}`,
  };
  if (!process.env.GITHUB_TOKEN) {
    if (metadata.size >= 100) metadata.delete(metadata.keys().next().value!);
    metadata.set(key, { value, expires: Date.now() + 60_000 });
  }
  return value;
}

export async function getContributors(repository: Repository, signal: AbortSignal) {
  const contributors: Contributor[] = [];
  let more = false;
  for (let page = 1; page <= 2; page++) {
    const result = await github<{ login: string; avatar_url: string }[]>(
      `${repositoryPath(repository.owner, repository.name)}/contributors?per_page=50&page=${page}`, signal,
    );
    contributors.push(...result.data.map(({ login, avatar_url }) => ({ login, avatar: avatar_url })));
    more = result.more;
    if (!more) break;
  }
  return { contributors, partial: more };
}

export async function getActivity(repository: Repository, contributor: string, range: DateRange, signal: AbortSignal): Promise<Activity> {
  const path = repositoryPath(repository.owner, repository.name);
  const start = `${range.start}T00:00:00Z`;
  const end = `${range.end}T23:59:59Z`;
  const commits = new Map<string, Commit>();
  const warnings = [`Coverage is limited to the default branch (${repository.branch}) and commits GitHub attributes to this account. Other branches, co-authorship, and unlinked commits may be missing.`];
  let more = false;

  for (let page = 1; page <= MAX_PAGES; page++) {
    const query = new URLSearchParams({ sha: repository.branch, author: contributor, since: start, until: end, per_page: String(PAGE_SIZE), page: String(page) });
    let result;
    try {
      result = await github<GitHubCommit[]>(`${path}/commits?${query}`, signal);
    } catch (error) {
      if (error instanceof AppError && error.status === 409) break;
      throw error;
    }
    for (const item of result.data) {
      const date = item.commit.author?.date;
      const author = item.author?.login;
      if (!date || author?.toLowerCase() !== contributor.toLowerCase()) continue;
      if (Date.parse(date) < Date.parse(start) || Date.parse(date) > Date.parse(end) || !Number.isFinite(Date.parse(date))) continue;
      if (!/^[a-f0-9]{40}$/i.test(item.sha)) continue;
      commits.set(item.sha, {
        sha: item.sha, message: item.commit.message.slice(0, 500), date, author,
        url: `${repository.url}/commit/${item.sha}`,
        merge: item.parents.length > 1, files: [], additions: null, deletions: null,
      });
    }
    more = result.more;
    if (!more) break;
  }

  if (more) warnings.push("GitHub returned more history than the report could scan. Try a shorter date range for fuller coverage.");
  const authored = [...commits.values()].filter((commit) => !commit.merge);
  const detailTargets = authored.slice(0, DETAIL_LIMIT);
  let incomplete = false;
  for (let index = 0; index < detailTargets.length && !signal.aborted; index += DETAIL_CONCURRENCY) {
    const results = await Promise.allSettled(detailTargets.slice(index, index + DETAIL_CONCURRENCY).map(async (commit) => {
      const { data, more: moreFiles } = await github<CommitDetails>(`${path}/commits/${commit.sha}?per_page=50`, signal);
      commit.files = (data.files ?? []).slice(0, 50).map((file) => file.filename.slice(0, 300));
      commit.additions = data.stats?.additions ?? null;
      commit.deletions = data.stats?.deletions ?? null;
      return moreFiles || !data.files || data.files.length > 50;
    }));
    incomplete ||= results.some((result) => result.status === "rejected" || result.value);
    if (results.some((result) => result.status === "rejected" && result.reason instanceof AppError && result.reason.status === 429)) break;
  }
  if (incomplete || signal.aborted || authored.length > DETAIL_LIMIT) {
    warnings.push("File and line statistics are available for only part of this history. Remaining items use commit messages as evidence.");
  }
  return { commits: [...commits.values()], warnings };
}
