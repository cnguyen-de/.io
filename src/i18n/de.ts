import type { Translations } from './en';

export const de: Translations = {
  intro: {
    skip: 'Intro überspringen',
    scroll: 'Scrollen zum Entdecken',
    acquiring: 'Ziel wird erfasst',
    locked: 'Frankfurt am Main',
  },
  chapters: {
    location: 'Frankfurt',
    trusted: 'Kunden',
    services: 'Leistungen',
    stack: 'Technologien',
    contact: 'Kontakt',
  },
  hero: {
    tagline: 'EXZELLENZ. EXPERTISE. EFFIZIENZ.',
    descriptor: 'Individuelle Software – skalierbar für',
    descriptorStrong: 'Hunderte Millionen Nutzer.',
  },
  location: {
    eyebrow: 'Hauptsitz',
    heading: 'Zentral gelegen in Frankfurt am Main, Europa',
    body: 'Unser Hauptsitz befindet sich in Frankfurt am Main – einem der bedeutendsten Wirtschaftsstandorte Europas. Diese strategische Lage ermöglicht uns eine enge Zusammenarbeit mit Unternehmen aus dem Rhein-Main-Gebiet, dem deutschen Mittelstand sowie internationalen Partnern.',
  },
  trusted: {
    hint: 'Jeder Bogen führt zu einem Kunden — folgen Sie einem.',
    heading: 'Uns vertrauen',
    body: 'Wir sind stolz darauf, Lösungen für führende Unternehmen in verschiedenen Branchen umgesetzt zu haben.',
    sectors: {
      sokaBau: 'Sozialkasse · Versicherung',
      mercedesBenzIo: 'Automobil',
      lbbw: 'Banken & Finanzen',
      gitlab: 'DevOps-Plattform',
      bilfinger: 'Industriedienstleistungen',
      thinkcell: 'Technologie',
    },
  },
  services: {
    heading: 'UNSERE LEISTUNGEN',
    method: 'Agile Umsetzung — kurze Iterationen, früh lauffähige Software, Pläne, die sich anpassen.',
    reference: 'Referenz',
    webDev: {
      title: 'WEBENTWICKLUNG',
      claim: 'Webplattformen, ausgelegt für Hunderte Millionen Nutzer.',
      body: 'Wir konzipieren und entwickeln Webanwendungen und Onlineshops von Anfang bis Ende – Oberfläche, API, Datenbank und die Pipeline, die sie ausliefert. Gebaut für den Betrieb, nicht nur für den Launch.',
      reference: 'Frontend-Lead für den Onlineshop von Mercedes\u2011Benz',
      rows: [
        ['Oberflächen', 'Vue · React · Angular · Next.js'],
        ['APIs & Services', 'Node.js · Spring Boot · Python'],
        ['Auslieferung', 'Docker · Kubernetes · Helm'],
      ],
    },
    consulting: {
      title: 'IT-BERATUNG',
      claim: 'Architektur, entworfen von denen, die sie anschließend bauen.',
      body: 'Wir entwerfen Systemarchitekturen, die mit dem Traffic mitwachsen, prüfen Bestehendes – und bleiben, um das Empfohlene umzusetzen.',
      reference: 'Architektur & Umsetzung für zahlreiche Unternehmen',
      rows: [
        ['Entwerfen', 'System- & Softwarearchitektur'],
        ['Prüfen', 'Architektur, Code, Delivery-Pipeline'],
        ['Umsetzen', 'Hands-on, Seite an Seite mit Ihrem Team'],
      ],
    },
    ai: {
      title: 'KI & VISION',
      claim: 'Modelle, die das Notebook verlassen und in Produktion gehen.',
      body: 'Wir entwickeln Machine-Learning- und Computer-Vision-Funktionen und binden sie in das Produkt ein, zu dem sie gehören.',
      reference: 'State-of-the-Art-KI für thinkcell',
      rows: [
        ['Modelle', 'TensorFlow · PyTorch'],
        ['Bildverarbeitung', 'OpenCV'],
        ['Video-Pipelines', 'FFmpeg'],
      ],
    },
  },
  stack: {
    heading: 'Technologien, mit denen wir arbeiten',
    body: 'Wir arbeiten mit einem breiten Spektrum moderner Technologien und wählen für jede Anforderung das passende Werkzeug – für zuverlässige, wartbare Software, die Ihre Geschäftsziele unterstützt.',
    groups: {
      frontend: 'Frontend',
      backend: 'Backend',
      data: 'Daten',
      cloud: 'Cloud & DevOps',
      ai: 'KI & Medien',
    },
  },
  contact: {
    heading: 'KONTAKT',
    cta: 'Bereit für Ihr nächstes Projekt? Kontaktieren Sie uns – wir freuen uns auf Ihre Anfrage.',
  },
  footer: {
    imprint: 'Impressum',
  },
};
