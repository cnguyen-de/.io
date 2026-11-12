/**
 * Turns the model data into GPU buffers: one mesh for all faces (drawn twice — upright, and laid
 * flat as shadows), one instanced set of pen strokes for every line of the drawing, one mesh for
 * water and parks, and the points that carry the towers' lights.
 */
import {
  BufferGeometry,
  Float32BufferAttribute,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  ShapeUtils,
  Vector2
} from "three";
import map from "../data/map.json";
import { PLAN, riedbergArrow } from "../lib/geo";
import { callouts, towers, type Pt, type Solid, type Tower } from "./model";
import { LINE, MODE } from "./shaders";

type V3 = [number, number, number];

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (a: V3): V3 | undefined => {
  const l = Math.hypot(...a);
  return l > 1e-6 ? [a[0] / l, a[1] / l, a[2] / l] : undefined;
};

const UP: V3 = [0, 1, 0];
const DOWN: V3 = [0, -1, 0];
/** Faces that meet at more than this angle get a drawn edge; flatter ones only show as silhouettes. */
const CREASE = Math.cos((28 * Math.PI) / 180);

// --- Strokes ----------------------------------------------------------------------------------------

class Strokes {
  private a: number[] = [];
  private b: number[] = [];
  private n1: number[] = [];
  private n2: number[] = [];
  private info: number[] = [];
  private style: number[] = [];

  add(a: V3, b: V3, cls: number, mode: number = MODE.always, n1: V3 = UP, n2: V3 = UP, tower?: Tower, rank = 0) {
    this.a.push(...a);
    this.b.push(...b);
    this.n1.push(...n1);
    this.n2.push(...n2);
    this.info.push(tower?.centre[0] ?? 0, tower?.centre[1] ?? 0, tower?.id ?? -1, rank);
    this.style.push(cls, mode + (tower ? MODE.grows : 0));
  }

  /** A polyline on the ground. */
  path(pts: Pt[], cls: number, closed = false) {
    for (let i = 0; i + 1 < pts.length + (closed ? 1 : 0); i++) {
      const p = pts[i];
      const q = pts[(i + 1) % pts.length];
      this.add([p[0], 0, p[1]], [q[0], 0, q[1]], cls);
    }
  }

  geometry() {
    const g = new InstancedBufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute([0, -1, 0, 1, -1, 0, 1, 1, 0, 0, 1, 0], 3));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    const set = (name: string, data: number[], size: number) =>
      g.setAttribute(name, new InstancedBufferAttribute(new Float32Array(data), size));
    set("aA", this.a, 3);
    set("aB", this.b, 3);
    set("aN1", this.n1, 3);
    set("aN2", this.n2, 3);
    set("aInfo", this.info, 4);
    set("aStyle", this.style, 2);
    g.instanceCount = this.style.length / 2;
    return g;
  }
}

// --- Towers ---------------------------------------------------------------------------------------

interface Faces {
  position: number[];
  normal: number[];
  info: number[];
}

function buildSolid(solid: Solid, tower: Tower, faces: Faces, strokes: Strokes) {
  const { rings } = solid;
  const n = rings[0].pts.length;
  const at = (k: number, i: number): V3 => {
    const p = rings[k].pts[i % n];
    return [p[0], rings[k].y, p[1]];
  };
  const vertex = (p: V3, normal: V3, u: number) => {
    faces.position.push(...p);
    faces.normal.push(...normal);
    faces.info.push(tower.centre[0], tower.centre[1], tower.id, u);
  };

  // Distance along the footprint, so façades can be divided into bays.
  const along = [0];
  for (let i = 0; i < n; i++) along.push(along[i] + Math.hypot(...sub(at(0, i + 1), at(0, i))));

  // Walls: one quad per footprint edge and level.
  const walls: (V3 | undefined)[][] = [];
  for (let k = 0; k + 1 < rings.length; k++) {
    walls.push([]);
    for (let i = 0; i < n; i++) {
      const [a0, b0, a1, b1] = [at(k, i), at(k, i + 1), at(k + 1, i), at(k + 1, i + 1)];
      const normal = unit(cross(add(sub(a1, a0), sub(b1, b0)), add(sub(b0, a0), sub(b1, a1))));
      walls[k].push(normal);
      if (!normal) continue;
      for (const [p, u] of [[a0, along[i]], [a1, along[i]], [b1, along[i + 1]], [a0, along[i]], [b1, along[i + 1]], [b0, along[i + 1]]] as [V3, number][]) vertex(p, normal, u); // prettier-ignore
    }
  }

  // Roof.
  const last = rings.length - 1;
  if (solid.cap) {
    const outline = rings[last].pts.map(([x, z]) => new Vector2(x, z));
    for (const tri of ShapeUtils.triangulateShape(outline, [])) for (const i of tri) vertex(at(last, i), UP, -1);
  }

  // Edges.
  const edge = (a: V3, b: V3, n1: V3 | undefined, n2: V3 | undefined, always = false) => {
    const [m1, m2] = [n1 ?? n2, n2 ?? n1];
    if (!m1 || !m2 || Math.hypot(...sub(a, b)) < 0.02) return;
    const crease = always || dot(m1, m2) < CREASE;
    strokes.add(a, b, LINE.edge, crease ? MODE.always : MODE.silhouette, m1, m2, tower);
  };
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < rings.length; k++) {
      // Along the ring …
      const below = k > 0 ? walls[k - 1][i] : rings[0].y > 0 ? DOWN : undefined;
      const above = k < last ? walls[k][i] : solid.cap ? UP : undefined;
      if (below || k === 0) edge(at(k, i), at(k, i + 1), below, above, k === 0);
      // … and up to the next one.
      if (k < last) edge(at(k, i), at(k + 1, i), walls[k][(i + n - 1) % n], walls[k][i]);
    }
  }
}

