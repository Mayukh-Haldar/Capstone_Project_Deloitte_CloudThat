export const SITE_URL = process.env.SITE_URL || process.env.VITE_SITE_URL || "http://localhost";

// Only include canonical public routes here. Authenticated and parameterized pages
// should be added only when you have stable, crawlable URLs to publish.
export const sitemapRoutes = [
  {
    path: "/",
    changefreq: "weekly",
    priority: "1.0",
  },
  {
    path: "/events",
    changefreq: "daily",
    priority: "0.9",
  },
];
