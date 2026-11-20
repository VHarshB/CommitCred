import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../../src/app/api/report/generate/route";
import { recentRange } from "../../src/lib/validation/input";

const mocks = vi.hoisted(() => ({ context: vi.fn(), auth: vi.fn(), rpc: vi.fn(), provider: vi.fn() }));
vi.mock("@netlify/functions", () => ({ getContext: mocks.context }));
vi.mock("../../src/lib/auth/supabase", () => ({
  authClient: async () => ({ auth: { getUser: mocks.auth } }),
  ledgerClient: () => ({ rpc: mocks.rpc }),
}));
vi.mock("@google/genai", () => ({
  GoogleGenAI: class { models = { generateContent: mocks.provider }; },
  ApiError: class extends Error {
    status: number;
    constructor({ status }: { status: number }) { super("upstream secret"); this.status = status; }
  },
}));

const range = recentRange(7);
const sha = "a".repeat(40);
const origin = "https://commitcred-fixture.dev";
const url = "https://github.com/team/api-fixture";
const payload = { repository: url, contributor: "developer", range, mode: "smart" };
const request = (body = payload, headers: Record<string, string> = {}) => new Request(`${origin}/api/report/generate`, {
  method: "POST", headers: { origin, "idempotency-key": randomUUID(), ...headers }, body: JSON.stringify(body),
});
const id = randomUUID();
const reservation = randomUUID();
const outcome = (reference: string) => ({ accomplishments: [{ statement: "Updated filters.", shas: [reference] }], technicalHighlights: [] });