// --- Base map -------------------------------------------------------------------------------------

/** Polylines are stored as steps from point to point (see scripts/fetch-map.mjs). */
function decode(flat: number[]): Pt[] {
  const pts: Pt[] = [];
  let [x, z] = [0, 0];
  for (let i = 0; i < flat.length; i += 2) {
    x += flat[i];
    z += flat[i + 1];
    pts.push([x, z]);
  }
  return pts;
}

function buildGround(strokes: Strokes) {
  const position: number[] = [];
  const kind: number[] = [];
  const fill = (polygons: number[][][], k: number, outline?: number) => {
    for (const polygon of polygons) {
      const [outer, ...holes] = polygon.map(decode);
      const all = [outer, ...holes].flat();
      const vec = (ring: Pt[]) => ring.map(([x, z]) => new Vector2(x, z));
      for (const tri of ShapeUtils.triangulateShape(vec(outer), holes.map(vec))) {
        for (const i of tri) {
          position.push(all[i][0], 0, all[i][1]);
          kind.push(k);
        }
      }
      if (outline !== undefined) for (const ring of [outer, ...holes]) strokes.path(ring, outline, true);
    }
  };
  fill(map.parks, 1);
  fill(map.water, 0, LINE.shore);

  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(position, 3));
  g.setAttribute("aKind", new Float32BufferAttribute(kind, 1));
  return g;
}

// --- Everything -------------------------------------------------------------------------------------

export function build() {
  const strokes = new Strokes();

  // Strokes are laid down in class order; the survey grid comes first, every 500 m.
  for (let v = -3500; v <= 3500; v += 500) {
    strokes.add([v, 0, -3600], [v, 0, 3200], LINE.grid);
    strokes.add([-3500, 0, v], [3800, 0, v], LINE.grid);
  }
  for (const line of map.minor) strokes.path(decode(line), LINE.minor);
  for (const line of map.rail) strokes.path(decode(line), LINE.rail);
  for (const line of map.major) strokes.path(decode(line), LINE.major);
  const ground = buildGround(strokes);

  const data: Faces = { position: [], normal: [], info: [] };
  for (const tower of towers) for (const solid of tower.solids) buildSolid(solid, tower, data, strokes);
  const faces = new BufferGeometry();
  faces.setAttribute("position", new Float32BufferAttribute(data.position, 3));
  faces.setAttribute("normal", new Float32BufferAttribute(data.normal, 3));
  faces.setAttribute("aInfo", new Float32BufferAttribute(data.info, 4));

  // Leaders of the callouts: from just above the roof up to where the text sits.
  for (const c of callouts)
    strokes.add([c.x, c.top + 7, c.z], [c.x, c.at, c.z], LINE.leader, MODE.always, UP, UP, towers[c.id], c.rank);

  // Site plan annotations: the scale bar and the arrow towards Riedbergplatz.
  const x0 = PLAN.minX + 150;
  const z0 = PLAN.minZ + PLAN.height - 150;
  strokes.path([[x0, z0 - 40], [x0, z0], [x0 + 500, z0], [x0 + 500, z0 - 40]], LINE.planInk); // prettier-ignore
  strokes.path([[x0 + 250, z0 - 28], [x0 + 250, z0]], LINE.planInk); // prettier-ignore
  const arrow = riedbergArrow();
  strokes.path([arrow.tail, arrow.head], LINE.planRed);
  strokes.path([arrow.barbs[0], arrow.head, arrow.barbs[1]], LINE.planRed);

  // Obstruction lights on everything tall enough to need them.
  const lights: number[] = [];
  const lightInfo: number[] = [];
  towers
    .filter((t) => t.top >= 140)
    .forEach((t, i) => {
      lights.push(t.centre[0], t.top + 2, t.centre[1]);
      lightInfo.push(t.centre[0], t.centre[1], (i * 0.618) % 1, t.top > 250 ? 15 : 11);
    });
  const beacons = new BufferGeometry();
  beacons.setAttribute("position", new Float32BufferAttribute(lights, 3));
  beacons.setAttribute("aInfo", new Float32BufferAttribute(lightInfo, 4));

  return { faces, ground, beacons, strokes: strokes.geometry() };
}
