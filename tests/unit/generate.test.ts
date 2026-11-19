import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "../../src/app/api/report/generate/route";
import { recentRange } from "../../src/lib/validation/input";

const range = recentRange(7);
const sha = "a".repeat(40);
const url = "https://github.com/team/api-fixture";
const payload = { repository: url, contributor: "developer", range, mode: "smart" };
const request = (body = payload) => new Request("http://localhost/api/report/generate", {
  method: "POST",
  headers: { "x-forwarded-for": "192.0.2.12" },
  body: JSON.stringify(body),
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function mockServices(modelSha: string, hasActivity = true) {
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("OPENAI_API_KEY", "test-key");
  vi.stubEnv("OPENAI_MODEL", "test-model");
  vi.stubEnv("AI_LOCAL_ENABLED", "true");

  const model = vi.fn(() => Response.json({
    choices: [{ finish_reason: "stop", message: {
      role: "assistant",
      content: JSON.stringify({ accomplishments: [{ statement: "Updated the filters.", shas: [modelSha] }], technicalHighlights: [] }),
    } }],
  }));
  const fetcher = vi.fn(async (input: string | URL | Request) => {
    const path = new URL(input instanceof Request ? input.url : input);
    if (path.hostname === "api.openai.com") return model();
    if (path.pathname.endsWith(sha)) return Response.json({ files: [{ filename: "src/filter.ts" }] });
    if (path.pathname.endsWith("/commits")) {
      return Response.json(hasActivity ? [{
        sha, author: { login: "developer" }, parents: [{}],
        commit: { message: "Update filters", author: { date: `${range.start}T12:00:00Z` } },
      }] : []);
    }
    return Response.json({ owner: { login: "team" }, name: "api-fixture", default_branch: "main", description: null, private: false });
  });
  vi.stubGlobal("fetch", fetcher);
  return { fetcher, model };
}

describe("Report API", () => {
  it("keeps Smart Report disabled without credentials", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    expect((await POST(request())).status).toBe(503);
  });

  it("parses structured OpenAI output through the SDK in local development", async () => {
    const { model } = mockServices(sha);
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

  it("does not use forwarded identity or opt-in flags to authorize production AI", async () => {
    const { fetcher } = mockServices(sha);
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AI_PUBLIC_ENABLED", "true");
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each(["", "malformed"])("produces Basic Report with optional AI config %j", async (key) => {
    const { model } = mockServices(sha);
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("OPENAI_API_KEY", key);
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "broken quota configuration");
    const response = await POST(request({ ...payload, mode: "basic" }));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toMatchObject({ mode: "basic", commitsAnalyzed: 1 });
    expect(model).not.toHaveBeenCalled();
  });

  it("returns an honest empty-range result for manually entered usernames", async () => {
    mockServices(sha, false);
    const response = await POST(request({ ...payload, contributor: "missing-from-list", mode: "basic" }));
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ code: "no_activity" });
  });

  it("rejects oversized streamed bodies before contacting providers", async () => {
    const { fetcher } = mockServices(sha);
    const response = await POST(new Request("http://localhost/api/report/generate", {
      method: "POST", body: JSON.stringify({ ...payload, contributor: "a".repeat(5000) }),
    }));
    expect(response.status).toBe(413);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
