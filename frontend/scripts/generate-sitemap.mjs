import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { SITE_URL, sitemapRoutes } from "../src/app/seo/sitemap-routes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const publicDir = path.join(projectRoot, "public");
const sitemapPath = path.join(publicDir, "sitemap.xml");

// VITE_SITE_URL is injected at build time via Docker build-arg (from the vault-managed
// VITE_SITE_URL process env var set by start-local-vault.ps1 / start-local.ps1).
const resolvedSiteUrl = process.env.SITE_URL
  || process.env.VITE_SITE_URL
  || SITE_URL
  || "http://localhost";
const normalizedSiteUrl = resolvedSiteUrl.replace(/\/+$/, "");
const lastmod = new Date().toISOString().slice(0, 10);

const xml = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...sitemapRoutes.map(({ path: routePath, changefreq, priority }) => {
    const loc = routePath === "/" ? normalizedSiteUrl : `${normalizedSiteUrl}${routePath}`;
    return [
      "  <url>",
      `    <loc>${loc}</loc>`,
      `    <lastmod>${lastmod}</lastmod>`,
      `    <changefreq>${changefreq}</changefreq>`,
      `    <priority>${priority}</priority>`,
      "  </url>",
    ].join("\n");
  }),
  "</urlset>",
  "",
].join("\n");

fs.mkdirSync(publicDir, { recursive: true });
fs.writeFileSync(sitemapPath, xml, "utf8");

console.log(`Generated sitemap at ${path.relative(projectRoot, sitemapPath)}`);
