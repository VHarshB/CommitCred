import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "../../src/app/api/report/generate/route";
import { recentRange } from "../../src/lib/validation/input";

const range = recentRange(7);
const sha = "a".repeat(40);
const url = "https://github.com/team/api-fixture";
const body = { repository: url, contributor: "developer", range, mode: "smart" };
const request = () => new Request("http://localhost/api/report/generate", {
  method: "POST",
  headers: { "x-vercel-forwarded-for": "192.0.2.12" },
  body: JSON.stringify(body),
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function mockServices(modelSha: string, remainingBudget = true) {
  vi.stubEnv("OPENAI_API_KEY", "test-key");
  vi.stubEnv("OPENAI_MODEL", "test-model");
  vi.stubEnv("VERCEL", "1");
  vi.stubEnv("AI_LOCAL_ENABLED", "false");
  vi.stubEnv("AI_PUBLIC_ENABLED", "true");
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://fixture.upstash.io");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "test-token");
  vi.stubEnv("AI_CLIENT_HASH_SECRET", "x".repeat(32));

  const model = vi.fn(() => Response.json({
    choices: [{ finish_reason: "stop", message: {
      role: "assistant",
      content: JSON.stringify({ accomplishments: [{ statement: "Updated the filters.", shas: [modelSha] }], technicalHighlights: [] }),
    } }],
  }));
  vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
    const path = new URL(input instanceof Request ? input.url : input);
    if (path.hostname === "fixture.upstash.io") return Response.json({ result: Number(remainingBudget) });
    if (path.hostname === "api.openai.com") return model();
    if (path.pathname.endsWith(sha)) return Response.json({ files: [{ filename: "src/filter.ts" }] });
    if (path.pathname.endsWith("/commits")) {
      return Response.json([{
        sha, author: { login: "developer" }, parents: [{}],
        commit: { message: "Update filters", author: { date: `${range.start}T12:00:00Z` } },
      }]);
    }
    return Response.json({ owner: { login: "team" }, name: "api-fixture", default_branch: "main", description: null, private: false });
  }));
  return model;
}

describe("Smart Report API", () => {
  it("keeps public Smart Report disabled without credentials", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    expect((await POST(request())).status).toBe(503);
  });

  it("parses structured OpenAI output through the SDK and keeps source evidence", async () => {
    const model = mockServices(sha);
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      mode: "smart",
      accomplishments: [{ statement: "Updated the filters.", shas: [sha] }],
      evidenceLinks: [{ sha, url: `${url}/commit/${sha}` }],
    });
    expect(model).toHaveBeenCalledOnce();
  });

  it("returns an explicit Basic fallback when model references are unsupported", async () => {
    mockServices("unsupported");
    const response = await POST(request());
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ code: "smart_failed", fallback: { mode: "basic" } });
  });

  it("does not call the model when Redis rejects the reservation", async () => {
    const model = mockServices(sha, false);
    expect((await POST(request())).status).toBe(429);
    expect(model).not.toHaveBeenCalled();
  });
});
