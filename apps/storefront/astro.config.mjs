import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import { defineConfig } from "astro/config";

export default defineConfig({
  site: process.env.PUBLIC_STORE_URL ?? "http://localhost:4321",
  integrations: [
    react(),
    sitemap({
      i18n: {
        defaultLocale: "en",
        locales: {
          en: "en-US",
          de: "de-DE",
        },
      },
      filter: (page) =>
        !page.includes("/cart") &&
        !page.includes("/account") &&
        !page.includes("/checkout"),
    }),
  ],
  i18n: {
    defaultLocale: "en",
    locales: ["en", "de"],
    routing: {
      prefixDefaultLocale: false,
    },
  },
  output: "static",
  vite: {
    ssr: {
      noExternal: ["@online-store/api-client", "@online-store/shared-types"],
    },
  },
});
