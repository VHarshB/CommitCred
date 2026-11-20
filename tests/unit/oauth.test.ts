import { expect, it } from "vitest";
import { callbackResult, providerRedirect, readFlow } from "../../src/lib/auth/oauth";

const supabase = "https://fixture.supabase.co";
const origin = "https://commitcred-fixture.dev";
const nonce = "a".repeat(48);

it("binds OAuth callback state to the browser and a PKCE flow", () => {
  const id = "74276f66-6f64-4c23-a292-3f899a704c24";
  const cookie = `${nonce}:link:${id}:flow-fixture`;
  expect(readFlow(cookie, nonce)).toEqual({ mode: "link", user: id, flowId: "flow-fixture" });
  expect(readFlow(cookie, "b".repeat(48))).toBeNull();
  expect(readFlow(undefined, nonce)).toBeNull();
  expect(callbackResult(origin, "conflict").href).toBe(`${origin}/?google=conflict#report-generator`);
});

it("permits only known Supabase and Google redirects", () => {
  const authorize = `${supabase}/auth/v1/authorize?provider=google`;
  const google = `https://accounts.google.com/o/oauth2/v2/auth?redirect_uri=${encodeURIComponent(supabase + "/auth/v1/callback")}&state=fixture`;
  expect(providerRedirect(authorize, supabase, "signin")).toBe(authorize);
  expect(providerRedirect(google, supabase, "link")).toBe(google);
  expect(() => providerRedirect(google, supabase, "signin")).toThrow();
  expect(() => providerRedirect(google.replace("fixture.supabase", "untrusted.supabase"), supabase, "link")).toThrow();
  expect(() => providerRedirect("https://untrusted.dev/auth/v1/authorize?provider=google", supabase, "signin")).toThrow();
});
