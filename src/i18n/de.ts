import type { Translations } from "./en";

export const de: Translations = {
  meta: {
    title: "Softwareentwicklung in Frankfurt am Main - May Solutions",
    description:
      "Softwareentwicklung und IT-Beratung in Frankfurt am Main. May Solutions entwickelt individuelle Webplattformen und KI für Rhein-Main und Europa."
  },
  nav: {
    skip: "Zum Inhalt springen",
    clients: "Kunden",
    services: "Leistungen",
    stack: "Technologien",
    location: "Frankfurt",
    contact: "Kontakt",
    cta: "Projekt starten",
    ctaShort: "Kontakt",
    switchTo: "EN",
    switchLabel: "Switch to the English version"
  },
  hero: {
    eyebrow: "Softwareentwicklung & IT-Beratung",
    headline: ["Software im", "großen"],
    headlineAccent: "Maßstab.",
    tagline: ["Exzellenz", "Expertise", "Effizienz"],
    descriptor: "Individuelle Software, skalierbar für",
    descriptorStrong: "Hunderte Millionen Nutzer.",
    secondary: "Unsere Leistungen",
    figure: "Abb. 1 · Frankfurt am Main · Ansicht von Süden · maßstabsgetreu",
    figureAlt: "Strichzeichnung der Frankfurter Skyline von Süden, maßstabsgetreu.",
    model: "Abb. 1 · Frankfurt am Main · Axonometrie · maßstabsgetreu",
    modelAlt: "Dreidimensionale Strichzeichnung der Frankfurter Hochhäuser am Main, maßstabsgetreu.",
    hint: "Ziehen, um das Modell zu drehen"
  },
  trusted: {
    eyebrow: "Kunden",
    heading: "Uns vertrauen",
    body: "Wir sind stolz darauf, Lösungen für führende Unternehmen in verschiedenen Branchen umgesetzt zu haben.",
    visit: "Website besuchen",
    sectors: {
      sokaBau: "Sozialkasse · Versicherung",
      mercedesBenzIo: "Automobil",
      lbbw: "Banken & Finanzen",
      gitlab: "DevOps-Plattform",
      bilfinger: "Industriedienstleistungen",
      thinkcell: "Technologie"
    }
  },
  services: {
    eyebrow: "Leistungen",
    heading: "Unsere Leistungen",
    method: "Agile Umsetzung: kurze Iterationen, früh lauffähige Software, Pläne, die sich anpassen.",
    reference: "Referenz",
    items: [
      {
        title: "Webentwicklung",
        claim: "Webplattformen, ausgelegt für Hunderte Millionen Nutzer.",
        body: "Wir konzipieren und entwickeln Webanwendungen und Onlineshops von Anfang bis Ende: Oberfläche, API, Datenbank und die Pipeline, die sie ausliefert. Gebaut für den Betrieb, nicht nur für den Launch.",
        reference: "Frontend-Lead für den Onlineshop von Mercedes‑Benz",
        rows: [
          ["Oberflächen", "Vue · React · Angular · Next.js"],
          ["APIs & Services", "Node.js · Spring Boot · Python"],
          ["Auslieferung", "Docker · Kubernetes · Helm"]
        ]
      },
      {
        title: "IT-Beratung",
        claim: "Architektur, entworfen von denen, die sie anschließend bauen.",
        body: "Wir entwerfen Systemarchitekturen, die mit dem Traffic mitwachsen, prüfen Bestehendes und bleiben, um das Empfohlene umzusetzen.",
        reference: "Architektur & Umsetzung für zahlreiche Unternehmen",
        rows: [
          ["Entwerfen", "System- & Softwarearchitektur"],
          ["Prüfen", "Architektur, Code, Delivery-Pipeline"],
          ["Umsetzen", "Hands-on, Seite an Seite mit Ihrem Team"]
        ]
      },
      {
        title: "KI, Vision & Sprache",
        claim: "Modelle, die das Notebook verlassen und in Produktion gehen.",
        body: "Wir entwickeln Funktionen für Machine Learning, Computer Vision und Sprache, von Objektklassifikation über Speech-to-Text und Text-to-Speech bis zu Retrieval-Augmented Generation (RAG), und binden sie in das Produkt ein, zu dem sie gehören.",
        reference: "State-of-the-Art-KI für thinkcell",
        rows: [
          ["Modelle", "TensorFlow · PyTorch"],
          ["Bildverarbeitung", "OpenCV · Objektklassifikation"],
          ["Sprache", "Speech-to-Text · Text-to-Speech"],
          ["Text", "RAG · LLM-Integration"],
          ["Video-Pipelines", "FFmpeg"]
        ]
      },
      {
        title: "KI-Beratung",
        claim: "Frontier-KI, die arbeitet: im Unternehmen und im Alltag.",
        body: "Wir entwickeln Anwendungen auf Basis führender KI-Modelle und arbeiten täglich mit ihnen. Wir zeigen, wo sich KI lohnt, wählen mit Ihnen die passenden Modelle und Werkzeuge aus und helfen, sie wirkungsvoll einzusetzen, in Ihren Produkten, Ihren Prozessen und Ihrer täglichen Arbeit.",
        rows: [
          ["Strategie", "Anwendungsfälle, Modelle, Werkzeuge"],
          ["Entwicklung", "Anwendungen mit Anthropic, OpenAI & Vertex AI"],
          ["Alltag", "Wirkungsvoll mit KI arbeiten, für Teams und Einzelne"]
        ]
      }
    ]
  },
  stack: {
    eyebrow: "Technologien",
    heading: "Technologien, mit denen wir arbeiten",
    body: "Wir arbeiten mit einem breiten Spektrum moderner Technologien und wählen für jede Anforderung das passende Werkzeug, für zuverlässige, wartbare Software, die Ihre Geschäftsziele unterstützt.",
    groups: {
      frontend: "Frontend",
      backend: "Backend",
      data: "Daten",
      cloud: "Cloud",
      devops: "DevOps",
      genai: "Generative KI",
      ml: "ML & Medien"
    }
  },
  location: {
    eyebrow: "Hauptsitz",
    heading: "Zentral gelegen in Frankfurt am Main, Europa",
    body: "Unser Hauptsitz befindet sich in Frankfurt am Main, einem der bedeutendsten Wirtschaftsstandorte Europas. Diese strategische Lage ermöglicht uns eine enge Zusammenarbeit mit Unternehmen aus dem Rhein-Main-Gebiet, dem deutschen Mittelstand sowie internationalen Partnern.",
    facts: {
      base: "Standort",
      baseValue: "Frankfurt am Main, Deutschland",
      region: "Einzugsgebiet",
      regionValue: "Deutschland · Europa",
      languages: "Sprachen"
    },
    figure: "Abb. 2 · Frankfurt am Main · vom Main bis Riedberg · Lageplan",
    figureAlt: "Lageplan von Frankfurt vom Main nach Norden bis Riedberg, mit den Hochhäusern der Innenstadt und dem Standort von May Solutions in Riedberg.",
    plan: {
      north: "N",
      river: "Main",
      fair: "Messe",
      banks: "Bankenviertel"
    }
  },
  contact: {
    eyebrow: "Kontakt",
    heading: "Bereit für Ihr nächstes Projekt?",
    body: "Kontaktieren Sie uns. Wir freuen uns auf Ihre Anfrage.",
    copy: "E-Mail-Adresse kopieren",
    copied: "Kopiert",
    figure: "Abb. 3 · Frankfurt am Main · Ansicht von Süden · bei Nacht",
    figureAlt: "Die Frankfurter Skyline bei Nacht, von Süden gesehen, maßstabsgetreu."
  },
  footer: {
    imprint: "Impressum",
    credit: "Skyline-Daten © OpenStreetMap-Mitwirkende",
    top: "Nach oben"
  }
};
