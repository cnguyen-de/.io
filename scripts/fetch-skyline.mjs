// Downloads the real 3D footprints of Frankfurt's high-rises from OpenStreetMap and writes them to
// src/three/skyline.json (local metres, same projection as src/three/frankfurt.ts).
//
//   node scripts/fetch-skyline.mjs
//
// Run by hand when the data should be refreshed; the site itself never talks to OSM.
// Data © OpenStreetMap contributors, ODbL.
import { writeFileSync } from "node:fs";

const BBOX = [50.1, 8.645, 50.12, 8.705]; // Messe → banking district → Ostend
const MIN_HEIGHT = 60; // metres; everything lower is covered by the procedural city
const ORIGIN = { lat: 50.1105, lon: 8.67 };
const M_PER_DEG_LAT = 111_200;
const M_PER_DEG_LON = 111_320 * Math.cos((ORIGIN.lat * Math.PI) / 180);
/** Kept hand-modelled in city.ts. */
const EXCLUDE = [
  { lat: 50.109, lon: 8.703, r: 150 }, // EZB (twisted twin towers)
  { lat: 50.1107, lon: 8.6853, r: 80 }, // Kaiserdom
];

// Filter server-side: only buildings / parts that carry a height or many levels.
const query = `
[out:json][timeout:90];
(
  way["building"]["height"](${BBOX});
  way["building"]["building:levels"](if: t["building:levels"] >= 15)(${BBOX});
  way["building:part"]["height"](${BBOX});
  way["building:part"]["building:levels"](${BBOX});
);
out tags geom;`;

const MIRRORS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];

async function overpass() {
  for (let attempt = 0; attempt < 4; attempt++) {
    const url = MIRRORS[attempt % MIRRORS.length];
    const res = await fetch(url, {
      method: "POST",
      headers: { "User-Agent": "may-solutions-skyline/1.0", "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ data: query }),
    }).catch((err) => ({ ok: false, status: err.message }));
    if (res.ok) return res.json();
    console.warn(`${url}: ${res.status}, retrying…`);
    await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
  }
  throw new Error("Overpass unavailable");
}

const { elements } = await overpass();

const num = (v) => (v == null ? NaN : parseFloat(String(v).replace(",", ".")));
const local = ({ lat, lon }) => [(lon - ORIGIN.lon) * M_PER_DEG_LON, -(lat - ORIGIN.lat) * M_PER_DEG_LAT];

function heightOf(t) {
  const h = num(t.height);
  if (h > 0) return h;
  const lv = num(t["building:levels"]);
  return lv > 0 ? lv * 3.6 : NaN;
}
function minHeightOf(t) {
  const h = num(t.min_height);
  if (h > 0) return h;
  const lv = num(t["building:min_level"]);
  return lv > 0 ? lv * 3.6 : 0;
}
function area(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, z1] = pts[i];
    const [x2, z2] = pts[(i + 1) % pts.length];
    a += x1 * z2 - x2 * z1;
  }
  return a / 2;
}
function centroid(pts) {
  return pts.reduce(([sx, sz], [x, z]) => [sx + x / pts.length, sz + z / pts.length], [0, 0]);
}
function inside([x, z], poly) {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i];
    const [xj, zj] = poly[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) hit = !hit;
  }
  return hit;
}

const shapes = elements
  .filter((e) => e.type === "way" && e.geometry?.length >= 4)
  .map((e) => {
    const t = e.tags ?? {};
    const ring = e.geometry.slice(0, -1).map(local);
    return {
      id: e.id,
      name: t.name,
      isPart: !!t["building:part"] && !t.building,
      h: heightOf(t),
      minH: minHeightOf(t),
      roof: t["roof:shape"],
      roofH: num(t["roof:height"]),
      pts: area(ring) < 0 ? ring.reverse() : ring, // counter-clockwise in (x, z)
    };
  })
  .filter((s) => s.h > 0 && Math.abs(area(s.pts)) > 1) // keep masts and antennas
  .filter((s) => {
    const [x, z] = centroid(s.pts);
    return !EXCLUDE.some((ex) => {
      const [ex_, ez] = local(ex);
      return Math.hypot(x - ex_, z - ez) < ex.r;
    });
  });

const buildings = shapes.filter((s) => !s.isPart && s.h >= MIN_HEIGHT);
const parts = shapes.filter((s) => s.isPart);

// OSM convention: when a building has parts, the parts describe its 3D shape.
const out = [];
for (const b of buildings) {
  const own = parts.filter((p) => inside(centroid(p.pts), b.pts) && p.h >= 30);
  if (own.length) own.forEach((p) => (p.owner = b));
  else out.push(b);
}
out.push(...parts.filter((p) => p.owner || p.h >= MIN_HEIGHT));

// Identical footprints stacked without min_height would z-fight: keep the tallest.
const dedup = [];
for (const s of out.sort((a, b) => b.h - a.h)) {
  const [cx, cz] = centroid(s.pts);
  const a = Math.abs(area(s.pts));
  const dup = dedup.some((d) => {
    const [dx, dz] = centroid(d.pts);
    return Math.hypot(cx - dx, cz - dz) < 1.5 && Math.abs(Math.abs(area(d.pts)) - a) < a * 0.05 && s.minH === d.minH;
  });
  if (!dup && !dedup.some((d) => d.id === s.id)) dedup.push(s);
}

const r1 = (v) => Math.round(v * 10) / 10;
const data = dedup.map((s) => ({
  ...(s.owner?.name || s.name ? { name: s.owner?.name ?? s.name } : {}),
  h: r1(s.h),
  ...(s.minH ? { minH: r1(s.minH) } : {}),
  ...(s.roof && s.roof !== "flat" && s.roofH > 0 ? { roof: s.roof, roofH: r1(s.roofH) } : {}),
  pts: s.pts.map(([x, z]) => [r1(x), r1(z)]),
}));

writeFileSync(new URL("../src/three/skyline.json", import.meta.url), JSON.stringify(data));
console.log(`wrote ${data.length} footprints (tallest: ${data[0]?.name ?? "?"} ${data[0]?.h} m)`);
