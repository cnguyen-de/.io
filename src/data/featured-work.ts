import type { Locale } from "../i18n";

interface Project {
  name: string;
  url: string;
  /** Which line drawing the card shows (FeaturedWork.astro). */
  figure: "store" | "time" | "list";
  copy: Record<
    Locale,
    {
      kind: string;
      body: string;
      /** Key facts, run together in one line under the text. */
      facts: string[];
    }
  >;
}

/** Projects in the order they are shown; the first one gets the wide card. */
export const PROJECTS: Project[] = [
  {
    name: "Mercedes-Benz Store",
    url: "https://shop.mercedes-benz.com/de-de/connect/",
    figure: "store",
    copy: {
      en: {
        kind: "Client project",
        body: "The store for digital extras for Mercedes-Benz vehicles. We led its development.",
        facts: ["E-commerce", "Development lead", "2.5 years"]
      },
      de: {
        kind: "Kundenprojekt",
        body: "Der Store für digitale Extras rund um Mercedes-Benz Fahrzeuge. Wir haben die Entwicklung geleitet.",
        facts: ["E-Commerce", "Entwicklungsleitung", "2,5 Jahre"]
      }
    }
  },
  {
    name: "Time Management",
    url: "https://time.may-solutions.io/",
    figure: "time",
    copy: {
      en: {
        kind: "Own product",
        body: "Time tracking for contracts and planned hours. Your data never leaves your device.",
        facts: ["PWA", "Local-first", "End-to-end encrypted sync"]
      },
      de: {
        kind: "Eigenes Produkt",
        body: "Zeiterfassung für Verträge und geplante Stunden. Ihre Daten verlassen Ihr Gerät nicht.",
        facts: ["PWA", "Local-first", "Ende-zu-Ende-verschlüsselter Sync"]
      }
    }
  },
  {
    name: "Fooderino",
    url: "https://fooderino.app/",
    figure: "list",
    copy: {
      en: {
        kind: "Own product",
        body: "A shopping list that suggests what to buy, based on what you bought before.",
        facts: ["Mobile-first PWA", "Local-first", "End-to-end encrypted"]
      },
      de: {
        kind: "Eigenes Produkt",
        body: "Eine Einkaufsliste, die vorschlägt, was Sie brauchen, auf Basis Ihrer bisherigen Einkäufe.",
        facts: ["Mobile-first PWA", "Local-first", "Ende-zu-Ende-verschlüsselt"]
      }
    }
  }
];
