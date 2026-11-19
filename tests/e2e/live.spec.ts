import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { recentRange } from "../../src/lib/validation/input";

for (const width of [390, 1440]) {
  test(`generates a report from a real public repository at ${width}px`, async ({ page, context, request }) => {
    await page.setViewportSize({ width, height: 900 });
    test.skip(process.env.COMMITCRED_LIVE_TEST !== "1", "Opt in to public GitHub requests.");
    const repository = "https://github.com/nodejs/node";
    const range = recentRange(7);
    const headers = { Accept: "application/vnd.github+json" };
    const response = await request.get(`https://api.github.com/repos/nodejs/node/commits?since=${range.start}T00:00:00Z&per_page=30`, { headers });
    expect(response.ok()).toBe(true);
    const commits = await response.json() as {
      author: { login: string } | null;
      parents: unknown[];
      commit: { author: { date: string } | null };
    }[];
    const candidate = commits.find((commit) =>
      commit.author && commit.parents.length === 1 &&
      commit.commit.author && commit.commit.author.date.slice(0, 10) >= range.start,
    );
    expect(candidate?.author?.login, "A recent attributed commit is required for this smoke test").toBeTruthy();

    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/");
    await page.getByLabel("GitHub repository").fill(repository);
    await page.getByRole("button", { name: "Load repo" }).click();
    const contributor = page.getByLabel("Contributor", { exact: true });
    await expect(contributor).toBeEnabled();
    await contributor.fill(candidate!.author!.login);
    const option = page.getByRole("button", { name: candidate!.author!.login, exact: true });
    if (await option.isVisible()) await option.click();
    await page.getByLabel("Time range").selectOption("7");
    await page.getByRole("radio", { name: /Basic Report/ }).check();
    await page.getByRole("button", { name: "Generate my report" }).click();
    await expect(page.getByRole("heading", { name: "Your Sprint Recap" })).toBeVisible({ timeout: 35_000 });

    const evidence = page.getByRole("link", { name: /Open commit/ }).first();
    const url = await evidence.getAttribute("href");
    expect(url).toMatch(/^https:\/\/github\.com\/nodejs\/node\/commit\/[a-f0-9]{40}$/);
    const popupEvent = page.waitForEvent("popup");
    await evidence.click();
    const popup = await popupEvent;
    await popup.waitForURL(url!);
    await popup.close();

    await page.getByLabel("Accomplishment 1", { exact: true }).fill("Reviewed source history");
    await page.getByLabel("Challenges & blockers").fill("Waiting for review");
    await page.getByLabel("Next steps").fill("Update the docs");
    await page.getByRole("button", { name: "Copy report" }).click();
    await expect(page.getByText("Markdown copied.")).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(url);
    const downloadEvent = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download Markdown" }).click();
    const download = await downloadEvent;
    const output = await readFile((await download.path())!, "utf8");
    for (const value of ["Reviewed source history", "Waiting for review", "Update the docs", url!]) {
      expect(output).toContain(value);
    }
  });
}
