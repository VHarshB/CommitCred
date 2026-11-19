import { expect, it } from "vitest";
import { withGitHubCapacity } from "../../src/lib/github/traffic";

it("rejects excess report concurrency and releases capacity after failure", async () => {
  const request = Promise.withResolvers<never>();
  const attempts = Array.from({ length: 3 }, () => withGitHubCapacity("report", () => request.promise));
  const settled = Promise.allSettled(attempts);
  await expect(withGitHubCapacity("report", async () => "unreachable")).rejects.toMatchObject({ code: "busy" });
  request.reject(new Error("upstream error"));
  expect((await settled).every(({ status }) => status === "rejected")).toBe(true);
  await expect(withGitHubCapacity("report", async () => "available")).resolves.toBe("available");
});
