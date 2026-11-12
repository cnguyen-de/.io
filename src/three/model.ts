/**
 * The city model as plain data, shared by the pages (which place labels on it at build time) and
 * the WebGL scene (which draws it). Nothing in here needs three.js.
 *
 * Every high-rise is a stack of rings ("loft"): a footprint repeated at several heights, where a
 * ring may be scaled, turned or redrawn — enough for prisms, tapered shafts, spires, domes and the
 * twisted towers of the ECB. Units are metres, +x = east, +z = south, +y = up (see lib/geo.ts).
 */
import raw from "../data/skyline.json";
import { toLocal } from "../lib/geo";

export type Pt = [x: number, z: number];

export interface Ring {
  y: number;
  pts: Pt[];
}

export interface Solid {
  /** Bottom to top; all rings have the same number of points. */
  rings: Ring[];
  /** Whether the last ring is closed by a flat roof. */
  cap: boolean;
}

export interface Tower {
  id: number;
  name?: string;
  /** Centre of the tallest part: where the label leader stands and from where the tower grows. */
  centre: Pt;
  top: number;
  solids: Solid[];
  min: [number, number, number];
  max: [number, number, number];
}

interface Part {
  name?: string;
  h: number;
  minH?: number;
  roof?: string;
  roofH?: number;
  pts: number[][];
}

// --- Footprint helpers ----------------------------------------------------------------------------

function signedArea(pts: Pt[]) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, z1] = pts[i];
    const [x2, z2] = pts[(i + 1) % pts.length];
    a += x1 * z2 - x2 * z1;
  }
  return a / 2;
}

export function centroid(pts: Pt[]): Pt {
  let [x, z] = [0, 0];
  for (const p of pts) {
    x += p[0] / pts.length;
    z += p[1] / pts.length;
  }
  return [x, z];
}

/** Drops repeated points and winds the ring so that its signed area in (x, z) is positive. */
function clean(pts: number[][]): Pt[] {
  const out: Pt[] = [];
  for (const [x, z] of pts) {
    const last = out[out.length - 1];
    if (!last || Math.hypot(last[0] - x, last[1] - z) > 0.05) out.push([x, z]);
  }
  if (out.length > 1 && Math.hypot(out[0][0] - out[out.length - 1][0], out[0][1] - out[out.length - 1][1]) < 0.05)
    out.pop();
  return signedArea(out) < 0 ? out.reverse() : out;
}

const scaled = (pts: Pt[], s: number, [cx, cz]: Pt = centroid(pts)): Pt[] =>
  pts.map(([x, z]) => [cx + (x - cx) * s, cz + (z - cz) * s]);

const circle = (r: number, segments: number): Pt[] =>
  Array.from({ length: segments }, (_, i) => {
    const a = (i / segments) * Math.PI * 2;
    return [Math.cos(a) * r, Math.sin(a) * r];
  });

const rect = (x0: number, z0: number, x1: number, z1: number): Pt[] => [
  [x0, z0],
  [x1, z0],
  [x1, z1],
  [x0, z1]
];

/** Turns by `angle` around the origin, then moves by (dx, dz). */
const placed = (pts: Pt[], angle: number, dx = 0, dz = 0): Pt[] =>
  pts.map(([x, z]) => [x * Math.cos(angle) - z * Math.sin(angle) + dx, x * Math.sin(angle) + z * Math.cos(angle) + dz]);

// --- High-rises from OpenStreetMap ---------------------------------------------------------------

function solidOf(p: Part): Solid | undefined {
  const pts = clean(p.pts);
  if (pts.length < 3) return;
  const base = p.minH ?? 0;
  if (p.roof === "pyramidal" && p.roofH) {
    const eave = p.h - p.roofH;
    return { rings: [{ y: base, pts }, { y: eave, pts }, { y: p.h, pts: scaled(pts, 0.01) }], cap: false }; // prettier-ignore
  }
  if (p.roof === "dome" && p.roofH) {
    const eave = p.h - p.roofH;
    const rings: Ring[] = [{ y: base, pts }, { y: eave, pts }]; // prettier-ignore
    for (const deg of [25, 50, 72]) {
      const t = (deg * Math.PI) / 180;
      rings.push({ y: eave + p.roofH * Math.sin(t), pts: scaled(pts, Math.cos(t)) });
    }
    return { rings, cap: true };
  }
  return { rings: [{ y: base, pts }, { y: p.h, pts }], cap: true }; // prettier-ignore
}

// --- Landmarks that the footprint data lacks, modelled by hand -----------------------------------

interface Landmark {
  name: string;
  lat: number;
  lon: number;
  /** Solids around the landmark's own origin. */
  solids: Solid[];
}

/** Rings of a round shaft from a profile of [radius, height] pairs. */
const lathe = (profile: [r: number, y: number][], segments: number): Ring[] =>
  profile.map(([r, y]) => ({ y, pts: circle(r, segments) }));

/** One of the ECB's two slabs: a long footprint that turns as it rises. */
function twisted(w: number, d: number, dz: number, height: number, twist: number, lean: number): Solid {
  const levels = 6;
  return {
    rings: Array.from({ length: levels + 1 }, (_, i) => {
      const t = i / levels;
      return { y: height * t, pts: placed(rect(-w / 2, -d / 2, w / 2, d / 2), twist * t, 0, dz + lean * t) };
    }),
    cap: true
  };
}

