import { defineConfig } from "@playwright/test";

const production = process.env.COMMITCRED_PRODUCTION_TEST === "1";
const smartFixture = process.env.COMMITCRED_SMART_UI_TEST === "1";
const external = process.env.COMMITCRED_BASE_URL;
const baseURL = external || (production ? "http://127.0.0.1:8080" : "http://127.0.0.1:3110");

export default defineConfig({
  testDir: "./tests/e2e",
  workers: 1,
  use: {
    baseURL,
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
  },
  webServer: external ? undefined : {
    command: production ? "npm start" : "npm run dev -- --port 3110",
    url: `${baseURL}/api/health`,
    timeout: 60_000,
    env: {
      SITE_URL: production ? (process.env.COMMITCRED_EXPECTED_ORIGIN ?? "") : "",
      AI_PUBLIC_ENABLED: smartFixture ? "true" : "false",
      ...(smartFixture ? {
        AI_ALLOWED_ORIGIN: process.env.COMMITCRED_EXPECTED_ORIGIN ?? "",
        AI_FREE_TIER_CONFIRMED: "true",
        AI_PUBLIC_ELIGIBILITY_VERIFIED: "true",
        AI_SECURITY_SECRET: "local-fixture-not-a-production-secret",
        NEXT_PUBLIC_SUPABASE_URL: "https://fixture.supabase.co",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture",
        SUPABASE_SECRET_KEY: "sb_secret_browser_test_sentinel",
        GEMINI_API_KEY: "gemini_browser_test_sentinel",
        GEMINI_MODEL: "gemini-fixture",
        TURNSTILE_SITE_KEY: "fixture",
      } : {}),
    },
  },
});
