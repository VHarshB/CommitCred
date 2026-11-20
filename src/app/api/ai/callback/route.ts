import { cookies } from "next/headers";
import { requireAiAccess } from "../../../../lib/ai/access";
import { authClient } from "../../../../lib/auth/supabase";
import { callbackResult, oauthCookie, readFlow } from "../../../../lib/auth/oauth";
import { siteOrigin } from "../../../../lib/seo/site";

export async function GET(request: Request) {
  const origin = siteOrigin()?.origin;
  if (!origin) return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
  const redirect = (status: Parameters<typeof callbackResult>[1]) => new Response(null, {
    status: 303, headers: { Location: callbackResult(origin, status).href, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });
  try {
    await requireAiAccess(request);
    const url = new URL(request.url);
    const store = await cookies();
    const flow = readFlow(store.get(oauthCookie)?.value, url.searchParams.get("flow"));
    if (!flow) return redirect("failed");
    store.set(oauthCookie, "", { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 0 });
    if (url.searchParams.has("error")) {
      return redirect(flow.mode === "link" && url.searchParams.get("error_code") === "identity_already_exists" ? "conflict" : "cancelled");
    }
    const code = url.searchParams.get("code");
    if (!code || !/^[a-zA-Z0-9_-]{16,256}$/.test(code)) return redirect("failed");

    const auth = await authClient();
    if (!auth) return redirect("failed");
    if (flow.mode === "link" && (await auth.auth.getUser()).data.user?.id !== flow.user) return redirect("failed");
    const exchange = await auth.auth.exchangeCodeForSession(code, flow.flowId ? { flowId: flow.flowId } : undefined);
    if (exchange.error) return redirect("failed");
    const user = (await auth.auth.getUser()).data.user;
    if (!user?.identities?.some(({ provider }) => provider === "google") || (flow.mode === "link" && user.id !== flow.user)) {
      await auth.auth.signOut({ scope: "local" });
      return redirect("failed");
    }
    return redirect("connected");
  } catch {
    return redirect("failed");
  }
}
