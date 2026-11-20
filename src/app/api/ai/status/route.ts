import { optInAvailable, requireAiAccess } from "../../../../lib/ai/access";
import { creditError, ledger } from "../../../../lib/ai/ledger";
import { authClient } from "../../../../lib/auth/supabase";
import { errorResponse, privateJson } from "../../../../lib/http";

export async function GET(request: Request) {
  const settings = optInAvailable(request);
  if (!settings) return privateJson({ enabled: false });
  try {
    await requireAiAccess(request);
  } catch {
    return privateJson({ enabled: false, inviteRequired: settings.betaMode });
  }
  try {
    const auth = await authClient();
    const user = (await auth?.auth.getUser())?.data.user;
    if (!user) return privateJson({ enabled: true, session: "none", siteKey: settings.siteKey });
    const balance = await ledger("status", { p_user: user.id });
    if (balance.code !== "ok") throw creditError(balance.code);
    return privateJson({
      enabled: true, session: balance.google ? "google" : "guest", siteKey: settings.siteKey,
      guestRemaining: balance.guestRemaining, bonusRemaining: balance.bonusRemaining,
      totalRemaining: balance.totalRemaining, consented: balance.consented, usedAllSix: balance.usedAllSix,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
