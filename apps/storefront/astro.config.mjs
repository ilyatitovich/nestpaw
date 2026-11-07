import react from "@astrojs/react";
import { defineConfig } from "astro/config";

export default defineConfig({
  site: process.env.PUBLIC_STORE_URL ?? "http://localhost:4321",
  integrations: [react()],
  i18n: {
    defaultLocale: "en",
    locales: ["en", "de"],
    routing: {
      prefixDefaultLocale: true,
    },
  },
  output: "static",
  vite: {
    ssr: {
      noExternal: ["@online-store/api-client", "@online-store/shared-types"],
    },
  },
});
