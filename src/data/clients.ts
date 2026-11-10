/**
 * Clients, in the order they are listed on the page. The 3D scene draws one data arc per entry
 * (same order), so an index identifies a client on both sides. Sector lines live in the i18n
 * files (`trusted.sectors`).
 */
export const CLIENTS = [
  { id: "sokaBau", name: "SOKA-BAU", href: "https://www.soka-bau.de/" },
  { id: "mercedesBenzIo", name: "Mercedes-Benz.io", href: "https://www.mercedes-benz.io/" },
  { id: "lbbw", name: "LBBW", href: "https://www.lbbw.de" },
  { id: "gitlab", name: "GitLab", href: "https://gitlab.com/" },
  { id: "bilfinger", name: "Bilfinger", href: "https://www.bilfinger.com/" },
  { id: "thinkcell", name: "thinkcell", href: "https://www.thinkcell.com/" },
] as const;

export type ClientId = (typeof CLIENTS)[number]["id"];
