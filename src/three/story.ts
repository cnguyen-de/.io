/** Camera shot indices per chapter (kept free of three.js so the page can import it cheaply). */
export const SHOTS = { hero: 0, location: 1, trusted: 2, services: [3, 4, 5], contact: 6 } as const;

/** Towers the services tour visits, one per service, in order. */
export const SERVICE_TOWERS = ["Messeturm", "Main Tower", "Commerzbank Tower"] as const;
