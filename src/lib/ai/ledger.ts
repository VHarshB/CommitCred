import { z } from "zod";
import { ledgerClient } from "../auth/supabase";
import { AppError } from "../http";
import { unavailableMessage } from "./access";

export const balanceSchema = z.object({
  guestRemaining: z.number().int().min(0).max(3),
  bonusRemaining: z.number().int().min(0).max(3),
  totalRemaining: z.number().int().min(0).max(6),
  google: z.boolean(),
  consented: z.boolean(),
  usedAllSix: z.boolean(),
});

type Action = "signup" | "status" | "guest_consent" | "consent" | "reserve" | "retry" | "complete" | "release" | "release_limited";

interface LedgerArgs {
  p_user?: string;
  p_key?: string;
  p_input_hash?: string;
  p_model?: string;
  p_receipt?: string;
  p_risk?: string;
  p_daily?: number;
  p_monthly?: number;
  p_concurrent?: number;
}

const resultSchema = balanceSchema.partial().extend({
  code: z.string(),
  reservation: z.uuid().optional(),
  receipt: z.string().nullish(),
});

export async function ledger(action: Action, args: LedgerArgs = {}) {
  try {
    const { data, error } = await ledgerClient().rpc("cc_ai", { p_action: action, ...args });
    if (error) throw Error();
    return resultSchema.parse(data);
  } catch {
    throw new AppError(503, "smart_unavailable", unavailableMessage);
  }
}

export function creditError(code: string) {
  switch (code) {
    case "no_credits": return new AppError(409, code, "You have no Smart Report credits left. Basic Report is always free.");
    case "in_flight": return new AppError(409, code, "A Smart Report is already in progress. Wait a moment and retry.");
    case "request_finished": return new AppError(409, code, "This report was already generated and its recovery window has expired.");
    case "request_conflict": return new AppError(409, code, "The report request changed. Start a new request.");
    case "global_limit":
    case "signup_limit":
    case "cooldown": return new AppError(429, code, "Smart Report is temporarily at its limit. Try later or use Basic Report.");
    case "consent_required": return new AppError(403, code, "Review the Smart Report eligibility and privacy information first.");
    case "request_failed": return new AppError(409, code, "This Smart Report did not finish. Retry with a new request or use Basic Report.");
    case "auth_required": return new AppError(401, code, "Your session has expired. Reopen Smart Report to continue.");
    default: return new AppError(503, "smart_unavailable", unavailableMessage);
  }
}
