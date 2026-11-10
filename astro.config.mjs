import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";

// https://astro.build/config
export default defineConfig({
  site: "https://may-solutions.io",
  integrations: [sitemap({ i18n: { defaultLocale: "en", locales: { en: "en-US", de: "de-DE" } } })],
  vite: {
    plugins: [tailwindcss()],
  },
});