beforeEach(() => {
  vi.resetAllMocks();
  for (const [name, value] of Object.entries({
    SITE_URL: origin, AI_ALLOWED_ORIGIN: origin, AI_PUBLIC_ENABLED: "true", AI_FREE_TIER_CONFIRMED: "true",
    AI_PUBLIC_ELIGIBILITY_VERIFIED: "true", AI_BETA_ENABLED: "false", AI_SECURITY_SECRET: "s".repeat(32),
    TURNSTILE_SITE_KEY: "fixture", GEMINI_API_KEY: "fixture-key", GEMINI_MODEL: "gemini-fixture",
    NEXT_PUBLIC_SUPABASE_URL: "https://fixture.supabase.co", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture",
    SUPABASE_SECRET_KEY: "sb_secret_fixture",
  })) vi.stubEnv(name, value);
  mocks.context.mockReturnValue({ geo: { country: { code: "US" } }, ip: "192.0.2.12" });
  mocks.auth.mockResolvedValue({ data: { user: { id } } });
  mocks.rpc.mockImplementation(async (_name, args) => ({
    data: {
      retry: { code: "missing" }, status: { code: "ok", consented: true, totalRemaining: 3 },
      reserve: { code: "reserved", reservation }, complete: { code: "ok" }, release: { code: "ok" }, release_limited: { code: "ok" },
    }[args.p_action as string],
    error: null,
  }));
  mocks.provider.mockResolvedValue({ text: JSON.stringify(outcome(sha)) });
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

function github(activity = true, merge = false, failedDetails = false) {
  const fetcher = vi.fn(async (input: string | URL | Request) => {
    const path = new URL(input instanceof Request ? input.url : input);
    expect(path.hostname).toBe("api.github.com");
        if (path.pathname.endsWith(sha)) {
      return failedDetails ? new Response(null, { status: 500 }) : Response.json({ files: [{ filename: "src/private-customer/filter.ts" }] });
    }
    if (path.pathname.endsWith("/commits")) {
      return Response.json(activity ? [{
        sha, author: { login: "developer" }, parents: merge ? [{}, {}] : [{}],
        commit: { message: "Update filters person@example.org token123", author: { date: `${range.start}T12:00:00Z` } },
      }] : []);
    }
    return Response.json({ owner: { login: "team" }, name: "api-fixture", default_branch: "main", description: null, private: false });
  });
  vi.stubGlobal("fetch", fetcher);
  return fetcher;
}

function actions() {
  return mocks.rpc.mock.calls.map(([, { p_action }]) => p_action);
}

describe("Smart and Basic Report API", () => {
  it("verifies Smart output, minimizes provider evidence, and commits an encrypted receipt", async () => {
    github();
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ mode: "smart", accomplishments: outcome(sha).accomplishments });
    expect(actions()).toEqual(["retry", "status", "reserve", "complete"]);
    expect(mocks.provider).toHaveBeenCalledTimes(1);
    const call = mocks.provider.mock.calls[0][0];
    expect(call.config).toMatchObject({ responseMimeType: "application/json", maxOutputTokens: 1800 });
    expect(call.contents).toContain(sha);
    expect(call.contents).not.toMatch(/person|token123|private-customer|developer/);
    expect(mocks.rpc.mock.calls[3][1].p_receipt).not.toContain("Updated filters");
  });

  it.each(["wrong SHA", "invalid JSON", "timeout", "429"])("releases the reservation on %s", async (failure) => {
    github();
    if (failure === "wrong SHA") mocks.provider.mockResolvedValue({ text: JSON.stringify(outcome("b".repeat(40))) });
    if (failure === "invalid JSON") mocks.provider.mockResolvedValue({ text: "not valid" });
    if (failure === "timeout") mocks.provider.mockRejectedValue(new DOMException("Timeout", "TimeoutError"));
    if (failure === "429") {
      const { ApiError } = await import("@google/genai");
      mocks.provider.mockRejectedValue(new ApiError({ status: 429, message: "fixture secret" }));
    }
    const response = await POST(request());
    expect(response.status).toBe(failure === "429" ? 429 : 502);
    expect(actions()).toEqual(["retry", "status", "reserve", failure === "429" ? "release_limited" : "release"]);
    const output = await response.json();
    expect(output.fallback.mode).toBe("basic");
    expect(output.error).not.toContain("fixture secret");
  });

  it("replays the exact idempotency key without another reservation or provider call", async () => {
    github();
    const key = randomUUID();
    const first = await POST(request(payload, { "idempotency-key": key }));
    expect(first.status).toBe(200);
    const receipt = mocks.rpc.mock.calls[3][1].p_receipt;
    mocks.rpc.mockResolvedValue({ data: { code: "replay", receipt } });
    const second = await POST(request(payload, { "idempotency-key": key }));
    expect(second.status).toBe(200);
    expect(mocks.provider).toHaveBeenCalledTimes(1);
    expect(actions()).toEqual(["retry", "status", "reserve", "complete", "retry"]);
  });

  it.each(["missing origin", "foreign origin", "foreign country", "no platform context", "missing configuration"])(
    "fails closed for %s despite spoofed request headers", async (reason) => {
      const fetcher = github();
      const headers: Record<string, string> = { "x-country": "US", "x-forwarded-for": "192.0.2.12" };
      if (reason === "missing origin") headers.origin = "";
      if (reason === "foreign origin") headers.origin = "https://untrusted.dev";
      if (reason === "foreign country") mocks.context.mockReturnValue({ geo: { country: { code: "GB" } }, ip: "192.0.2.12" });
      if (reason === "no platform context") mocks.context.mockImplementation(() => { throw Error(); });
      if (reason === "missing configuration") vi.stubEnv("GEMINI_API_KEY", "");
      expect((await POST(request(payload, headers))).status).toBe(503);
      expect(mocks.rpc).not.toHaveBeenCalled();
      expect(mocks.provider).not.toHaveBeenCalled();
      expect(fetcher).not.toHaveBeenCalled();
    },
  );

  it("rejects missing consent and exhausted wallets before GitHub or Gemini", async () => {
    const fetcher = github();
    for (const status of [{ consented: false, totalRemaining: 3 }, { consented: true, totalRemaining: 0 }]) {
      mocks.rpc.mockResolvedValueOnce({ data: { code: "missing" } }).mockResolvedValueOnce({ data: { code: "ok", ...status } });
      const response = await POST(request());
      expect(response.status).toBe(status.consented ? 409 : 403);
    }
    expect(fetcher).not.toHaveBeenCalled();
    expect(mocks.provider).not.toHaveBeenCalled();
  });

  it("returns Basic and never calls Gemini when a global database cap rejects the reservation", async () => {
    github();
    mocks.rpc.mockResolvedValueOnce({ data: { code: "missing" } })
      .mockResolvedValueOnce({ data: { code: "ok", totalRemaining: 1, consented: true } })
      .mockResolvedValueOnce({ data: { code: "global_limit" } });
    const response = await POST(request());
    expect(response.status).toBe(429);
    expect((await response.json()).fallback.mode).toBe("basic");
    expect(mocks.provider).not.toHaveBeenCalled();
  });

  it("uses Basic fallback without spending a credit when GitHub details fail", async () => {
    github(true, false, true);
    const response = await POST(request());
    expect(response.status).toBe(502);
    expect((await response.json()).fallback.mode).toBe("basic");
    expect(actions()).toEqual(["retry", "status"]);
    expect(mocks.provider).not.toHaveBeenCalled();
  });

  it("avoids reservations and provider calls when there is no non-merge evidence", async () => {
    github(true, true);
    expect((await POST(request())).status).toBe(422);
    expect(actions()).toEqual(["retry", "status"]);
    expect(mocks.provider).not.toHaveBeenCalled();
  });

  it.each(["", "malformed"])("generates Basic Report with optional config %j", async (value) => {
    github();
    vi.stubEnv("GEMINI_API_KEY", value);
    vi.stubEnv("SUPABASE_SECRET_KEY", value);
    const response = await POST(request({ ...payload, mode: "basic" }, { origin: "" }));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toMatchObject({ mode: "basic", commitsAnalyzed: 1 });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("rejects oversized streamed bodies before contacting providers", async () => {
    const fetcher = github();
    const response = await POST(request({ ...payload, contributor: "a".repeat(5000) }));
    expect(response.status).toBe(413);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("reports a genuine empty range", async () => {
    github(false);
    expect((await POST(request({ ...payload, mode: "basic", contributor: "not-found" }))).status).toBe(422);
  });
});
