import type { Locale } from "../i18n";

interface FeaturedWork {
  // Optional path to a screenshot in public/, for example "/product.webp".
  image?: string;
  url?: string;
  copy: Record<Locale, { title: string; description: string; imageAlt?: string }>;
}

export const featuredWork: FeaturedWork = {
  copy: {
    en: {
      title: "Project preview",
      description: "A closer look at our work is coming soon."
    },
    de: {
      title: "Projektvorschau",
      description: "Hier geben wir bald Einblick in eines unserer Projekte."
    }
  }
};
