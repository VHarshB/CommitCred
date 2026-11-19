export function netlifyBuildOrigin(env: Readonly<Record<string, string | undefined>>): string | undefined {
  if (env.NETLIFY !== "true") return;
  // Netlify's URL identifies the primary site, even in other deploy contexts.
  // Explicitly omit it from branch and preview builds.
  if (env.CONTEXT !== "production") return "";
  return env.SITE_URL?.trim() || env.URL?.trim() || "";
}
