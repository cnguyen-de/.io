export const en = {
  intro: {
    skip: 'Skip intro',
    scroll: 'Scroll to explore',
    acquiring: 'Acquiring target',
    locked: 'Frankfurt am Main',
  },
  chapters: {
    location: 'Frankfurt',
    trusted: 'Clients',
    services: 'Services',
    stack: 'Technologies',
    contact: 'Contact',
  },
  hero: {
    tagline: 'EXCELLENCE. EXPERTISE. EFFICIENCY.',
    // One sentence in two parts; the second is emphasised.
    descriptor: 'Custom software that scales to',
    descriptorStrong: 'hundreds of millions of users.',
  },
  location: {
    eyebrow: 'Headquarters',
    heading: 'Centrally Located in Frankfurt, Europe',
    body: 'Our headquarters are strategically situated in Frankfurt, a central hub of business and culture in Europe, ensuring easy access and connectivity for our clients and partners.',
  },
  trusted: {
    hint: 'Every arc leads to a client — follow one.',
    heading: 'Trusted by',
    body: 'We are proud to have helped implement solutions for leading companies across various sectors.',
    sectors: {
      sokaBau: 'Social fund · Insurance',
      mercedesBenzIo: 'Automotive',
      lbbw: 'Banking & finance',
      gitlab: 'DevOps platform',
      bilfinger: 'Industrial services',
      thinkcell: 'Technology',
    },
  },
  services: {
    heading: 'OUR SERVICES',
    // How we work, shown under every service.
    method: 'Agile delivery — short iterations, working software early, plans that adapt.',
    reference: 'Reference',
    webDev: {
      title: 'WEB DEVELOPMENT',
      claim: 'Web platforms engineered for hundreds of millions of users.',
      body: 'We design and build web applications and online shops end to end — interface, API, database and the pipeline that ships them — to be run, not just launched.',
      reference: 'Frontend lead for the Mercedes\u2011Benz online shop',
      rows: [
        ['Interfaces', 'Vue · React · Angular · Next.js'],
        ['APIs & services', 'Node.js · Spring Boot · Python'],
        ['Delivery', 'Docker · Kubernetes · Helm'],
      ],
    },
    consulting: {
      title: 'CONSULTING',
      claim: 'Architecture designed by the people who then build it.',
      body: 'We design system architecture that holds as traffic grows, review what already exists — and stay to implement what we recommend.',
      reference: 'Architecture design and implementation for numerous companies',
      rows: [
        ['Design', 'System & software architecture'],
        ['Review', 'Architecture, code, delivery pipeline'],
        ['Deliver', 'Hands-on, alongside your team'],
      ],
    },
    ai: {
      title: 'AI & VISION',
      claim: 'Models that leave the notebook and reach production.',
      body: 'We build machine-learning and computer-vision features and wire them into the product around them.',
      reference: 'State-of-the-art AI for thinkcell',
      rows: [
        ['Models', 'TensorFlow · PyTorch'],
        ['Vision', 'OpenCV'],
        ['Video pipelines', 'FFmpeg'],
      ],
    },
  },
  stack: {
    heading: 'Technologies we build with',
    body: 'We work with a broad range of modern technologies and pick the right tool for each requirement — for reliable, maintainable software that supports your business objectives.',
    groups: {
      frontend: 'Frontend',
      backend: 'Backend',
      data: 'Data',
      cloud: 'Cloud & DevOps',
      ai: 'AI & media',
    },
  },
  contact: {
    heading: 'CONTACT US',
    cta: 'Ready for your next project? Get in touch — we look forward to hearing from you.',
  },
  footer: {
    imprint: 'Imprint',
  },
};

export type Translations = typeof en;
