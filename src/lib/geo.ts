/**
 * Local metric projection shared by the skyline data (scripts/fetch-skyline.mjs) and the drawings.
 * Units are metres: +x = east, +z = south, origin in the banking district.
 */
export const ORIGIN = { lat: 50.1105, lon: 8.67 };
const M_PER_DEG_LAT = 111_200;
const M_PER_DEG_LON = 111_320 * Math.cos((ORIGIN.lat * Math.PI) / 180);

export function toLocal(lat: number, lon: number): [x: number, z: number] {
  return [(lon - ORIGIN.lon) * M_PER_DEG_LON, -(lat - ORIGIN.lat) * M_PER_DEG_LAT];
}

/** The site plan sheet (Fig. 2): the part of the city it shows, in local metres. */
export const PLAN = { minX: -1750, minZ: -1150, width: 3750, height: 3000 };

/** The city centre (Römerberg). The office address is deliberately not part of the drawings. */
export const CITY = { lat: 50.1109, lon: 8.6821 };

/**
 * Riedbergplatz, the square at the heart of the Riedberg district (OpenStreetMap). This is the pin
 * for the company's location in structured data, meta tags and the site plan; it is a public place,
 * not the office.
 */
export const RIEDBERG = { lat: 50.1766, lon: 8.629 };

/** Centreline of the river Main through the city, west → east (OpenStreetMap, simplified). */
export const RIVER: [lat: number, lon: number][] = [
  [50.092, 8.574],
  [50.0898, 8.579],
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
  [50.092, 8.6392],
  [50.0937, 8.6438],
  [50.095, 8.6493],
  [50.0956, 8.6528],
  [50.0964, 8.6564],
  [50.0976, 8.6604],
  [50.0988, 8.6633],
  [50.101, 8.6668],
  [50.1034, 8.6712],
  [50.105, 8.6741],
  [50.1063, 8.6769],
  [50.1079, 8.6811],
  [50.1087, 8.6859],
  [50.1083, 8.6909],
  [50.1077, 8.6949],
  [50.1072, 8.6993],
  [50.1067, 8.7046],
  [50.1066, 8.709],
  [50.1063, 8.715],
  [50.1065, 8.7188],
  [50.1079, 8.7243],
  [50.1089, 8.7279]
];

/**
 * Riedbergplatz lies about 8 km north-west of the site plan, off the sheet: an arrow near the edge
 * points the way. Returned in local metres, together with the true distance from the centre.
 */
export function riedbergArrow() {
  const [cx, cz] = toLocal(CITY.lat, CITY.lon);
  const [rx, rz] = toLocal(RIEDBERG.lat, RIEDBERG.lon);
  const distance = Math.hypot(rx - cx, rz - cz);
  const [ux, uz] = [(rx - cx) / distance, (rz - cz) / distance];
  const tail: [number, number] = [-700, -620];
  const head: [number, number] = [Math.round(tail[0] + ux * 420), Math.round(tail[1] + uz * 420)];
  const barb = (deg: number): [number, number] => {
    const a = (deg * Math.PI) / 180;
    const [bx, bz] = [-ux, -uz];
    return [
      Math.round(head[0] + 80 * (bx * Math.cos(a) - bz * Math.sin(a))),
      Math.round(head[1] + 80 * (bx * Math.sin(a) + bz * Math.cos(a)))
    ];
  };
  return { tail, head, barbs: [barb(28), barb(-28)], distance };
}
