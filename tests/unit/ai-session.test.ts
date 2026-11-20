import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { GET as callback } from "../../src/app/api/ai/callback/route";
import { POST as session } from "../../src/app/api/ai/session/route";

const origin = "https://commitcred-fixture.dev";
const fixture = vi.hoisted(() => ({
  auth: { getUser: vi.fn(), signInAnonymously: vi.fn(), exchangeCodeForSession: vi.fn(), signOut: vi.fn() },
  ledger: vi.fn(), requireAiAccess: vi.fn(), get: vi.fn(), set: vi.fn(),
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: fixture.get, set: fixture.set }) }));
vi.mock("../../src/lib/auth/supabase", () => ({
  authClient: async () => ({ auth: fixture.auth }),
  supabaseSettings: () => ({ url: "https://fixture.supabase.co" }),
}));
vi.mock("../../src/lib/ai/ledger", async (original) => ({
  ...await original<typeof import("../../src/lib/ai/ledger")>(), ledger: fixture.ledger,
}));
vi.mock("../../src/lib/ai/access", async (original) => ({
  ...await original<typeof import("../../src/lib/ai/access")>(), requireAiAccess: fixture.requireAiAccess,
}));

const post = (body: unknown) => session(new Request(`${origin}/api/ai/session`, { method: "POST", body: JSON.stringify(body) }));

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("SITE_URL", origin);
  fixture.requireAiAccess.mockResolvedValue({ origin, ip: "192.0.2.1", secret: "x".repeat(32) });
  fixture.auth.getUser.mockResolvedValue({ data: { user: null } });
  fixture.ledger.mockResolvedValue({ code: "ok" });
});
afterEach(() => vi.unstubAllEnvs());

it("rejects missing adult, region, privacy and CAPTCHA acknowledgements before creating a guest", async () => {
  expect((await post({ action: "consent", adult: false, eligible: true, privacy: true })).status).toBe(400);
  expect((await post({ action: "consent", adult: true, eligible: false, privacy: true })).status).toBe(400);
  expect((await post({ action: "consent", adult: true, eligible: true, privacy: false })).status).toBe(400);
  expect((await post({ action: "consent", adult: true, eligible: true, privacy: true })).status).toBe(400);
  expect(fixture.auth.signInAnonymously).not.toHaveBeenCalled();
  expect(fixture.ledger).not.toHaveBeenCalled();
});

it("creates accounts on demand only and requires a verified Supabase signup before guest allocation", async () => {
  const body = { action: "consent", adult: true, eligible: true, privacy: true, captcha: "challenge" };
  fixture.auth.signInAnonymously.mockResolvedValueOnce({ error: new Error("bad captcha"), data: {} });
  expect((await post(body)).status).toBe(400);
  expect(fixture.ledger).not.toHaveBeenCalled();
  fixture.auth.signInAnonymously.mockResolvedValueOnce({ data: { user: { id: "verified-id", is_anonymous: true } } });
  expect((await post(body)).status).toBe(200);
  expect(fixture.ledger.mock.calls.map(([action]) => action)).toEqual(["signup", "guest_consent"]);
  expect(fixture.ledger).toHaveBeenLastCalledWith("guest_consent", { p_user: "verified-id" });
});

it("never exchanges a callback with missing browser state or follows an arbitrary return path", async () => {
  const result = await callback(new Request(`${origin}/api/ai/callback?code=${"c".repeat(32)}&next=https://untrusted.dev`));
  expect(result.status).toBe(303);
  expect(result.headers.get("location")).toBe(`${origin}/?google=failed#report-generator`);
  expect(fixture.auth.exchangeCodeForSession).not.toHaveBeenCalled();
});

it("binds a verified link to the same anonymous wallet and handles a conflict without signing in", async () => {
  const id = "74276f66-6f64-4c23-a292-3f899a704c24";
  const nonce = "a".repeat(48);
  fixture.get.mockReturnValue({ value: `${nonce}:link:${id}:flow-fixture` });
  const conflict = await callback(new Request(`${origin}/api/ai/callback?flow=${nonce}&error=access_denied&error_code=identity_already_exists`));
  expect(conflict.headers.get("location")).toContain("google=conflict");
  expect(fixture.auth.exchangeCodeForSession).not.toHaveBeenCalled();

  fixture.auth.getUser.mockResolvedValueOnce({ data: { user: { id } } })
    .mockResolvedValueOnce({ data: { user: { id, identities: [{ provider: "google" }] } } });
  fixture.auth.exchangeCodeForSession.mockResolvedValueOnce({ error: null });
  const linked = await callback(new Request(`${origin}/api/ai/callback?flow=${nonce}&code=${"c".repeat(32)}`));
  expect(linked.headers.get("location")).toContain("google=connected");
  expect(fixture.auth.exchangeCodeForSession).toHaveBeenCalledWith("c".repeat(32), { flowId: "flow-fixture" });
});
