import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import vue from "@astrojs/vue";
import tailwindcss from "@tailwindcss/vite";

// https://astro.build/config
export default defineConfig({
  site: "https://may-solutions.io",
  integrations: [ vue(), sitemap()],

  vite: {
    plugins: [tailwindcss()],
  },
});