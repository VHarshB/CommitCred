import { afterEach, expect, it, vi } from "vitest";
import { GET } from "../../src/app/api/github/repository/route";

const request = (name: string) => new Request(
  `http://localhost/api/github/repository?url=${encodeURIComponent(`https://github.com/team/${name}`)}`,
);

function repository(name: string) {
  return Response.json({ owner: { login: "team" }, name, default_branch: "main", description: null, private: false });
}

afterEach(() => vi.unstubAllGlobals());

it("surfaces contributor rate limits with a retry message", async () => {
  vi.stubGlobal("fetch", vi.fn()
    .mockResolvedValueOnce(repository("limited"))
    .mockResolvedValueOnce(new Response(null, { status: 403, headers: { "retry-after": "60" } })));
  const response = await GET(request("limited"));
  expect(response.status).toBe(429);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(await response.json()).toMatchObject({ code: "github_limit" });
});

it("still allows manual contributors when contributor data is unavailable", async () => {
  vi.stubGlobal("fetch", vi.fn()
    .mockResolvedValueOnce(repository("manual"))
    .mockResolvedValueOnce(new Response(null, { status: 502 })));
  const response = await GET(request("manual"));
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ repository: { name: "manual" }, contributors: [], partial: true });
});
