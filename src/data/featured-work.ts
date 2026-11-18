import type { Locale } from "../i18n";

interface Project {
  name: string;
  url: string;
  copy: Record<
    Locale,
    {
      /** Small label above the name: what kind of work it is. */
      kind: string;
      body: string;
      /** Spec sheet rows: [label, detail]. */
      rows: [string, string][];
    }
  >;
}

/** Projects in the order they are shown in the work section. */
export const PROJECTS: Project[] = [
  {
    name: "Mercedes-Benz Store",
    url: "https://shop.mercedes-benz.com/de-de/connect/",
    copy: {
      en: {
        kind: "E-commerce · Automotive",
        body: "The online store for digital extras for Mercedes-Benz vehicles, bought with a single login. We led its development for two and a half years.",
        rows: [
          ["Client", "Mercedes-Benz"],
          ["Role", "Development lead"],
          ["Duration", "2.5 years"]
        ]
      },
      de: {
        kind: "E-Commerce · Automobil",
        body: "Der Online-Store für digitale Extras rund um Mercedes-Benz Fahrzeuge, mit einem einzigen Login. Wir haben die Entwicklung zweieinhalb Jahre lang geleitet.",
        rows: [
          ["Kunde", "Mercedes-Benz"],
          ["Rolle", "Entwicklungsleitung"],
          ["Dauer", "2,5 Jahre"]
        ]
      }
    }
  },
  {
    name: "Time Management",
    url: "https://time.may-solutions.io/",
    copy: {
      en: {
        kind: "Own product · Time tracking",
        body: "Time tracking for contracts and planned hours, built privacy first. Your data never leaves your device; if you choose to sync for convenience, it is end-to-end encrypted.",
        rows: [
          ["Platform", "Progressive web app"],
          ["Data", "Local-first, stays on the device"],
          ["Sync", "Optional, end-to-end encrypted"]
        ]
      },
      de: {
        kind: "Eigenes Produkt · Zeiterfassung",
        body: "Zeiterfassung für Verträge und geplante Stunden, mit Datenschutz an erster Stelle. Ihre Daten verlassen das Gerät nicht; wer bequem synchronisieren möchte, tut das Ende-zu-Ende-verschlüsselt.",
        rows: [
          ["Plattform", "Progressive Web App"],
          ["Daten", "Local-first, bleiben auf dem Gerät"],
          ["Sync", "Optional, Ende-zu-Ende-verschlüsselt"]
        ]
      }
    }
  },
  {
    name: "Fooderino",
    url: "https://fooderino.app/",
    copy: {
      en: {
        kind: "Own product · Shopping list",
        body: "A smart shopping list that suggests what to buy, based on what you have bought before. Mobile-first and local-first: your data stays on your device, and sync is end-to-end encrypted.",
        rows: [
          ["Platform", "Progressive web app, mobile-first"],
          ["Suggestions", "From your own shopping history"],
          ["Data", "Local-first, end-to-end encrypted sync"]
        ]
      },
      de: {
        kind: "Eigenes Produkt · Einkaufsliste",
        body: "Eine smarte Einkaufsliste, die vorschlägt, was Sie kaufen sollten, auf Basis Ihrer bisherigen Einkäufe. Mobile-first und local-first: Ihre Daten bleiben auf dem Gerät, die Synchronisierung ist Ende-zu-Ende-verschlüsselt.",
        rows: [
          ["Plattform", "Progressive Web App, mobile-first"],
          ["Vorschläge", "Aus Ihrer eigenen Einkaufshistorie"],
          ["Daten", "Local-first, Ende-zu-Ende-verschlüsselter Sync"]
        ]
      }
    }
  }
];
