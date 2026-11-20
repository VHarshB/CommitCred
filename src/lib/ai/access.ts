import { getContext } from "@netlify/functions";
import { createHmac, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
import { cookies } from "next/headers";
import { AppError } from "../http";
import { aiSettings, type AiSettings } from "./availability";

export const betaCookie = "__Host-commitcred-beta";
export const betaLifetime = 60 * 60 * 8;
export const unavailableMessage = "Smart Report is temporarily unavailable. Basic Report is free and works without AI.";

export function mac(secret: string, text: string) {
  return createHmac("sha256", secret).update(text).digest("hex");
}

export function safelyEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function betaToken(settings: AiSettings, expires: number) {
  return `${expires}.${mac(settings.secret, `invite:${settings.origin}:${expires}`)}`;
}

function validBeta(settings: AiSettings, token?: string) {
  const expires = Number(token?.split(".")[0]);
  const now = Math.floor(Date.now() / 1000);
  return Boolean(token && Number.isSafeInteger(expires) && expires > now && expires <= now + betaLifetime &&
    safelyEqual(betaToken(settings, expires), token));
}

export function optInAvailable(request: Request, mutation = false) {
  const config = aiSettings();
  if (!config || new URL(request.url).origin !== config.origin) return null;
  if (mutation && (request.headers.get("origin") !== config.origin ||
    request.headers.get("sec-fetch-site") === "cross-site")) return null;
  try {
    const context = getContext();
    if (context.geo?.country?.code !== "US" || !context.ip || !isIP(context.ip)) return null;
    return { ...config, ip: context.ip };
  } catch {
    return null;
  }
}

export async function requireAiAccess(request: Request, mutation = false) {
  const config = optInAvailable(request, mutation);
  if (!config || (config.betaMode && !validBeta(config, (await cookies()).get(betaCookie)?.value))) {
    throw new AppError(503, "smart_unavailable", unavailableMessage);
  }
  return config;
}

export function requestRisk(ip: string, secret: string, today = new Date().toISOString().slice(0, 10)) {
  return mac(secret, `network:${today}:${ip}`);
}
