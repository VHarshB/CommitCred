import { AppError } from "../http";

const limits = { repository: 6, report: 3 };
const active = { repository: 0, report: 0 };

type Operation = keyof typeof limits;

// This is an instance-level load shedder. Distributed request quotas belong
// at the AWS edge. Requests are refused rather than queued under pressure.
export async function withGitHubCapacity<T>(operation: Operation, task: () => Promise<T>): Promise<T> {
  if (active[operation] >= limits[operation]) {
    throw new AppError(503, "busy", "CommitCred is busy. Please try again in a few seconds.");
  }
  active[operation]++;
  try {
    return await task();
  } finally {
    active[operation]--;
  }
}
