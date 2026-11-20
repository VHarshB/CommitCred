export const oauthCookie = "__Host-commitcred-oauth";
export const oauthPath = "/api/ai/callback";
export const oauthLifetime = 10 * 60;

export function callbackResult(origin: string, result: "connected" | "cancelled" | "conflict" | "failed") {
  const url = new URL("/", origin);
  url.searchParams.set("google", result);
  url.hash = "report-generator";
  return url;
}

export function providerRedirect(value: string, upstream: string, intent: "link" | "signin") {
  const url = new URL(value);
  const supabase = new URL(upstream).origin;
  if (url.username || url.password) throw new Error("Unexpected OAuth URL");
  if (intent === "link" && url.origin === "https://accounts.google.com" &&
    ["/o/oauth2/auth", "/o/oauth2/v2/auth"].includes(url.pathname) &&
    url.searchParams.get("redirect_uri") === new URL("/auth/v1/callback", supabase).href &&
    url.searchParams.get("state")) return url.href;
  if (url.origin !== supabase || url.pathname !== "/auth/v1/authorize" ||
    url.searchParams.get("provider") !== "google") throw new Error("Unexpected OAuth URL");
  return url.href;
}

export function readFlow(cookie: string | undefined, nonce: string | null) {
  const [stored, mode, user, verifier] = cookie?.split(":") ?? [];
  if (!nonce || !/^[a-f0-9]{48}$/.test(nonce) || stored !== nonce) return null;
  const flowId = verifier || undefined;
  if (flowId && !/^[a-zA-Z0-9_-]{8,160}$/.test(flowId)) return null;
  if (mode === "link" && user && /^[a-f0-9-]{36}$/i.test(user)) return { mode, user, flowId };
  if (mode === "signin" && !user) return { mode, flowId };
  return null;
}
