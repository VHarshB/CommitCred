export interface SmartAccessStatus {
  enabled: boolean;
  inviteRequired?: boolean;
  session?: "none" | "guest" | "google";
  siteKey?: string;
  totalRemaining?: number;
  guestRemaining?: number;
  bonusRemaining?: number;
  consented?: boolean;
  usedAllSix?: boolean;
}

export const smartDisabled: SmartAccessStatus = { enabled: false };

// Keep Supabase session credentials out of browser JavaScript. The app's
// same-origin route handlers own cookie refresh and PKCE exchanges.
export async function getSmartStatus(): Promise<SmartAccessStatus> {
  const response = await fetch("/api/ai/status", { cache: "no-store" });
  return response.ok ? await response.json() : smartDisabled;
}

export async function updateSmartSession(body: Record<string, unknown>) {
  const response = await fetch("/api/ai/session", {
    method: "POST", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "Smart Report is temporarily unavailable.");
  return result as { redirect?: string };
}
