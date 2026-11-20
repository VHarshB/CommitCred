import { getActivity, getRepository } from "../../../../lib/github/activity";
import { withGitHubCapacity } from "../../../../lib/github/traffic";
import { generationSchema } from "../../../../lib/validation/input";
import { AppError, errorResponse, privateJson, readJson } from "../../../../lib/http";
import { buildReport } from "../../../../lib/report/basic";
import { requireAiAccess } from "../../../../lib/ai/access";
import { checkWallet, generateSmart, smartRequest } from "../../../../lib/ai/generate";
import { authClient } from "../../../../lib/auth/supabase";
import { z } from "zod";

export async function POST(request: Request) {
  try {
    const input = generationSchema.parse(await readJson(request));
    const smart = input.mode === "smart" ? await requireAiAccess(request, true) : null;
    let credit: { args: ReturnType<typeof smartRequest>; receipt: string | null } | null = null;
    if (smart) {
      const key = z.uuid().parse(request.headers.get("idempotency-key"));
      const auth = await authClient();
      const user = (await auth?.auth.getUser())?.data.user;
      if (!user) throw new AppError(401, "auth_required", "Your Smart Report session is missing. Reopen Smart Report to continue.");
      const args = smartRequest(user.id, key, input);
      credit = { args, receipt: await checkWallet(args) };
    }

    const { report, detailFetchFailed } = await withGitHubCapacity("report", async () => {
      const signal = AbortSignal.any([request.signal, AbortSignal.timeout(smart ? 18_000 : 30_000)]);
      const repository = await getRepository(input.repository, signal);
      const activity = await getActivity(repository, input.contributor, input.range, signal);
      if (!activity.commits.length) {
        throw new AppError(422, "no_activity", `No matching commits found for this contributor and date range. Try different dates, check the username, or check activity on the default branch (${repository.branch}).`);
      }
      return { report: buildReport(repository, input.contributor, input.range, activity), detailFetchFailed: activity.detailFetchFailed };
    });

    if (!smart || !credit) return privateJson(report);
    if (detailFetchFailed && !credit.receipt) {
      return privateJson({ error: "Some GitHub evidence could not be loaded. Use Basic Report or try again.", code: "smart_evidence", fallback: report }, 502);
    }
    try {
      return privateJson(await generateSmart(report, credit.args, smart, request.signal, credit.receipt));
    } catch (error) {
      if (!(error instanceof AppError)) throw error;
      return privateJson({ error: error.message, code: error.code, fallback: report }, error.status);
    }
  } catch (error) {
    return errorResponse(error);
  }
}
