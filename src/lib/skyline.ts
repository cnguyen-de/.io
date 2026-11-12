/**
 * Turns the OpenStreetMap high-rise footprints in src/data/skyline.json into two drawings, both at
 * build time so the page ships plain SVG:
 *
 *  - an elevation: the skyline seen from the south, every building part projected onto the x axis
 *  - a site plan: the same footprints from above, with the river Main
 *
 * All coordinates are metres (see geo.ts); nothing is exaggerated.
 */
import raw from "../data/skyline.json";
import { CITY, PLAN, RIVER, toLocal } from "./geo";

interface Part {
  name?: string;
  h: number;
  minH?: number;
  roof?: string;
  roofH?: number;
  pts: number[][];
}

const parts = raw as Part[];
const r = (v: number) => Math.round(v * 10) / 10;

// --- Elevation ------------------------------------------------------------------------------------

/** The elevation sheet: `width` metres of city, `height` metres of sky. The ground is y = height. */
export const SHEET = { minX: -1700, width: 4200, height: 400 };
const y = (h: number) => r(SHEET.height - h);

export interface Shape {
  /** Outline of one building part. */
  d: string;
  /** Vertical edges of the south façade, if the part is big enough to show them. */
  facade?: string;
}

export interface Building {
  name?: string;
  /** Centre of the tallest part and the height of its tip. */
  x: number;
  top: number;
  /** 0 = far north, 1 = closest to the viewer. */
  depth: number;
  shapes: Shape[];
}

function outline(p: Part): Shape {
  const xs = p.pts.map((q) => q[0]);
  const x0 = r(Math.min(...xs));
  const x1 = r(Math.max(...xs));
  const base = y(p.minH ?? 0);
  const roofH = p.roof === "pyramidal" || p.roof === "dome" ? (p.roofH ?? 0) : 0;
  const eave = y(p.h - roofH);

  let roof = `H${x1}`;
  if (p.roof === "pyramidal") roof = `L${r((x0 + x1) / 2)} ${y(p.h)}L${x1} ${eave}`;
  if (p.roof === "dome") roof = `A${r((x1 - x0) / 2)} ${roofH} 0 0 1 ${x1} ${eave}`;
  const d = `M${x0} ${base}V${eave}${roof}V${base}${p.minH ? "Z" : ""}`;

  // Corners of the footprint that face the viewer show up as vertical lines on the façade.
  let facade: string | undefined;
  if (x1 - x0 >= 24 && p.h - (p.minH ?? 0) >= 60) {
    const midZ = p.pts.reduce((s, q) => s + q[1], 0) / p.pts.length;
    const edges: number[] = [];
    for (const [x, z] of p.pts) {
      if (z < midZ || x < x0 + 4 || x > x1 - 4) continue;
      if (edges.every((e) => Math.abs(e - x) > 5)) edges.push(r(x));
    }
    if (edges.length) facade = edges.map((x) => `M${x} ${base}V${eave}`).join("");
  }
  return { d, facade };
}

/** Landmarks that are missing from the footprint data, as silhouettes: [offset from centre, height]. */
const HAND_DRAWN: { name: string; lat: number; lon: number; outlines: [number, number][][] }[] = [
  {
    name: "Europaturm",
    lat: 50.1253,
    lon: 8.6563,
    outlines: [
      [[-12, 0], [-5, 214], [-29.5, 226], [-29.5, 236], [-9, 246], [-3, 262], [-2, 295], [-0.8, 295], [-0.8, 337],
       [0.8, 337], [0.8, 295], [2, 295], [3, 262], [9, 246], [29.5, 236], [29.5, 226], [5, 214], [12, 0]], // prettier-ignore
    ],
  },
  {
    name: "Kaiserdom",
    lat: 50.1107,
    lon: 8.6853,
    outlines: [
      [[4, 0], [4, 28], [12, 40], [58, 40], [66, 28], [66, 0]], // nave
      [[-11, 0], [-11, 52], [-8, 54], [-8, 70], [-5, 74], [-3, 84], [0, 95], [3, 84], [5, 74], [8, 70], [8, 54], [11, 52], [11, 0]], // prettier-ignore
    ],
  },
  {
    name: "EZB",
    lat: 50.109,
    lon: 8.7031,
    outlines: [
      [[-31, 0], [-27, 185], [-2, 180], [-2, 0]],
      [[2, 0], [2, 165], [26, 160], [31, 0]],
    ],
  },
];

function collect(): Building[] {
  // Parts of the same named building rise together; anonymous parts stand alone.
  const groups = new Map<string, Part[]>();
  parts.forEach((p, i) => {
    const key = p.name ?? `#${i}`;
    groups.set(key, [...(groups.get(key) ?? []), p]);
  });

  const near = (p: Part) => Math.max(...p.pts.map((q) => q[1]));
  const list = [...groups.values()].map((group) => {
    const tallest = group.reduce((a, b) => (b.h > a.h ? b : a));
    const xs = tallest.pts.map((q) => q[0]);
    return {
      name: group[0].name,
      x: r((Math.min(...xs) + Math.max(...xs)) / 2),
      top: tallest.h,
      z: Math.max(...group.map(near)),
      shapes: [...group].sort((a, b) => near(a) - near(b)).map(outline),
    };
  });

  for (const l of HAND_DRAWN) {
    const [x, z] = toLocal(l.lat, l.lon);
    list.push({
      name: l.name,
      x: r(x),
      top: Math.max(...l.outlines.flat().map((q) => q[1])),
      z,
      shapes: l.outlines.map((o) => ({ d: "M" + o.map(([dx, h]) => `${r(x + dx)} ${y(h)}`).join("L") })),
    });
  }

  // Painter's order: far buildings first, so nearer ones cover them.
  list.sort((a, b) => a.z - b.z);
  const zs = list.map((b) => b.z);
  const [far, close] = [Math.min(...zs), Math.max(...zs)];
  return list.map(({ z, ...b }) => ({ ...b, depth: (z - far) / (close - far) }));
}

export const buildings = collect();

/**
 * Annotated towers: where the leader ends (`at`, metres), which side the text sits on, and the
 * smallest breakpoint at which the sheet shows enough of the city to fit the label.
 */
const ANNOTATED: { name: string; at: number; side: "left" | "right"; from?: "sm" | "lg" }[] = [
  { name: "Europaturm", at: 356, side: "right", from: "lg" },
  { name: "Messeturm", at: 296, side: "left", from: "lg" },
  { name: "Trianon", at: 216, side: "left", from: "lg" },
  { name: "Main Tower", at: 268, side: "left", from: "sm" },
  { name: "Commerzbank Tower", at: 332, side: "right" },
  { name: "Kaiserdom", at: 128, side: "right", from: "lg" },
  { name: "EZB", at: 216, side: "right", from: "lg" },
];

export const annotations = ANNOTATED.map((a) => {
  const b = buildings.find((c) => c.name === a.name)!;
  return { ...a, x: b.x, top: Math.round(b.top) };
});

// --- Site plan ------------------------------------------------------------------------------------

export { PLAN };

export const plan = {
  footprints: parts
    .filter((p) => !p.minH)
    .map((p) => "M" + p.pts.map(([x, z]) => `${r(x)} ${r(z)}`).join("L") + "Z")
    .join(""),
  river: "M" + RIVER.map(([lat, lon]) => toLocal(lat, lon).map(r).join(" ")).join("L"),
  /** Reference point of the plan: the city centre. */
  centre: toLocal(CITY.lat, CITY.lon).map(r) as [x: number, z: number],
};