const LANDMARKS: Landmark[] = [
  {
    name: "Europaturm",
    lat: 50.1253,
    lon: 8.6563,
    solids: [
      { rings: lathe([[12, 0], [5, 214], [29.5, 226], [29.5, 236], [9, 246], [3, 262], [2, 295]], 20), cap: true }, // prettier-ignore
      { rings: lathe([[0.8, 295], [0.8, 337]], 5), cap: true } // prettier-ignore
    ]
  },
  {
    name: "Kaiserdom",
    lat: 50.1107,
    lon: 8.6853,
    solids: [
      // West tower, stepping in towards the spire.
      {
        rings: ([[11, 0], [11, 52], [8, 54], [8, 70], [5, 74], [3, 84], [0.15, 95]] as const).map(([r, y]) => ({ y, pts: rect(-r, -r, r, r) })), // prettier-ignore
        cap: false
      },
      // Nave and transept under ridged roofs.
      { rings: [{ y: 0, pts: rect(11, -13, 68, 13) }, { y: 28, pts: rect(11, -13, 68, 13) }, { y: 40, pts: rect(11, -0.6, 64, 0.6) }], cap: true }, // prettier-ignore
      { rings: [{ y: 0, pts: rect(36, -31, 52, 31) }, { y: 28, pts: rect(36, -31, 52, 31) }, { y: 40, pts: rect(43.4, -27, 44.6, 27) }], cap: true } // prettier-ignore
    ]
  },
  {
    name: "EZB",
    lat: 50.109,
    lon: 8.7031,
    solids: [
      twisted(58, 19, -13, 185, 0.2, -5),
      twisted(58, 19, 13, 165, -0.2, 5),
      // The Großmarkthalle along the river.
      { rings: [{ y: 0, pts: rect(-125, 48, 95, 98) }, { y: 23, pts: rect(-125, 48, 95, 98) }], cap: true } // prettier-ignore
    ].map((s) => ({ ...s, rings: s.rings.map((r) => ({ y: r.y, pts: placed(r.pts, 0.25) })) }))
  }
];

// --- The model -------------------------------------------------------------------------------------

function collect(): Tower[] {
  // Parts of the same named building belong together; anonymous parts stand alone.
  const groups = new Map<string, Solid[]>();
  (raw as Part[]).forEach((p, i) => {
    const solid = solidOf(p);
    if (!solid) return;
    const key = p.name ?? `#${i}`;
    groups.set(key, [...(groups.get(key) ?? []), solid]);
  });

  const list: Omit<Tower, "id">[] = [];
  const add = (name: string | undefined, solids: Solid[]) => {
    const min: [number, number, number] = [Infinity, 0, Infinity];
    const max: [number, number, number] = [-Infinity, 0, -Infinity];
    let tallest = solids[0];
    for (const s of solids) {
      const top = s.rings[s.rings.length - 1].y;
      if (top > tallest.rings[tallest.rings.length - 1].y) tallest = s;
      max[1] = Math.max(max[1], top);
      for (const [x, z] of s.rings[0].pts) {
        min[0] = Math.min(min[0], x);
        min[2] = Math.min(min[2], z);
        max[0] = Math.max(max[0], x);
        max[2] = Math.max(max[2], z);
      }
    }
    list.push({ name, centre: centroid(tallest.rings[tallest.rings.length - 1].pts), top: max[1], solids, min, max });
  };

  for (const [key, solids] of groups) add(key.startsWith("#") ? undefined : key, solids);
  for (const l of LANDMARKS) {
    const [x, z] = toLocal(l.lat, l.lon);
    add(
      l.name,
      l.solids.map((s) => ({ ...s, rings: s.rings.map((r) => ({ y: r.y, pts: placed(r.pts, 0, x, z) })) }))
    );
  }
  return list.map((t, id) => ({ ...t, id }));
}

export const towers = collect();

export const towerNamed = (name: string) => {
  const t = towers.find((c) => c.name === name);
  if (!t) throw new Error(`No tower called ${name}`);
  return t;
};

// --- Annotations -----------------------------------------------------------------------------------

/** Where the model is looked at from. Each is one of the three classic projections of a building. */
export type View = "axo" | "plan" | "elevation";

export interface Callout {
  /** Name in the model data … */
  name: string;
  /** … and, where it differs, on the drawing. */
  label?: Partial<Record<"en" | "de", string>>;
  /** Height (m) at which the leader ends and the text sits. */
  at: number;
  side: "left" | "right";
  /** Lower numbers win when two callouts would overlap. */
  rank: number;
}

/** Towers called out on the axonometric drawing (Fig. 1). */
export const CALLOUTS: Callout[] = [
  { name: "Commerzbank Tower", at: 345, side: "right", rank: 0 },
  { name: "Main Tower", at: 290, side: "left", rank: 1 },
  { name: "Messeturm", at: 300, side: "left", rank: 2 },
  { name: "Europaturm", at: 368, side: "right", rank: 3 },
  { name: "EZB", label: { en: "ECB" }, at: 222, side: "right", rank: 4 },
  { name: "Omniturm", at: 232, side: "right", rank: 5 },
  { name: "Kaiserdom", at: 132, side: "right", rank: 6 }
];

export const callouts = CALLOUTS.map((c) => {
  const t = towerNamed(c.name);
  return { ...c, id: t.id, x: t.centre[0], z: t.centre[1], top: Math.round(t.top) };
});
