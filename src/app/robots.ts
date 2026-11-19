import type { MetadataRoute } from "next";
import { siteOrigin } from "../lib/seo/site";

export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  const origin = siteOrigin();
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/"] },
    ...(origin ? { sitemap: new URL("/sitemap.xml", origin).href } : {}),
  };
}
