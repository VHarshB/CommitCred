import { getContributors, getRepository } from "../../../../lib/github/activity";
import { withGitHubCapacity } from "../../../../lib/github/traffic";
import { repositorySchema } from "../../../../lib/validation/input";
import { AppError, errorResponse, privateJson } from "../../../../lib/http";

export async function GET(request: Request) {
  try {
    const input = repositorySchema.parse(new URL(request.url).searchParams.get("url") ?? "");
    return await withGitHubCapacity("repository", async () => {
      const signal = AbortSignal.any([request.signal, AbortSignal.timeout(20_000)]);
      const repository = await getRepository(input, signal);
      try {
        return privateJson({ repository, ...(await getContributors(repository, signal)) });
      } catch (error) {
        if (error instanceof AppError && error.code === "github_limit") throw error;
        return privateJson({ repository, contributors: [], partial: true });
      }
    });
  } catch (error) {
    return errorResponse(error);
  }
}
