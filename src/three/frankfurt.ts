/**
 * Geographic data for the stylized Frankfurt skyline.
 * Positions are real (approximate) WGS84 coordinates, heights are real roof heights in metres.
 * The local scene uses metres: +x = east, -z = north, +y = up, origin in the banking district.
 */

export const ORIGIN = { lat: 50.1105, lon: 8.67 };
const M_PER_DEG_LAT = 111_200;
const M_PER_DEG_LON = 111_320 * Math.cos((ORIGIN.lat * Math.PI) / 180);

export function toLocal(lat: number, lon: number): [number, number] {
  return [(lon - ORIGIN.lon) * M_PER_DEG_LON, -(lat - ORIGIN.lat) * M_PER_DEG_LAT];
}

export const FRANKFURT = { lat: 50.1109, lon: 8.6821 };
export const HQ = { lat: 50.166, lon: 8.682 };

/**
 * Landmarks modelled by hand. All other high-rises (Commerzbank Tower, Messeturm, Main Tower, …)
 * come from real OpenStreetMap footprints in skyline.json — see scripts/fetch-skyline.mjs.
 */
export type LandmarkShape = "ecb" | "europaturm" | "dom";

export interface Landmark {
  name: string;
  lat: number;
  lon: number;
  height: number;
  shape: LandmarkShape;
  /** footprint width / depth in metres */
  w?: number;
  d?: number;
  /** rotation around y in radians */
  rot?: number;
}

export const LANDMARKS: Landmark[] = [
  { name: "EZB", lat: 50.109, lon: 8.7031, height: 185, shape: "ecb", w: 56, d: 26, rot: 0.25 },
  { name: "Europaturm", lat: 50.1253, lon: 8.6563, height: 337, shape: "europaturm" },
  { name: "Kaiserdom", lat: 50.1107, lon: 8.6853, height: 95, shape: "dom" },
];

/** Centreline of the river Main through the city, west → east (OpenStreetMap, simplified). */
export const RIVER: [number, number][] = [
  [50.0920, 8.5740],
  [50.0898, 8.5790],
  [50.0889, 8.5832],
  [50.0889, 8.5885],
  [50.0898, 8.5957],
  [50.0897, 8.5994],
  [50.0897, 8.6037],
  [50.0893, 8.6102],
  [50.0893, 8.6152],
  [50.0893, 8.6188],
  [50.0888, 8.6224],
  [50.0887, 8.6265],
  [50.0891, 8.6304],
  [50.0905, 8.6356],
  [50.0920, 8.6392],
  [50.0937, 8.6438],
  [50.0950, 8.6493],
  [50.0956, 8.6528],
  [50.0964, 8.6564],
  [50.0976, 8.6604],
  [50.0988, 8.6633],
  [50.1010, 8.6668],
  [50.1034, 8.6712],
  [50.1050, 8.6741],
  [50.1063, 8.6769],
  [50.1079, 8.6811],
  [50.1087, 8.6859],
  [50.1083, 8.6909],
  [50.1077, 8.6949],
  [50.1072, 8.6993],
  [50.1067, 8.7046],
  [50.1066, 8.7090],
  [50.1063, 8.7150],
  [50.1065, 8.7188],
  [50.1079, 8.7243],
  [50.1089, 8.7279],
  [50.1101, 8.7327],
  [50.1118, 8.7372],
  [50.1151, 8.7446],
  [50.1157, 8.7502],
  [50.1151, 8.7536],
  [50.1126, 8.7586],
  [50.1097, 8.7631],
  [50.1087, 8.7662],
  [50.1081, 8.7705],
  [50.1269, 8.7696],
  [50.1294, 8.7689],
  [50.1318, 8.7690],
  [50.1341, 8.7707],
];
export const RIVER_WIDTH = 170;

/** Longitudes where bridges cross the Main. */
export const BRIDGES = [8.6664, 8.6748, 8.6828, 8.69, 8.6955, 8.711];

/**
 * Client locations for the "trusted by" data arcs. The arcs only need to point the right way —
 * they vanish over the horizon; each client's name rides on its arc as a clickable chip.
 */
export const CLIENT_LINKS: { client?: string; href?: string; lat: number; lon: number }[] = [
  { client: "SOKA-BAU", href: "https://www.soka-bau.de/", lat: 50.0826, lon: 8.24 },
  { client: "Bilfinger", href: "https://www.bilfinger.com/", lat: 49.4875, lon: 8.466 },
  { client: "Mercedes-Benz.io", href: "https://www.mercedes-benz.io/", lat: 48.7758, lon: 9.1829 },
  { client: "LBBW", href: "https://www.lbbw.de", lat: 48.7858, lon: 9.4829 },
  { client: "GitLab", href: "https://gitlab.com/", lat: 53.55, lon: 9.99 },
  { lat: 52.52, lon: 13.405 },
  { lat: 51.5072, lon: -0.1276 },
];

/** Cities the globe arcs connect Frankfurt to during the intro. */
export const WORLD_CITIES: [number, number][] = [
  [40.7128, -74.006],
  [37.7749, -122.4194],
  [51.5072, -0.1276],
  [1.3521, 103.8198],
  [35.6762, 139.6503],
  [25.2048, 55.2708],
  [-23.5505, -46.6333],
  [21.0278, 105.8342],
  [-33.8688, 151.2093],
  [52.52, 13.405],
  [59.3293, 18.0686],
  [19.076, 72.8777],
  [-33.9249, 18.4241],
  [43.6532, -79.3832],
];
