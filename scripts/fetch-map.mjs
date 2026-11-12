// Downloads the base map of Frankfurt from OpenStreetMap — streets, railway tracks, the
// Main and its harbour basins, parks — and writes it to src/data/map.json (local metres, same
// projection as src/lib/geo.ts). The 3D model draws it as the linework under the high-rises.
//
//   node scripts/fetch-map.mjs
//
// Run by hand when the data should be refreshed; the site itself never talks to OSM.
// Data © OpenStreetMap contributors, ODbL.
import { writeFileSync } from "node:fs";

const ORIGIN = { lat: 50.1105, lon: 8.67 };
const M_PER_DEG_LAT = 111_200;
const M_PER_DEG_LON = 111_320 * Math.cos((ORIGIN.lat * Math.PI) / 180);

/**
 * Minor streets form a round island of city: those further than RADIUS from CENTRE are dropped.
 * Everything else (main roads, railways, water, parks) covers REGION, a rectangle around the
 * site plan sheet (PLAN in src/lib/geo.ts), which reaches north to Riedberg.
 */
const CENTRE = [150, -250];
const RADIUS = 2900;
const REGION = { minX: -4800, maxX: 3800, minZ: -8400, maxZ: 2700 };

const toBox = ({ minX, maxX, minZ, maxZ }) => [
  (ORIGIN.lat - maxZ / M_PER_DEG_LAT).toFixed(4),
  (ORIGIN.lon + minX / M_PER_DEG_LON).toFixed(4),
  (ORIGIN.lat - minZ / M_PER_DEG_LAT).toFixed(4),
  (ORIGIN.lon + maxX / M_PER_DEG_LON).toFixed(4)
];
const BBOX = toBox(REGION);
const ISLAND = toBox({
  minX: CENTRE[0] - RADIUS,
  maxX: CENTRE[0] + RADIUS,
  minZ: CENTRE[1] - RADIUS,
  maxZ: CENTRE[1] + RADIUS
});

const MAJOR = ["motorway", "trunk", "primary", "secondary", "motorway_link", "trunk_link", "primary_link"];
const MINOR = ["tertiary", "residential", "unclassified", "living_street", "pedestrian"];

const query = `
[out:json][timeout:180];
(
  way["highway"~"^(${MAJOR.join("|")})$"](${BBOX});
  way["highway"~"^(${MINOR.join("|")})$"](${ISLAND});
  way["railway"="rail"]["tunnel"!="yes"](${BBOX});
  way["natural"="water"](${BBOX});
  relation["natural"="water"](${BBOX});
  way["leisure"="park"](${BBOX});
  relation["leisure"="park"](${BBOX});
  way["landuse"="cemetery"](${BBOX});
);
out geom;`;

const MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter"
];

