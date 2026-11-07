import type { APIRoute } from "astro";

export const GET: APIRoute = ({ site }) => {
  const base = site?.toString().replace(/\/$/, "") ?? "http://localhost:4321";
  const urls = [
    "/en/",
    "/de/",
    "/en/collections/home",
    "/de/collections/zuhause",
    "/en/pages/about",
    "/de/pages/about",
    "/en/pages/privacy",
    "/de/pages/privacy",
  ];
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url><loc>${base}${u}</loc><changefreq>weekly</changefreq></url>`,
  )
  .join("\n")}
</urlset>`;
  return new Response(body, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
};
