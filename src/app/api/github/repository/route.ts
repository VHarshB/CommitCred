import { getContributors, getRepository } from "../../../../lib/github/activity";
import { repositorySchema } from "../../../../lib/validation/input";
import { errorResponse } from "../../../../lib/http";

export async function GET(request: Request) {
  try {
    const input = repositorySchema.parse(new URL(request.url).searchParams.get("url") ?? "");
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(20_000)]);
    const repository = await getRepository(input, signal);
    try {
      return Response.json({ repository, ...(await getContributors(repository, signal)) });
    } catch {
      return Response.json({ repository, contributors: [], partial: true });
    }
  } catch (error) {
    return errorResponse(error);
  }
}
