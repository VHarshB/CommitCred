import { siteOrigin } from "../seo/site";

function boundedInteger(raw: string | undefined, fallback: number, ceiling: number) {
  const value = raw === undefined ? fallback : Number(raw);
  return Number.isSafeInteger(value) && value > 0 && value <= ceiling ? value : 0;
}

export function aiSettings() {
  const publicMode = process.env.AI_PUBLIC_ENABLED === "true";
  const betaMode = process.env.AI_BETA_ENABLED === "true";
  const configuredOrigin = siteOrigin();
  const secret = process.env.AI_SECURITY_SECRET;
  const invite = process.env.AI_BETA_INVITE_CODE;
  const model = process.env.GEMINI_MODEL;
  const siteKey = process.env.TURNSTILE_SITE_KEY;
  const daily = boundedInteger(process.env.AI_GLOBAL_DAILY_CAP, 30, 30);
  const monthly = boundedInteger(process.env.AI_GLOBAL_MONTHLY_CAP, 300, 300);
  const concurrent = boundedInteger(process.env.AI_MAX_CONCURRENT, 2, 2);
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (
    publicMode === betaMode || process.env.AI_FREE_TIER_CONFIRMED !== "true" ||
    (publicMode && process.env.AI_PUBLIC_ELIGIBILITY_VERIFIED !== "true") ||
    !configuredOrigin || configuredOrigin.origin !== process.env.AI_ALLOWED_ORIGIN ||
    !secret || secret.length < 32 || (betaMode && (!invite || invite.length < 24)) ||
    !model || !/^gemini-[a-z0-9.-]{2,60}$/.test(model) || !process.env.GEMINI_API_KEY?.trim() ||
    !url || !/^https:\/\/[a-z0-9]+\.supabase\.co\/?$/.test(url) || !publicKey?.startsWith("sb_publishable_") ||
    !process.env.SUPABASE_SECRET_KEY?.startsWith("sb_secret_") || !siteKey?.trim() ||
    !daily || !monthly || !concurrent
  ) return null;

  return { publicMode, betaMode, origin: configuredOrigin.origin, secret, invite, model, siteKey, daily, monthly, concurrent };
}

export type AiSettings = NonNullable<ReturnType<typeof aiSettings>>;
