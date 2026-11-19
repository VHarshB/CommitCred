import { afterEach, describe, expect, it, vi } from "vitest";
import { getActivity, getContributors, getRepository } from "../../src/lib/github/activity";
import type { Repository } from "../../src/lib/report/types";

const repo: Repository = { owner: "team", name: "project", description: null, branch: "main", url: "https://github.com/team/project" };
const range = { start: "2026-10-01", end: "2026-10-07" };
const signal = AbortSignal.timeout(5_000);
const next = { link: '<https://api.github.com/next>; rel="next"' };
const commit = (digit: string, login: string | null, date = "2026-10-04T12:00:00Z", merge = false) => ({
  sha: digit.repeat(40), author: login ? { login } : null, commit: { message: "Update filters", author: { date } }, parents: merge ? [{}, {}] : [{}],
});

afterEach(() => vi.unstubAllGlobals());

describe("GitHub activity", () => {
  it.each([[404, "repository_unavailable"], [429, "github_limit"]])("handles GitHub status %s", async (status, code) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status })));
    await expect(getRepository({ owner: "missing", name: "repo" }, signal)).rejects.toMatchObject({ code });
  });

  it("rejects private repositories", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ private: true })));
    await expect(getRepository({ owner: "private", name: "repo" }, signal)).rejects.toMatchObject({ code: "repository_unavailable" });
  });

  it("collects contributor pages", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json([{ login: "alpha", avatar_url: "a" }], { headers: next }))
      .mockResolvedValueOnce(Response.json([{ login: "beta", avatar_url: "b" }]));
    vi.stubGlobal("fetch", fetcher);
    await expect(getContributors(repo, signal)).resolves.toEqual({ contributors: [{ login: "alpha", avatar: "a" }, { login: "beta", avatar: "b" }], partial: false });
  });

  it("checks date and account attribution, limits pagination, and excludes merge file details", async () => {
    const authored = commit("1", "PERSON");
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json([
      authored, commit("2", "other"), commit("3", null), commit("4", "person", "2026-10-08T00:00:00Z"),
    ], { headers: next }))
      .mockResolvedValueOnce(Response.json([authored, commit("5", "person", undefined, true)], { headers: next }))
      .mockResolvedValueOnce(Response.json([], { headers: next }))
      .mockResolvedValueOnce(Response.json({ files: [{ filename: "src/filter.ts" }], stats: { additions: 2, deletions: 1 } }));
    vi.stubGlobal("fetch", fetcher);
    const activity = await getActivity(repo, "person", range, signal);
    expect(activity.commits.map(({ sha }) => sha[0])).toEqual(["1", "5"]);
    expect(activity.commits[0].files).toEqual(["src/filter.ts"]);
    expect(activity.commits[1].files).toEqual([]);
    expect(activity.warnings.join(" ")).toContain("more history");
    expect(fetcher).toHaveBeenCalledTimes(4);
    expect(fetcher.mock.calls[0][0]).toContain("sha=main");
  });

  it("returns no activity for an empty response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json([])));
    await expect(getActivity(repo, "person", range, signal)).resolves.toMatchObject({ commits: [] });
  });
});
