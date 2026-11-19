import { AppError } from "../http";

export async function github<T>(path: string, signal: AbortSignal): Promise<{ data: T; more: boolean }> {
  const headers = new Headers({ Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" });
  if (process.env.GITHUB_TOKEN) headers.set("Authorization", `Bearer ${process.env.GITHUB_TOKEN}`);
  const timeout = AbortSignal.any([signal, AbortSignal.timeout(8_000)]);
  let response: Response;
  try {
    response = await fetch(`https://api.github.com${path}`, { headers, signal: timeout, redirect: "error", cache: "no-store" });
  } catch {
    if (timeout.aborted) throw new AppError(504, "timeout", "GitHub took too long to respond. Try again or choose a shorter date range.");
    throw new AppError(502, "github_unavailable", "GitHub could not be reached. Try again shortly.");
  }

  if (response.status === 429 || (response.status === 403 && (
    response.headers.get("x-ratelimit-remaining") === "0" || response.headers.has("retry-after")
  ))) {
    throw new AppError(429, "github_limit", "GitHub is limiting requests right now. Wait a few minutes, then try again.");
  }
  if ([403, 404, 451].includes(response.status)) {
    throw new AppError(404, "repository_unavailable", "GitHub could not find or access this resource. Check that the repository is public and the URL is correct.");
  }
  if (!response.ok) throw new AppError(response.status === 409 ? 409 : 502, "github_unavailable", "GitHub could not provide this activity. Check the repository or try again shortly.");
  if (response.status === 204) return { data: [] as T, more: false };
  return { data: await response.json() as T, more: /rel="next"/.test(response.headers.get("link") ?? "") };
}
