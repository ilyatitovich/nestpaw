import type { APIRoute } from "astro";

const API = import.meta.env.PUBLIC_API_URL ?? "http://localhost:3001";

export const GET: APIRoute = async ({ site }) => {
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

  try {
    const res = await fetch(`${API}/products?take=200`);
    if (res.ok) {
      const body = (await res.json()) as {
        items?: {
          translations?: { locale: string; slug: string }[];
        }[];
      };
      for (const product of body.items ?? []) {
        for (const t of product.translations ?? []) {
          if (t.locale && t.slug) {
            urls.push(`/${t.locale}/products/${t.slug}`);
          }
        }
      }
    }
  } catch {
    // build/runtime without API — keep static URLs only
  }

  const unique = [...new Set(urls)];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${unique
  .map(
    (u) => `  <url><loc>${base}${u}</loc><changefreq>weekly</changefreq></url>`,
  )
  .join("\n")}
</urlset>`;
  return new Response(xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
};
