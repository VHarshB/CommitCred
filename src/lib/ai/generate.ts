import { createHash } from "node:crypto";
import { AppError } from "../http";
import type { Report } from "../report/types";
import type { AiSettings } from "./availability";
import { geminiProvider } from "./gemini";
import { creditError, ledger } from "./ledger";
import { openReceipt, sealReceipt } from "./receipt";
import { applySmartOutput, badEvidence, invalidOutput, smartEvidence, smartSchema } from "./smart";

export function smartRequest(user: string, key: string, input: unknown) {
  return { p_user: user, p_key: key, p_input_hash: createHash("sha256").update(JSON.stringify(input)).digest("hex") };
}

export async function checkWallet(args: ReturnType<typeof smartRequest>) {
  const prior = await ledger("retry", args);
  if (prior.code === "replay") return prior.receipt ?? null;
  if (prior.code !== "missing") throw creditError(prior.code);
  const wallet = await ledger("status", { p_user: args.p_user });
  if (wallet.code !== "ok") throw creditError(wallet.code);
  if (!wallet.consented) throw creditError("consent_required");
  if (!wallet.totalRemaining) throw creditError("no_credits");
  return null;
}

export async function generateSmart(
  report: Report, args: ReturnType<typeof smartRequest>, settings: AiSettings, signal: AbortSignal, priorReceipt: string | null,
) {
  const evidence = smartEvidence(report);
  const allowed = new Set(evidence.map(({ sha }) => sha));
  const binding = `${args.p_user}:${args.p_key}:${args.p_input_hash}`;
  function replay(receipt: string) {
    try {
      return applySmartOutput(report, openReceipt(receipt, settings.secret, binding), new Set(report.evidenceLinks.filter((item) => !item.merge).map(({ sha }) => sha)));
    } catch {
      throw creditError("request_finished");
    }
  }

  if (priorReceipt) return replay(priorReceipt);
  if (!evidence.length) throw badEvidence();
  if (signal.aborted) throw invalidOutput();
  const reservation = await ledger("reserve", {
    ...args, p_model: settings.model, p_daily: settings.daily, p_monthly: settings.monthly, p_concurrent: settings.concurrent,
  });
  if (reservation.code === "replay" && reservation.receipt) return replay(reservation.receipt);
  if (reservation.code !== "reserved" || !reservation.reservation) throw creditError(reservation.code);

  const finalization = { p_user: args.p_user, p_key: reservation.reservation };
  try {
    const raw = await geminiProvider(settings.model).generate(evidence, signal);
    let enhanced: Report;
    let receipt: string;
    try {
      enhanced = applySmartOutput(report, raw, allowed);
      receipt = sealReceipt(smartSchema.parse(raw), settings.secret, binding);
    } catch {
      throw invalidOutput();
    }

    try {
      const result = await ledger("complete", { ...finalization, p_receipt: receipt });
      if (result.code !== "ok") throw creditError(result.code);
      return enhanced;
    } catch {
      // A timeout can happen after Postgres committed. Recover via the same ID.
      const retry = await ledger("retry", args);
      if (retry.code === "replay" && retry.receipt) return replay(retry.receipt);
      throw new AppError(503, "smart_retry", "The result could not be confirmed. Retry the same request to recover it without a second charge.");
    }
  } catch (error) {
    try {
      // The database only releases pending reservations. Completed charges are immutable.
      await ledger(error instanceof AppError && error.code === "smart_limit" ? "release_limited" : "release", finalization);
    } catch {
      // Stale leases are reconciled in the next database operation.
    }
    throw error;
  }
}
