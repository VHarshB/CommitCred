import { getActivity, getRepository } from "../../../../lib/github/activity";
import { generationSchema } from "../../../../lib/validation/input";
import { AppError, errorResponse, readJson } from "../../../../lib/http";
import { buildReport } from "../../../../lib/report/basic";
import { reserveSmartRequest, smartEnabled } from "../../../../lib/ai/budget";
import { enhanceReport } from "../../../../lib/ai/smart";

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const input = generationSchema.parse(await readJson(request));
    if (input.mode === "smart" && !smartEnabled()) {
      throw new AppError(503, "smart_unavailable", "Smart Report is unavailable. Generate a Basic Report instead.");
    }
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(30_000)]);
    const repository = await getRepository(input.repository, signal);
    const activity = await getActivity(repository, input.contributor, input.range, signal);
    if (!activity.commits.length) {
      throw new AppError(422, "no_activity", `No matching commits found for this contributor and date range. Try different dates, check the username, or check activity on the default branch (${repository.branch}).`);
    }
    const report = buildReport(repository, input.contributor, input.range, activity);
    if (input.mode === "basic") return Response.json(report, { headers: { "Cache-Control": "no-store" } });

    try {
      await reserveSmartRequest(request, signal);
      return Response.json(await enhanceReport(report, signal), { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      if (!(error instanceof AppError)) throw error;
      return Response.json({ error: error.message, code: error.code, fallback: report }, {
        status: error.status, headers: { "Cache-Control": "no-store" },
      });
    }
  } catch (error) {
    return errorResponse(error);
  }
}
