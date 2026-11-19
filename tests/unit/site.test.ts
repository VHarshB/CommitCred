import { afterEach, describe, expect, it, vi } from "vitest";
import robots from "../../src/app/robots";
import sitemap from "../../src/app/sitemap";
import { homeStructuredData, pageMetadata, serializeJsonLd, siteOrigin } from "../../src/lib/seo/site";

const origin = "https://commitcred-ci-fixture.dev";
afterEach(() => vi.unstubAllEnvs());

describe("SEO application origin", () => {
  it.each([
    "", "http://commitcred.dev", "https://localhost", "https://app.example.com",
    "https://127.0.0.1", "https://commitcred.dev/api", "https://user@commitcred.dev",
    "https://commitcred.dev?foo=bar", "https://commitcred.dev#", "https://commitcred.dev:8080",
  ])("rejects %j", (value) => {
    expect(siteOrigin(value)).toBeUndefined();
  });

  it("omits canonical URLs and prevents indexing when no public origin is set", () => {
    vi.stubEnv("SITE_URL", "");
    expect(pageMetadata("/", "Home", "Description")).toMatchObject({ robots: { index: false } });
    expect(pageMetadata("/", "Home", "Description")).not.toHaveProperty("alternates");
    expect(sitemap()).toEqual([]);
    expect(robots()).not.toHaveProperty("sitemap");
  });

  it("uses the exact configured production origin and exposes only public pages", () => {
    vi.stubEnv("SITE_URL", origin);
    expect(pageMetadata("/privacy", "Privacy", "Description")).toMatchObject({
      alternates: { canonical: `${origin}/privacy` }, robots: { index: true, follow: true },
      openGraph: { images: [{ url: `${origin}/opengraph-image` }] },
    });
    expect(sitemap().map(({ url }) => url)).toEqual([
      `${origin}/`, `${origin}/examples/sprint-report`, `${origin}/guides/github-contribution-report`,
      `${origin}/guides/how-to-write-a-sprint-report`, `${origin}/privacy`,
    ]);
    expect(robots()).toEqual({ rules: { userAgent: "*", allow: "/", disallow: ["/api/"] }, sitemap: `${origin}/sitemap.xml` });
  });

  it("serializes data without introducing HTML script boundaries", () => {
    const data = homeStructuredData(new URL(origin));
    data["@graph"][0].description = "</script>";
    const serialized = serializeJsonLd(data);
    expect(serialized).not.toContain("<");
    expect(JSON.parse(serialized)).toEqual(data);
  });
});
