import type { MetadataRoute } from "next";
import { indexablePaths, siteOrigin } from "../lib/seo/site";

export const dynamic = "force-dynamic";

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = siteOrigin();
  return origin ? indexablePaths.map((path) => ({ url: new URL(path, origin).href })) : [];
}
