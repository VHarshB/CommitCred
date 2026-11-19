import { getActivity, getRepository } from "../../../../lib/github/activity";
import { withGitHubCapacity } from "../../../../lib/github/traffic";
import { generationSchema } from "../../../../lib/validation/input";
import { AppError, errorResponse, privateJson, readJson } from "../../../../lib/http";
import { buildReport } from "../../../../lib/report/basic";
import { smartEnabled } from "../../../../lib/ai/availability";
import { enhanceReport } from "../../../../lib/ai/smart";

export async function POST(request: Request) {
  try {
    const input = generationSchema.parse(await readJson(request));
    const origin = request.headers.get("origin");
    const sameOrigin = !origin || origin === new URL(request.url).origin;
    if (input.mode === "smart" && (!smartEnabled() || !sameOrigin)) {
      throw new AppError(503, "smart_unavailable", "Smart Report is unavailable. Generate a Basic Report instead.");
    }

    const report = await withGitHubCapacity("report", async () => {
      const signal = AbortSignal.any([request.signal, AbortSignal.timeout(30_000)]);
      const repository = await getRepository(input.repository, signal);
      const activity = await getActivity(repository, input.contributor, input.range, signal);
      if (!activity.commits.length) {
        throw new AppError(422, "no_activity", `No matching commits found for this contributor and date range. Try different dates, check the username, or check activity on the default branch (${repository.branch}).`);
      }
      return buildReport(repository, input.contributor, input.range, activity);
    });

    if (input.mode === "basic") return privateJson(report);
    try {
      return privateJson(await enhanceReport(report, request.signal));
    } catch (error) {
      if (!(error instanceof AppError)) throw error;
      return privateJson({ error: error.message, code: error.code, fallback: report }, error.status);
    }
  } catch (error) {
    return errorResponse(error);
  }
}
