import { defineConfig } from "@playwright/test";

const production = process.env.COMMITCRED_PRODUCTION_TEST === "1";
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
      AI_LOCAL_ENABLED: "false",
    },
  },
});
