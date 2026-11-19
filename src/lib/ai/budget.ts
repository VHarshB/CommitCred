import { createHmac } from "node:crypto";
import { AppError } from "../http";

function publicConfig() {
  const { UPSTASH_REDIS_REST_URL: url, UPSTASH_REDIS_REST_TOKEN: token, AI_CLIENT_HASH_SECRET: secret } = process.env;
  const daily = Number(process.env.AI_DAILY_BUDGET ?? 100);
  const perClient = Number(process.env.AI_CLIENT_DAILY_LIMIT ?? 3);
  if (!url || !/^https:\/\/[a-z0-9-]+\.upstash\.io\/?$/i.test(url) || !token || !secret || secret.length < 32) return;
  if (!Number.isSafeInteger(daily) || !Number.isSafeInteger(perClient) || perClient < 1 || daily < perClient) return;
  return { url, token, secret, daily, perClient };
}

function localEnabled() {
  return process.env.NODE_ENV === "development" && process.env.AI_LOCAL_ENABLED === "true";
}

export function smartEnabled() {
  return Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_MODEL && (
    localEnabled() || (process.env.VERCEL === "1" && process.env.AI_PUBLIC_ENABLED === "true" && publicConfig())
  ));
}

const reserveScript = `
local total = tonumber(redis.call("GET", KEYS[1]) or "0")
local client = tonumber(redis.call("GET", KEYS[2]) or "0")
if total >= tonumber(ARGV[1]) or client >= tonumber(ARGV[2]) then return 0 end
redis.call("INCR", KEYS[1])
redis.call("INCR", KEYS[2])
redis.call("EXPIRE", KEYS[1], 172800)
redis.call("EXPIRE", KEYS[2], 172800)
return 1`;

export async function reserveSmartRequest(request: Request, signal: AbortSignal) {
  if (!smartEnabled()) throw new AppError(503, "smart_unavailable", "Smart Report is unavailable. Generate a Basic Report instead.");
  if (localEnabled()) return;
  const config = publicConfig()!;
  const clientIp = request.headers.get("x-vercel-forwarded-for")?.trim();
  if (!clientIp || !/^[a-f\d:.]{2,45}$/i.test(clientIp)) {
    throw new AppError(503, "smart_unavailable", "Smart Report could not verify the request limit. Use Basic Report.");
  }
  const client = createHmac("sha256", config.secret).update(clientIp).digest("hex");
  const day = new Date().toISOString().slice(0, 10);
  let result: number;
  try {
    const response = await fetch(config.url, {
      method: "POST", headers: { Authorization: `Bearer ${config.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(["EVAL", reserveScript, "2", `commitcred:{ai}:${day}:total`, `commitcred:{ai}:${day}:${client}`, String(config.daily), String(config.perClient)]),
      redirect: "error", cache: "no-store", signal: AbortSignal.any([signal, AbortSignal.timeout(3_000)]),
    });
    if (!response.ok) throw new Error();
    const data = await response.json() as { result?: number };
    if (data.result !== 0 && data.result !== 1) throw new Error();
    result = data.result;
  } catch {
    throw new AppError(503, "smart_unavailable", "Smart Report could not check its usage limits. Use Basic Report or try again later.");
  }
  if (result === 0) throw new AppError(429, "smart_limit", "The daily Smart Report limit has been reached. Use Basic Report or try again tomorrow.");
}
