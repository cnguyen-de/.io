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

export type LandmarkShape =
  | "commerzbank"
  | "messeturm"
  | "westend"
  | "maintower"
  | "ecb"
  | "europaturm"
  | "omniturm"
  | "trianon"
  | "dom"
  | "box"
  | "chamfer"
  | "round"
  | "twin";

export interface Landmark {
  name: string;
  lat: number;
  lon: number;
  height: number;
  shape: LandmarkShape;
  /** footprint width / depth in metres (meaning depends on shape) */
  w?: number;
  d?: number;
  /** rotation around y in radians */
  rot?: number;
  /** show a label in the "location" shot */
  label?: boolean;
  /** antenna tip height, if any */
  antenna?: number;
}

export const LANDMARKS: Landmark[] = [
  { name: "Commerzbank Tower", lat: 50.1107, lon: 8.6744, height: 259, antenna: 300, shape: "commerzbank", w: 62, rot: 0.35, label: true },
  { name: "Messeturm", lat: 50.1123, lon: 8.6526, height: 257, shape: "messeturm", w: 41, rot: 0.2, label: true },
  { name: "FOUR T1", lat: 50.1129, lon: 8.674, height: 233, shape: "box", w: 44, d: 34, rot: 0.3 },
  { name: "Westend Tower", lat: 50.1098, lon: 8.6642, height: 208, shape: "westend", w: 46, d: 34, rot: -0.25, label: true },
  { name: "Main Tower", lat: 50.1124, lon: 8.6718, height: 200, antenna: 240, shape: "maintower", w: 27, rot: 0.6, label: true },
  { name: "Tower 185", lat: 50.1086, lon: 8.6537, height: 200, shape: "box", w: 56, d: 28, rot: 0.9, label: true },
  { name: "Omniturm", lat: 50.1138, lon: 8.6727, height: 190, shape: "omniturm", w: 38, d: 38, rot: 0.3 },
  { name: "ONE", lat: 50.1107, lon: 8.6508, height: 190, shape: "box", w: 40, d: 32, rot: 0.5 },
  { name: "Trianon", lat: 50.1112, lon: 8.6685, height: 186, shape: "trianon", w: 50, rot: 1.1 },
  { name: "EZB", lat: 50.1096, lon: 8.7026, height: 185, shape: "ecb", w: 56, d: 26, rot: 0.25, label: true },
  { name: "Grand Tower", lat: 50.1068, lon: 8.6612, height: 180, shape: "chamfer", w: 40, d: 34, rot: 0.4 },
  { name: "Taunusturm", lat: 50.1101, lon: 8.6716, height: 170, shape: "box", w: 40, d: 30, rot: 0.3 },
  { name: "Opernturm", lat: 50.1155, lon: 8.6716, height: 170, shape: "box", w: 42, d: 30, rot: 0.2 },
  { name: "Silberturm", lat: 50.1071, lon: 8.6664, height: 166, shape: "chamfer", w: 44, d: 44, rot: 0.1 },
  { name: "Marienturm", lat: 50.1116, lon: 8.6732, height: 155, shape: "box", w: 34, d: 28, rot: 0.3 },
  { name: "Deutsche Bank", lat: 50.1138, lon: 8.6695, height: 155, shape: "twin", w: 36, d: 30, rot: 0.8 },
  { name: "Skyper", lat: 50.1096, lon: 8.6679, height: 154, shape: "round", w: 40, d: 30, rot: 0.2 },
  { name: "Eurotower", lat: 50.1094, lon: 8.6746, height: 148, shape: "box", w: 40, d: 28, rot: -0.3 },
  { name: "Frankfurter Büro Center", lat: 50.1134, lon: 8.6664, height: 142, shape: "box", w: 40, d: 30, rot: 0.25 },
  { name: "Europaturm", lat: 50.1253, lon: 8.6563, height: 337, shape: "europaturm", label: true },
  { name: "Kaiserdom", lat: 50.1106, lon: 8.6852, height: 95, shape: "dom", label: true },
];

/** Centreline of the river Main through the city, west → east. */
export const RIVER: [number, number][] = [
  [50.086, 8.58],
  [50.093, 8.62],
  [50.096, 8.64],
  [50.0995, 8.656],
  [50.1033, 8.6664],
  [50.1066, 8.6748],
  [50.1081, 8.6828],
  [50.1076, 8.69],
  [50.1073, 8.6955],
  [50.1078, 8.703],
  [50.1093, 8.711],
  [50.112, 8.725],
  [50.117, 8.76],
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
