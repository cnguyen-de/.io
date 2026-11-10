export const en = {
  meta: {
    title: "Software Company in Frankfurt am Main – May Solutions",
    description:
      "Software development and IT consulting in Frankfurt am Main. May Solutions builds custom web platforms and AI for Rhein-Main and Europe."
  },
  nav: {
    skip: "Skip to content",
    clients: "Clients",
    services: "Services",
    stack: "Technologies",
    location: "Frankfurt",
    contact: "Contact",
    cta: "Start a project",
    ctaShort: "Contact",
    // The language switch is labelled in the language it leads to.
    switchTo: "DE",
    switchLabel: "Zur deutschen Version wechseln"
  },
  hero: {
    eyebrow: "Software engineering & IT consulting",
    // Headline: two lines; the last word carries the dimension line.
    headline: ["Software,", "built to"],
    headlineAccent: "scale.",
    tagline: ["Excellence", "Expertise", "Efficiency"],
    // One sentence in two parts; the second is emphasised.
    descriptor: "Custom software that scales to",
    descriptorStrong: "hundreds of millions of users.",
    secondary: "Our services",
    figure: "Fig. 1 — Frankfurt am Main · view from the south · true to scale",
    figureAlt: "Line drawing of the Frankfurt skyline seen from the south, drawn to scale."
  },
  trusted: {
    eyebrow: "Clients",
    heading: "Trusted by",
    body: "We are proud to have helped implement solutions for leading companies across various sectors.",
    visit: "Visit website",
    sectors: {
      sokaBau: "Social fund · Insurance",
      mercedesBenzIo: "Automotive",
      lbbw: "Banking & finance",
      gitlab: "DevOps platform",
      bilfinger: "Industrial services",
      thinkcell: "Technology"
    }
  },
  services: {
    eyebrow: "Services",
    heading: "Our services",
    // How we work, shown next to the heading.
    method: "Agile delivery — short iterations, working software early, plans that adapt.",
    reference: "Reference",
    items: [
      {
        title: "Web development",
        claim: "Web platforms engineered for hundreds of millions of users.",
        body: "We design and build web applications and online shops end to end — interface, API, database and the pipeline that ships them — to be run, not just launched.",
        reference: "Frontend lead for the Mercedes‑Benz online shop",
        rows: [
          ["Interfaces", "Vue · React · Angular · Next.js"],
          ["APIs & services", "Node.js · Spring Boot · Python"],
          ["Delivery", "Docker · Kubernetes · Helm"]
        ]
      },
      {
        title: "Consulting",
        claim: "Architecture designed by the people who then build it.",
        body: "We design system architecture that holds as traffic grows, review what already exists — and stay to implement what we recommend.",
        reference: "Architecture design and implementation for numerous companies",
        rows: [
          ["Design", "System & software architecture"],
          ["Review", "Architecture, code, delivery pipeline"],
          ["Deliver", "Hands-on, alongside your team"]
        ]
      },
      {
        title: "AI & vision",
        claim: "Models that leave the notebook and reach production.",
        body: "We build machine-learning and computer-vision features and wire them into the product around them.",
        reference: "State-of-the-art AI for thinkcell",
        rows: [
          ["Models", "TensorFlow · PyTorch"],
          ["Vision", "OpenCV"],
          ["Video pipelines", "FFmpeg"]
        ]
      }
    ]
  },
  stack: {
    eyebrow: "Technologies",
    heading: "Technologies we build with",
    body: "We work with a broad range of modern technologies and pick the right tool for each requirement — for reliable, maintainable software that supports your business objectives.",
    groups: {
      frontend: "Frontend",
      backend: "Backend",
      data: "Data",
      cloud: "Cloud & DevOps",
      ai: "AI & media"
    }
  },
  location: {
    eyebrow: "Headquarters",
    heading: "Centrally located in Frankfurt, Europe",
    body: "Our headquarters are strategically situated in Frankfurt, a central hub of business and culture in Europe, ensuring easy access and connectivity for our clients and partners.",
    facts: {
      base: "Based in",
      baseValue: "Frankfurt am Main, Germany",
      region: "Serving",
      regionValue: "Germany · Europe",
      languages: "Languages"
    },
    figure: "Fig. 2 — Frankfurt am Main · high-rises and the river Main · site plan",
    figureAlt: "Site plan of central Frankfurt showing the footprints of its high-rises along the river Main.",
    plan: {
      north: "N",
      river: "Main",
      fair: "Messe",
      banks: "Banking district"
    }
  },
  contact: {
    eyebrow: "Contact",
    heading: "Ready for your next project?",
    body: "Get in touch — we look forward to hearing from you.",
    copy: "Copy email address",
    copied: "Copied"
  },
  footer: {
    imprint: "Imprint",
    credit: "Skyline data © OpenStreetMap contributors",
    top: "Back to top"
  }
};

export type Translations = typeof en;