async function overpass() {
  for (let attempt = 0; attempt < 8; attempt++) {
    const url = MIRRORS[attempt % MIRRORS.length];
    const res = await fetch(url, {
      method: "POST",
      headers: { "User-Agent": "osm-data-script/1.0", "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ data: query })
    }).catch((err) => ({ ok: false, status: err.message }));
    if (res.ok) {
      try {
        return await res.json();
      } catch (err) {
        console.warn(`${url}: bad response (${err.message}), retrying…`);
        continue;
      }
    }
    console.warn(`${url}: ${res.status}, retrying…`);
    await new Promise((r) => setTimeout(r, 2500 * (attempt + 1)));
  }
  throw new Error("Overpass unavailable");
}

const local = ({ lat, lon }) => [(lon - ORIGIN.lon) * M_PER_DEG_LON, -(lat - ORIGIN.lat) * M_PER_DEG_LAT];
const onIsland = ([x, z]) => Math.hypot(x - CENTRE[0], z - CENTRE[1]) <= RADIUS;
const inRegion = ([x, z]) => x >= REGION.minX && x <= REGION.maxX && z >= REGION.minZ && z <= REGION.maxZ;

/** Douglas–Peucker. */
function simplify(pts, tolerance) {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, az] = pts[a];
    const [bx, bz] = pts[b];
    const len = Math.hypot(bx - ax, bz - az) || 1;
    let worst = 0;
    let index = -1;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((pts[i][0] - ax) * (bz - az) - (pts[i][1] - az) * (bx - ax)) / len;
      if (d > worst) [worst, index] = [d, i];
    }
    if (worst > tolerance) {
      keep[index] = 1;
      stack.push([a, index], [index, b]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

/** The point where segment a→b crosses the edge of an area (by bisection, for any shape). */
function crossing(a, b, inside) {
  const at = (t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const startIn = inside(a);
  let [lo, hi] = [0, 1];
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (inside(at(mid)) === startIn) lo = mid;
    else hi = mid;
  }
  return at(startIn ? lo : hi);
}

/**
 * Cuts a polyline into the runs that lie inside an area, cut exactly at its edge, so that the runs
 * inside and outside the island meet without a gap.
 */
function clipLine(pts, inside) {
  const runs = [];
  let run = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const prev = pts[i - 1];
    if (inside(p)) {
      if (!run.length && prev) run.push(crossing(prev, p, inside));
      run.push(p);
    } else {
      if (run.length && prev) run.push(crossing(prev, p, inside));
      if (run.length > 1) runs.push(run);
      run = [];
    }
  }
  if (run.length > 1) runs.push(run);
  return runs;
}

/** Clips a ring to the region (Sutherland–Hodgman). */
function clipRing(ring) {
  const edges = [
    [(p) => p[0] >= REGION.minX, 0, REGION.minX],
    [(p) => p[0] <= REGION.maxX, 0, REGION.maxX],
    [(p) => p[1] >= REGION.minZ, 1, REGION.minZ],
    [(p) => p[1] <= REGION.maxZ, 1, REGION.maxZ]
  ];
  let out = ring;
  for (const [keep, axis, value] of edges) {
    const input = out;
    out = [];
    for (let i = 0; i < input.length; i++) {
      const a = input[i];
      const b = input[(i + 1) % input.length];
      const cut = () => {
        const t = (value - a[axis]) / (b[axis] - a[axis]);
        return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      };
      if (keep(a)) {
        out.push(a);
        if (!keep(b)) out.push(cut());
      } else if (keep(b)) out.push(cut());
    }
    if (out.length < 3) return [];
  }
  return out;
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

/** Joins the member ways of a multipolygon into closed rings. */
function stitch(ways) {
  const rings = [];
  const open = ways.map((w) => [...w]);
  const same = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.5;
  while (open.length) {
    let ring = open.pop();
    for (let grown = true; grown && !same(ring[0], ring[ring.length - 1]);) {
      grown = false;
      for (let i = 0; i < open.length; i++) {
        const w = open[i];
        const end = ring[ring.length - 1];
        if (same(end, w[0])) ring = ring.concat(w.slice(1));
        else if (same(end, w[w.length - 1])) ring = ring.concat([...w].reverse().slice(1));
        else continue;
        open.splice(i, 1);
        grown = true;
        break;
      }
    }
    if (ring.length > 3 && same(ring[0], ring[ring.length - 1])) rings.push(ring.slice(0, -1));
  }
  return rings;
}

/** Polylines are stored as whole metres: the first point absolute, every further one as a step. */
const flat = (pts) => {
  const out = [];
  let [px, pz] = [0, 0];
  for (const [x, z] of pts) {
    const [rx, rz] = [Math.round(x), Math.round(z)];
    if (out.length && rx === px && rz === pz) continue;
    out.push(rx - px, rz - pz);
    [px, pz] = [rx, rz];
  }
  return out;
};

/** Joins ways that continue each other into longer polylines (fewer, longer strokes). */
function chain(lines) {
  const key = ([x, z]) => `${Math.round(x)},${Math.round(z)}`;
  const ends = new Map();
  const note = (line) => {
    for (const k of [key(line[0]), key(line[line.length - 1])]) ends.set(k, [...(ends.get(k) ?? []), line]);
  };
  const forget = (line) => {
    for (const k of [key(line[0]), key(line[line.length - 1])])
      ends.set(
        k,
        (ends.get(k) ?? []).filter((l) => l !== line)
      );
  };
  lines.forEach(note);
  const used = new Set();
  const out = [];
  for (const start of lines) {
    if (used.has(start)) continue;
    used.add(start);
    forget(start);
    let line = start;
    for (let flipped = 0; flipped < 2;) {
      const tail = line[line.length - 1];
      const before = line[line.length - 2];
      const dir = [tail[0] - before[0], tail[1] - before[1]];
      // Continue with the way that carries on straightest.
      let best = null;
      let bestTurn = -0.2;
      for (const next of ends.get(key(tail)) ?? []) {
        const forward = key(next[0]) === key(tail);
        const a = forward ? next[0] : next[next.length - 1];
        const b = forward ? next[1] : next[next.length - 2];
        const d = [b[0] - a[0], b[1] - a[1]];
        const turn = (dir[0] * d[0] + dir[1] * d[1]) / ((Math.hypot(...dir) || 1) * (Math.hypot(...d) || 1));
        if (turn > bestTurn) [best, bestTurn] = [{ next, forward }, turn];
      }
      if (!best) {
        line = [...line].reverse();
        flipped++;
        continue;
      }
      used.add(best.next);
      forget(best.next);
      line = line.concat((best.forward ? best.next : [...best.next].reverse()).slice(1));
    }
    out.push(line);
  }
  return out;
}
const closedRing = (geometry) => {
  const pts = geometry.map(local);
  return pts.slice(0, -1);
};

const { elements } = await overpass();

/**
 * Off the island the map is only ever seen at site-plan scale, around Riedberg: it is drawn
 * coarser (looser simplification, only the larger roads, parks and water).
 */
const COARSE = { tolerance: 10, park: 60_000, water: 20_000, roads: ["motorway", "trunk", "primary"] };
const offIsland = (p) => inRegion(p) && !onIsland(p);

const major = [];
const majorCoarse = [];
const minor = [];
const rail = [];
const railCoarse = [];
/** Polygons: [outer, ...holes], each a flat ring. */
const water = [];
const parks = [];

function addPolygon(target, outer, holes, tolerance, minArea) {
  const clipped = clipRing(outer);
  const centre = clipped.reduce(([x, z], p) => [x + p[0] / clipped.length, z + p[1] / clipped.length], [0, 0]);
  if (clipped.length && !onIsland(centre)) {
    tolerance = COARSE.tolerance;
    minArea = target === parks ? COARSE.park : COARSE.water;
  }
  const ring = simplify(clipped, tolerance);
  if (ring.length < 3 || Math.abs(area(ring)) < minArea) return;
  if (!ring.some(inRegion)) return;
  const inner = holes
    .map((h) => simplify(clipRing(h), tolerance))
    .filter((h) => h.length >= 3 && Math.abs(area(h)) > 400);
  target.push([ring, ...inner].map(flat));
}

for (const e of elements) {
  const t = e.tags ?? {};
  if (e.type === "way" && e.geometry) {
    if (t.highway) {
      if (t.tunnel === "yes" || t.area === "yes") continue;
      const pts = e.geometry.map(local);
      if (!MAJOR.includes(t.highway)) minor.push(...clipLine(pts, onIsland));
      else {
        major.push(...clipLine(pts, onIsland));
        if (COARSE.roads.includes(t.highway)) majorCoarse.push(...clipLine(pts, offIsland));
      }
    } else if (t.railway) {
      if (t.service === "siding" || t.service === "yard" || t.service === "spur") continue;
      const pts = e.geometry.map(local);
      rail.push(...clipLine(pts, onIsland));
      railCoarse.push(...clipLine(pts, offIsland));
    } else if (t.natural === "water" && e.geometry.length > 3) {
      addPolygon(water, closedRing(e.geometry), [], 2, 2500);
    } else if ((t.leisure === "park" || t.landuse === "cemetery") && e.geometry.length > 3) {
      addPolygon(parks, closedRing(e.geometry), [], 3, 6000);
    }
  } else if (e.type === "relation" && e.members) {
    const ways = (role) =>
      e.members.filter((m) => m.type === "way" && m.geometry && m.role === role).map((m) => m.geometry.map(local));
    const outers = stitch(ways("outer"));
    const inners = stitch(ways("inner"));
    const pointIn = ([x, z], poly) => {
      let hit = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const [xi, zi] = poly[i];
        const [xj, zj] = poly[j];
        if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) hit = !hit;
      }
      return hit;
    };
    for (const outer of outers) {
      const holes = inners.filter((h) => pointIn(h[0], outer));
      if (t.natural === "water") addPolygon(water, outer, holes, 2, 2500);
      else addPolygon(parks, outer, holes, 3, 6000);
    }
  }
}

const strokes = (lines, tolerance = 1.6) => chain(lines).map((line) => flat(simplify(line, tolerance)));
const data = {
  major: [...strokes(major), ...strokes(majorCoarse, COARSE.tolerance)],
  minor: strokes(minor),
  rail: [...strokes(rail), ...strokes(railCoarse, COARSE.tolerance)],
  water,
  parks
};
const json = JSON.stringify(data);
writeFileSync(new URL("../src/data/map.json", import.meta.url), json);
const points = (lines) => lines.flat(2).length / 2;
console.log(
  `wrote ${(json.length / 1024).toFixed(0)} kB — ` +
    Object.entries(data)
      .map(([k, v]) => `${k}: ${v.length} (${points(v)} pts)`)
      .join(", ")
);
