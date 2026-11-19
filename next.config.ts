import type { NextConfig } from "next";
import { netlifyBuildOrigin } from "./src/lib/seo/netlify-origin";

const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' https://avatars.githubusercontent.com",
  "object-src 'none'",
  "base-uri 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
].join("; ");

const netlifyOrigin = netlifyBuildOrigin(process.env);

const config: NextConfig = {
  ...(netlifyOrigin !== undefined ? { env: { COMMITCRED_NETLIFY_ORIGIN: netlifyOrigin } } : {}),
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          ...(process.env.NODE_ENV === "production" ? [
            { key: "Content-Security-Policy", value: contentSecurityPolicy },
            { key: "Strict-Transport-Security", value: "max-age=31536000" },
          ] : []),
        ],
      },
      {
        source: "/api/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store" },
          { key: "X-Robots-Tag", value: "noindex" },
        ],
      },
      {
        source: "/report",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default config;
