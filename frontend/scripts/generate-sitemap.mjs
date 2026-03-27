import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { SITE_URL, sitemapRoutes } from "../src/app/seo/sitemap-routes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const publicDir = path.join(projectRoot, "public");
const sitemapPath = path.join(publicDir, "sitemap.xml");
const envPath = path.join(projectRoot, ".env");

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  return Object.fromEntries(
    fs
      .readFileSync(filePath, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const separatorIndex = line.indexOf("=");
        const key = line.slice(0, separatorIndex).trim();
        const value = line.slice(separatorIndex + 1).trim();
        return [key, value];
      }),
  );
}

const fileEnv = readEnvFile(envPath);
const resolvedSiteUrl = process.env.SITE_URL
  || process.env.VITE_SITE_URL
  || fileEnv.VITE_SITE_URL
  || SITE_URL
  || "http://localhost:5173";
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
