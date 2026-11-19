import assert from "node:assert/strict";

const base = new URL(process.argv[2] ?? "http://127.0.0.1:8080");
const originValue = process.env.COMMITCRED_EXPECTED_ORIGIN;
const origin = originValue ? new URL(originValue) : null;
const pages = [
  "/", "/privacy", "/examples/sprint-report",
  "/guides/github-contribution-report", "/guides/how-to-write-a-sprint-report",
];

async function check(path, status = 200, init = {}) {
  const response = await fetch(new URL(path, base), {
    ...init, signal: AbortSignal.timeout(15_000), redirect: "error",
  });
  assert.equal(response.status, status, path);
  console.log(`${response.status} ${new URL(path, base).href}`);
  return response;
}

function assertNoStore(response) {
  assert.match(response.headers.get("cache-control") ?? "", /\bno-store\b/);
}

let home;
for (const path of pages) {
  const response = await check(path, 200, { headers: { "User-Agent": "Googlebot" } });
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.match(response.headers.get("content-security-policy") ?? "", /frame-ancestors 'none'/);
  const html = await response.text();
  assert.equal((html.match(/<h1(?:\s|>)/g) ?? []).length, 1, path);
  if (path === "/") home = html;
  if (origin) {
    const canonical = html.match(/rel="canonical" href="([^"]+)"/)?.[1];
    assert.ok(canonical, path);
    assert.equal(new URL(canonical).href, new URL(path, origin).href, path);
    assert.ok(html.includes(`property="og:image" content="${new URL("/opengraph-image", origin).href}"`), path);
    assert.ok(html.includes('name="twitter:card" content="summary_large_image"'), path);
  } else {
    assert.doesNotMatch(html, /rel="canonical"/);
    assert.match(html, /name="robots" content="noindex/);
  }
}

assert.ok(home.includes("/guides/github-contribution-report"));
const jsonLd = home.match(/<script type="application\/ld\+json">(.*?)<\/script>/s);
if (origin) {
  assert.ok(jsonLd);
  const data = JSON.parse(jsonLd[1]);
  assert.equal(data["@context"], "https://schema.org");
  assert.deepEqual(data["@graph"].map(({ "@type": type }) => type), ["WebSite", "WebApplication"]);
  assert.ok(data["@graph"].every(({ url }) => url === origin.href));
  assert.equal(data["@graph"][1].offers.price, 0);
} else {
  assert.equal(jsonLd, null);
}

const css = home.match(/href="(\/_next\/static\/[^"]+\.css)"/)?.[1];
assert.ok(css, "The home page references built CSS");
assert.match((await check(css)).headers.get("content-type") ?? "", /^text\/css/);
await check("/icon.svg");

const social = await check("/opengraph-image");
assert.match(social.headers.get("content-type") ?? "", /^image\/png/);
const png = Buffer.from(await social.arrayBuffer());
assert.equal(png.toString("hex", 0, 8), "89504e470d0a1a0a");
assert.equal(png.readUInt32BE(16), 1200);
assert.equal(png.readUInt32BE(20), 630);

const robots = await (await check("/robots.txt")).text();
assert.match(robots, /Disallow: \/api\//);
assert.doesNotMatch(robots, /Disallow: \/report/);
const sitemapResponse = await check("/sitemap.xml");
assert.match(sitemapResponse.headers.get("content-type") ?? "", /xml/);
const sitemap = await sitemapResponse.text();
assert.match(sitemap, /<urlset[^>]*xmlns="http:\/\/www.sitemaps.org\/schemas\/sitemap\/0.9"/);
const locations = Array.from(sitemap.matchAll(/<loc>([^<]+)<\/loc>/g), (match) => match[1]).sort();
if (origin) {
  assert.ok(robots.includes(`Sitemap: ${new URL("/sitemap.xml", origin).href}`));
  assert.deepEqual(locations, pages.map((path) => new URL(path, origin).href).sort());
} else {
  assert.doesNotMatch(robots, /Sitemap:/);
  assert.deepEqual(locations, []);
}

const report = await check("/report");
assert.match(report.headers.get("x-robots-tag") ?? "", /noindex/);
assert.match(await report.text(), /name="robots" content="noindex, nofollow"/);
const health = await check("/api/health");
assertNoStore(health);
assert.deepEqual(await health.json(), { status: "ok" });

assertNoStore(await check("/api/github/repository?url=https%3A%2F%2Fgit.invalid%2Fteam%2Fproject", 400));
const post = (body) => ({ method: "POST", headers: { "Content-Type": "application/json" }, body });
assertNoStore(await check("/api/report/generate", 400, post("{")));
assertNoStore(await check("/api/report/generate", 413, post(JSON.stringify("x".repeat(5000)))));
const date = new Date().toISOString().slice(0, 10);
const smart = await check("/api/report/generate", 503, post(JSON.stringify({
  repository: "https://github.com/nodejs/node", contributor: "developer",
  range: { start: date, end: date }, mode: "smart",
})));
assertNoStore(smart);
assert.equal((await smart.json()).code, "smart_unavailable");
console.log("Production smoke passed.");
