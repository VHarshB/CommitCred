import { afterEach, describe, expect, it, vi } from "vitest";
import { netlifyBuildOrigin } from "../../src/lib/seo/netlify-origin";
import { pageMetadata } from "../../src/lib/seo/site";

const assignedUrl = "https://commitcred-fixture.netlify.app";

afterEach(() => vi.unstubAllEnvs());

describe("Netlify canonical origin", () => {
  it("uses the platform's actual primary URL for a production build", () => {
    expect(netlifyBuildOrigin({ NETLIFY: "true", CONTEXT: "production", URL: assignedUrl })).toBe(assignedUrl);
  });

  it("allows a deliberate SITE_URL override and falls back when it is blank", () => {
    const env = { NETLIFY: "true", CONTEXT: "production", URL: assignedUrl };
    expect(netlifyBuildOrigin({ ...env, SITE_URL: " https://commitcred-fixture.dev " })).toBe("https://commitcred-fixture.dev");
    expect(netlifyBuildOrigin({ ...env, SITE_URL: " " })).toBe(assignedUrl);
  });

  it.each(["deploy-preview", "branch-deploy", "dev", undefined])("suppresses canonical origin for %s", (context) => {
    expect(netlifyBuildOrigin({ NETLIFY: "true", CONTEXT: context, SITE_URL: assignedUrl, URL: assignedUrl })).toBe("");
  });

  it("preserves the runtime origin setting for normal local builds", () => {
    expect(netlifyBuildOrigin({ SITE_URL: assignedUrl })).toBeUndefined();
    vi.stubEnv("SITE_URL", assignedUrl);
    expect(pageMetadata("/privacy", "Privacy", "Description").alternates).toEqual({ canonical: `${assignedUrl}/privacy` });
  });

  it("does not fall through to a runtime SITE_URL on preview builds", () => {
    vi.stubEnv("SITE_URL", assignedUrl);
    vi.stubEnv("COMMITCRED_NETLIFY_ORIGIN", "");
    const metadata = pageMetadata("/", "Home", "Description");
    expect(metadata.alternates).toBeUndefined();
    expect(metadata.robots).toEqual({ index: false, follow: true });
  });
});
