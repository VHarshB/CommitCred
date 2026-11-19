import type { Metadata } from "next";

export const siteName = "CommitCred";
export const siteTitle = "CommitCred — Your Commits. Your Credit.";
export const siteDescription = "Turn your public GitHub contributions into editable sprint reports with source-linked evidence. Free, with no sign-up.";
export const socialImage = "/opengraph-image";
export const indexablePaths = [
  "/",
  "/examples/sprint-report",
  "/guides/github-contribution-report",
  "/guides/how-to-write-a-sprint-report",
  "/privacy",
] as const;

type IndexablePath = typeof indexablePaths[number];

export function siteOrigin(value = process.env.SITE_URL): URL | undefined {
  if (!value || !/^https:\/\/[a-z0-9.-]+\/?$/i.test(value.trim())) return;
  try {
    const url = new URL(value.trim());
    const domain = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;
    const reserved = /(?:^|\.)(?:localhost|local|example|test|invalid|example\.com|example\.net|example\.org)$/i;
    if (
      url.protocol !== "https:" || url.port || url.username || url.password ||
      url.pathname !== "/" ||
      !domain.test(url.hostname) || reserved.test(url.hostname)
    ) return;
    return new URL(url.origin);
  } catch {
    return;
  }
}

export function pageMetadata(path: IndexablePath, title: string, description: string): Metadata {
  const origin = siteOrigin();
  const canonical = origin ? new URL(path, origin).href : undefined;
  const image = origin ? new URL(socialImage, origin).href : undefined;
  const verification = path === "/" && origin ? process.env.GOOGLE_SITE_VERIFICATION : undefined;
  const shareTitle = path === "/" ? title : `${title} | ${siteName}`;

  return {
    title: path === "/" ? { absolute: title } : title,
    description,
    ...(origin ? { metadataBase: origin, alternates: { canonical } } : {}),
    ...(verification && /^[a-z0-9_-]{8,200}$/i.test(verification) ? { verification: { google: verification } } : {}),
    robots: { index: Boolean(origin), follow: true },
    openGraph: {
      type: "website", siteName, title: shareTitle, description, url: canonical,
      ...(image ? { images: [{ url: image, width: 1200, height: 630, alt: "CommitCred. Your commits. Your credit." }] } : {}),
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title: shareTitle, description,
      ...(image ? { images: [image] } : {}),
    },
  };
}

export function homeStructuredData(origin: URL) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "WebSite", name: siteName, url: origin.href, description: siteDescription },
      {
        "@type": "WebApplication", name: siteName, url: origin.href, description: siteDescription,
        applicationCategory: "DeveloperApplication", operatingSystem: "Any",
        browserRequirements: "Requires JavaScript", isAccessibleForFree: true,
        offers: { "@type": "Offer", price: 0 },
      },
    ],
  };
}

export function serializeJsonLd(data: ReturnType<typeof homeStructuredData>) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
