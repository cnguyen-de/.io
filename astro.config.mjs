import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";

// https://astro.build/config
export default defineConfig({
  site: "https://may-solutions.io",
  integrations: [sitemap({ i18n: { defaultLocale: "en", locales: { en: "en-US", de: "de-DE" } } })],
  vite: {
    plugins: [tailwindcss()],
    // The city model (three.js plus map data) is one lazily loaded chunk of about 180 kB gzipped.
    build: { chunkSizeWarningLimit: 800 },
  },
});
