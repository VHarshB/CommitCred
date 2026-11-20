import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { exampleReport } from "../../src/lib/report/example";

for (const width of [375, 390, 768, 1440]) {
  test(`generates and edits a report at ${width}px`, async ({ page, context }) => {
    const report = exampleReport();
    report.sample = false;
    report.repository = { owner: "team", name: "project", branch: "main", description: null, url: "https://github.com/team/project" };
    report.contributor = "developer";
    report.coverageWarnings = [];
    report.evidenceLinks.forEach((item) => { item.url = `${report.repository.url}/commit/${item.sha}`; });
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.setViewportSize({ width, height: 900 });
    await page.route("**/api/github/repository?*", async (route) => {
      await expect(page.getByText("Loading repository and contributors…")).toBeVisible();
      await route.fulfill({ json: { repository: report.repository, contributors: [{ login: report.contributor, avatar: "" }], partial: false } });
    });
    await page.route("**/api/report/generate", async (route) => {
      expect(route.request().postDataJSON()).toMatchObject({ contributor: "developer", mode: "basic", range: report.dateRange });
      await route.fulfill({ json: report });
    });
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Generate my report" })).toBeDisabled();
    await page.getByRole("button", { name: "Load repo" }).click();
    await expect(page.locator("main").getByRole("alert")).toContainText("Enter a public repository URL");
    await page.getByLabel("GitHub repository").fill(report.repository.url);
    await page.getByRole("button", { name: "Load repo" }).click();
    const contributor = page.getByLabel("Contributor", { exact: true });
    await expect(contributor).toBeEnabled();
    await contributor.focus();
    await page.getByRole("button", { name: "developer", exact: true }).click();
    await page.getByLabel("Time range").selectOption("7");
    await page.getByRole("button", { name: "Generate my report" }).click();
    await expect(page.getByRole("heading", { name: "Your Sprint Recap" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Open commit 0000000 on GitHub" })).toHaveCount(report.evidenceLinks.length);
    await page.getByLabel("Accomplishment 1", { exact: true }).fill("Edited statement");
    await page.getByLabel("Challenges & blockers").fill("Waiting for review");
    await page.getByLabel("Next steps").fill("Update the docs");
    await page.reload();
    await expect(page.getByLabel("Accomplishment 1", { exact: true })).toHaveValue("Edited statement");
    await page.getByRole("button", { name: "Copy report" }).click();
    await expect(page.getByText("Markdown copied.")).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain("Edited statement");
    for (const [name, extension] of [["Download Markdown", ".md"], ["Download TXT", ".txt"]]) {
      const event = page.waitForEvent("download");
      await page.getByRole("button", { name }).click();
      const download = await event;
      expect(download.suggestedFilename()).toMatch(new RegExp(extension.replace(".", "\\.") + "$"));
      const output = await readFile((await download.path())!, "utf8");
      expect(output).toContain("Waiting for review");
      expect(output).toContain("Update the docs");
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
  });
}

test("example mode requires no GitHub request and identifies sample data", async ({ page }) => {
  await page.route(/\/api\/(github\/|report\/generate)/, () => { throw new Error("Example mode must use its own data"); });
  await page.goto("/");
  await page.getByRole("button", { name: "Try an example" }).click();
  await expect(page.getByText("SAMPLE DATA", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Add accomplishment" }).click();
  await expect(page.getByText("User added")).toBeVisible();
});

test("handles rate limits, contributor discovery failure and an empty report", async ({ page }) => {
  const repository = { owner: "team", name: "project", branch: "main", description: null, url: "https://github.com/team/project" };
  let limited = true;
  await page.route("**/api/github/repository?*", async (route) => {
    if (limited) {
      limited = false;
      await route.fulfill({ status: 429, json: { error: "GitHub is limiting requests right now. Wait a few minutes, then try again." } });
      return;
    }
    await route.fulfill({ json: { repository, contributors: [], partial: true } });
  });
  await page.route("**/api/report/generate", async (route) => {
    expect(route.request().postDataJSON()).toMatchObject({ contributor: "manual-user", mode: "basic" });
    await route.fulfill({ status: 422, json: { error: "No matching commits found for this contributor and date range." } });
  });
  await page.goto("/");
  await page.getByLabel("GitHub repository").fill(repository.url);
  await page.getByRole("button", { name: "Load repo" }).click();
  const alert = page.locator("main").getByRole("alert");
  await expect(alert).toContainText("GitHub is limiting requests");
  await page.getByRole("button", { name: "Load repo" }).click();
  const contributor = page.getByLabel("Contributor", { exact: true });
  await expect(contributor).toBeEnabled();
  await contributor.fill("manual-user");
  await page.getByRole("button", { name: "Generate my report" }).click();
  await expect(alert).toContainText("No matching commits");
  await expect(page.getByRole("button", { name: "Generate my report" })).toBeEnabled();
});
