import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { expect, test } from "@playwright/test";

const exec = promisify(execFile);

test("verifies the App Runner production HTTP surface", async ({ baseURL }) => {
  test.skip(process.env.COMMITCRED_PRODUCTION_TEST !== "1", "Run against the AWS production start command.");
  const { stdout } = await exec(process.execPath, ["scripts/smoke-production.mjs", baseURL!]);
  console.log(stdout.trim());
  expect(stdout).toContain("Production smoke passed.");
});

test("opens the worked example by keyboard in a touch viewport", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });
  try {
    const page = await context.newPage();
    await page.goto(`${baseURL}/examples/sprint-report`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
    const sample = page.getByRole("button", { name: "Open editable sample" });
    await sample.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByText("SAMPLE DATA", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Add accomplishment" }).tap();
    await expect(page.getByText("User added", { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(375);
  } finally {
    await context.close();
  }
});
