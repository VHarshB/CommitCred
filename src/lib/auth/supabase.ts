import { createServerClient, type CookieMethodsServer } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export function supabaseSettings() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !/^https:\/\/[a-z0-9]+\.supabase\.co\/?$/.test(url) || !key?.startsWith("sb_publishable_")) return null;
  return { url, key };
}

async function boundedFetch(input: RequestInfo | URL, init?: RequestInit) {
  const timeout = AbortSignal.timeout(4_000);
  const original = init?.signal || (input instanceof Request ? input.signal : undefined);
  return fetch(input, {
    ...init, cache: "no-store", signal: original ? AbortSignal.any([timeout, original]) : timeout,
  });
}

function sessionClient(adapter: CookieMethodsServer) {
  const config = supabaseSettings();
  if (!config) return null;
  return createServerClient(config.url, config.key, {
    cookies: adapter,
    cookieOptions: { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" },
    global: { fetch: boundedFetch },
  });
}

export async function authClient() {
  // Authentication runs only in route handlers, where the SDK can refresh and
  // persist cookies when getUser reads an expired session.
  const store = await cookies();
  return sessionClient({
    getAll: () => store.getAll(),
    setAll: (values) => values.forEach(({ name, value, options }) => store.set(name, value, options)),
  });
}

export function ledgerClient() {
  const config = supabaseSettings();
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!config || !key?.startsWith("sb_secret_")) throw new Error("Ledger configuration unavailable");
  return createClient(config.url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: boundedFetch },
  });
}
