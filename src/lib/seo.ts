/**
 * Structured data (JSON-LD) for the home pages, one graph per language. Search engines and AI
 * assistants read it to learn who the company is, what it offers and where it works — so the
 * location is stated at city level, never as a street address,
 * and there is no email: see src/lib/protect.ts.
 */
import { STACK } from "../data/stack";
import { HOME, translations, type Locale } from "../i18n";
import { RIEDBERG } from "./geo";

export const SITE_URL = "https://may-solutions.io";
const ORG = `${SITE_URL}/#organization`;
const WEBSITE = `${SITE_URL}/#website`;

export function structuredData(lang: Locale) {
  const t = translations[lang];
  const url = SITE_URL + HOME[lang];
  const de = lang === "de";

  const areaServed = [
    { "@type": "City", name: "Frankfurt am Main" },
    { "@type": "AdministrativeArea", name: "Frankfurt Rhein-Main" },
    { "@type": "State", name: "Hessen" },
    { "@type": "Country", name: de ? "Deutschland" : "Germany" },
    { "@type": "Continent", name: de ? "Europa" : "Europe" }
  ];

  const services = t.services.items.map((s) => ({
    "@type": "Service",
    name: s.title,
    serviceType: s.title,
    description: `${s.claim} ${s.body}`,
    provider: { "@id": ORG },
    areaServed
  }));

  const organization = {
    "@type": ["ProfessionalService", "LocalBusiness"],
    "@id": ORG,
    name: "May Solutions",
    legalName: "May Solutions UG (haftungsbeschränkt)",
    url: SITE_URL + HOME.en,
    description: t.meta.description,
    slogan: "Excellence. Expertise. Efficiency.",
    logo: `${SITE_URL}/favicon.svg`,
    image: `${SITE_URL}/og-image.png`,
    // District level only: no street, no postcode.
    address: {
      "@type": "PostalAddress",
      addressLocality: "Frankfurt am Main",
      addressRegion: "Hessen",
      addressCountry: "DE"
    },
    location: {
      "@type": "Place",
      name: "Frankfurt am Main",
      geo: { "@type": "GeoCoordinates", latitude: RIEDBERG.lat, longitude: RIEDBERG.lon }
    },
    geo: { "@type": "GeoCoordinates", latitude: RIEDBERG.lat, longitude: RIEDBERG.lon },
    areaServed,
    knowsLanguage: ["de", "en"],
    knowsAbout: [...t.services.items.map((s) => s.title), ...STACK.flatMap((g) => g.items.map(([, name]) => name))],
    founder: { "@type": "Person", name: "Minh Chi Nguyen" },
    priceRange: "$$",
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: t.services.heading,
      itemListElement: services.map((itemOffered) => ({ "@type": "Offer", itemOffered }))
    }
  };

  return {
    "@context": "https://schema.org",
    "@graph": [
      organization,
      {
        "@type": "WebSite",
        "@id": WEBSITE,
        url: SITE_URL + HOME.en,
        name: "May Solutions",
        inLanguage: ["en", "de"],
        publisher: { "@id": ORG }
      },
      {
        "@type": "WebPage",
        "@id": `${url}#webpage`,
        url,
        name: t.meta.title,
        description: t.meta.description,
        inLanguage: lang,
        isPartOf: { "@id": WEBSITE },
        about: { "@id": ORG },
        primaryImageOfPage: `${SITE_URL}/og-image.png`
      }
    ]
  };
}
