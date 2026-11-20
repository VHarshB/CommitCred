import { expect, test } from "@playwright/test";
import { exampleReport } from "../../src/lib/report/example";

for (const width of [375, 390, 1440]) {
  test(`Smart consent, guest balance, and Google handoff at ${width}px`, async ({ page }) => {
    test.skip(process.env.COMMITCRED_SMART_UI_TEST !== "1", "Opt in to isolated Smart UI fixtures.");
    await page.setViewportSize({ width, height: 850 });
    const report = { ...exampleReport(), mode: "smart" };
    let guest = false;
    let remaining = 3;
    await page.route("**/api/ai/status", (route) => route.fulfill({ json: {
      enabled: true, session: guest ? "guest" : "none", totalRemaining: remaining, guestRemaining: guest ? remaining : undefined, consented: guest, siteKey: "fixture",
    } }));
    await page.route("https://challenges.cloudflare.com/turnstile/**", (route) =>
      route.fulfill({ contentType: "application/javascript", body: "window.turnstile={render:(element,config)=>{config.callback('fixture-challenge');return 'widget'},remove:()=>{}}" }));
    await page.route("**/api/ai/session", (route) => {
      const data = route.request().postDataJSON();
      if (data.action === "google") {
        expect(data.intent).toBe("link");
        return route.fulfill({ json: { redirect: "https://fixture.supabase.co/auth/v1/authorize?provider=google" } });
      }
      expect(data).toMatchObject({ action: "consent", adult: true, eligible: true, privacy: true, captcha: "fixture-challenge" });
      guest = true;
      return route.fulfill({ json: { ok: true } });
    });
    await page.route("https://fixture.supabase.co/auth/v1/authorize?*", (route) =>
      route.fulfill({ contentType: "text/html", body: "<h1>OAuth fixture</h1>" }));
    await page.route("**/api/github/repository?*", (route) => route.fulfill({ json: { repository: {
      ...report.repository, url: "https://github.com/sample-team/campus-planner",
    }, contributors: [], partial: false } }));

    await page.route("**/api/report/generate", (route) => {
      expect(guest).toBe(true);
      expect(route.request().headers()["idempotency-key"]).toMatch(/^[a-f0-9-]{36}$/);
      remaining--;
      return route.fulfill({ json: report });
    });
    async function fill() {
      const response = await page.goto("/");
      const csp = response?.headers()["content-security-policy"] ?? "";
      expect(csp).toContain("frame-src https://challenges.cloudflare.com");
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).not.toContain("connect-src *");
      expect(await response?.text()).not.toMatch(/(?:sb_secret|gemini)_browser_test_sentinel/);
      await page.getByLabel("GitHub repository").fill("https://github.com/sample-team/campus-planner");
      await page.getByRole("button", { name: "Load repo" }).click();
      await page.getByLabel("Contributor", { exact: true }).fill("sample-developer");
      await page.getByRole("radio", { name: /Smart Report/ }).check();
    }

    await fill();
    await expect(page.getByText("3 Smart Report credits for a new guest")).toBeVisible();
    await page.getByRole("button", { name: "Generate my report" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Agree and continue" })).toBeDisabled();
    await dialog.getByRole("checkbox", { name: /18 or older/ }).check();
    await dialog.getByRole("checkbox", { name: /agree to send/ }).check();
    await dialog.getByRole("button", { name: "Agree and continue" }).click();
    await expect(page.getByRole("heading", { name: "Your Sprint Recap" })).toBeVisible();
    await page.getByLabel("Accomplishment 1", { exact: true }).fill("Edited Smart accomplishment");
    await fill();
    await expect(page.getByText("2 Smart Report credits remaining")).toBeVisible();

    remaining = 0;
    await fill();
    await page.getByRole("button", { name: "Generate my report" }).click();
    await expect(dialog.getByRole("heading")).toHaveText("You’ve used your 3 free AI reports");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await page.getByRole("button", { name: "Generate my report" }).click();
    await dialog.getByRole("button", { name: /Continue with Google/ }).click();
    await expect(page.getByRole("heading", { name: "OAuth fixture" })).toBeVisible();
  });
}
