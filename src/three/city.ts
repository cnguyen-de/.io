import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {
  BRIDGES,
  CLIENT_LINKS,
  HQ,
  LANDMARKS,
  RIVER,
  RIVER_WIDTH,
  toLocal,
  type Landmark,
} from "./frankfurt";
import { mulberry32 } from "./utils";

/** Street grid shared by the ground shader, the block generator and traffic. */
const GRID_ANGLE = 0.32;
const BLOCK = 120;
const STREET = 22;
/** Must match warp() in commonGlsl. */
function warp(x: number, z: number): [number, number] {
  return [
    Math.sin(z * 0.0011 + 1.3) * 55 + Math.sin(x * 0.0007) * 30,
    Math.sin(x * 0.0012 + 0.4) * 55 + Math.cos(z * 0.0008) * 30,
  ];
}

/** Inverse of p -> p + warp(p), by fixed-point iteration (the warp is small and smooth). */
function unwarp(x: number, z: number): [number, number] {
  let px = x;
  let pz = z;
  for (let i = 0; i < 3; i++) {
    const [wx, wz] = warp(px, pz);
    px = x - wx;
    pz = z - wz;
  }
  return [px, pz];
}

/** Parks kept free of buildings: lat, lon, radius (m). */
const PARKS: [number, number, number][] = [
  [50.1238, 8.6575, 520], // Grüneburgpark + Palmengarten
  [50.1195, 8.724, 330], // Ostpark
  [50.1287, 8.7018, 180], // Günthersburgpark
  [50.1045, 8.6255, 280], // Rebstockpark
  [50.1435, 8.66, 400], // Volkspark Niddatal
  [50.1165, 8.6925, 120], // Bethmannpark / Wallanlagen
];
/** Centre / extent of the built-up area (ellipse, stretched north to reach the HQ). */
const CITY_CENTER = new THREE.Vector2(300, -2200);
const CITY_RADII = new THREE.Vector2(5200, 6400);

export interface CityLabel {
  name: string;
  position: THREE.Vector3;
  href: string;
}

export interface CityUniforms {
  uTime: { value: number };
  uTech: { value: number };
  uGrow: { value: number };
  uArcs: { value: number };
  uPixelRatio: { value: number };
  uFocus: { value: THREE.Vector3 };
  uFocusAmt: { value: number };
}

const FOG_COLOR = new THREE.Color(0.035, 0.045, 0.085);
const FOG_DENSITY = 0.00012;

const commonGlsl = /* glsl */ `
  uniform float uTime;
  uniform float uTech;
  uniform float uGrow;
  uniform vec3 uFogColor;
  uniform float uFogDensity;
  uniform vec3 uFocus;
  uniform float uFocusAmt;
  float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }
  // Horizon glow shared by the sky and the fog, so the far ground melts into the sky.
  vec3 horizonColor(vec3 dir) {
    return uFogColor + vec3(0.06, 0.045, 0.085) * exp(-abs(dir.y) * 9.0);
  }
  vec3 applyFog(vec3 col, vec3 worldPos) {
    vec3 v = worldPos - cameraPosition;
    float d = length(v) * uFogDensity;
    return mix(col, horizonColor(v / max(length(v), 1e-3)), 1.0 - exp(-d * d));
  }
  // Gentle domain warp so the street grid curves like a real city (mirrored in JS: warp()).
  vec2 warp(vec2 p) {
    return vec2(sin(p.y * 0.0011 + 1.3) * 55.0 + sin(p.x * 0.0007) * 30.0,
                sin(p.x * 0.0012 + 0.4) * 55.0 + cos(p.y * 0.0008) * 30.0);
  }
  float growFactor(vec2 xz) {
    float d = length(xz - vec2(300.0, -1500.0));
    return smoothstep(0.0, 1.0, uGrow * 2.4 - d / 5200.0);
  }
`;

// ---------------------------------------------------------------------------------------------
// Buildings
// ---------------------------------------------------------------------------------------------

const buildingVertex = /* glsl */ `
  ${commonGlsl}
  attribute float aSeed;
  attribute float aTop;
  attribute vec3 aAccent;
  varying vec3 vWorld;
  varying vec3 vNormalW;
  varying float vSeed;
  varying float vTop;
  varying vec3 vAccent;
  void main() {
    mat4 m = modelMatrix;
    #ifdef USE_INSTANCING
      m = modelMatrix * instanceMatrix;
    #endif
    vec4 wp = m * vec4(position, 1.0);
    #ifdef USE_INSTANCING
      float g = growFactor(m[3].xz);
    #else
      float g = growFactor(wp.xz);
    #endif
    wp.y *= g;
    vWorld = wp.xyz;
    vNormalW = normalize(mat3(m) * normal);
    vSeed = aSeed;
    vTop = aTop * g;
    vAccent = aAccent;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const buildingFragment = /* glsl */ `
  ${commonGlsl}
  varying vec3 vWorld;
  varying vec3 vNormalW;
  varying float vSeed;
  varying float vTop;
  varying vec3 vAccent;
  void main() {
    vec3 n = normalize(vNormalW);
    float h = vWorld.y;
    vec3 viewDir = normalize(cameraPosition - vWorld);
    float lm = step(0.01, dot(vAccent, vec3(1.0)));   // landmark tower?
    float fres = pow(1.0 - abs(dot(n, viewDir)), 2.5);
    float wall = 1.0 - smoothstep(0.4, 0.6, abs(n.y));
    float diff = 0.6 + 0.4 * dot(n, normalize(vec3(-0.35, 0.75, 0.45)));

    vec3 concrete = mix(vec3(0.022, 0.026, 0.042), vec3(0.04, 0.046, 0.07), clamp(h / 60.0, 0.0, 1.0));
    // Glass towers reflect the night sky, brighter towards the top.
    vec3 glass = vec3(0.02, 0.034, 0.06) + vec3(0.08, 0.11, 0.2) * fres * wall
      + vec3(0.02, 0.03, 0.05) * clamp(h / vTop, 0.0, 1.0);
    vec3 col = mix(concrete, glass, lm) * diff;

    // Facade coordinates: horizontal distance along the wall, vertical floors.
    vec2 tangent = normalize(vec2(-n.z, n.x) + 1e-5);
    float u = dot(vWorld.xz, tangent);
    vec2 cellSize = mix(vec2(3.6, 3.3), vec2(2.4, 3.9), lm);
    vec2 cell = vec2(u, h) / cellSize;
    vec2 id = floor(cell);
    vec2 f = fract(cell);
    vec2 winMin = mix(vec2(0.2, 0.25), vec2(0.08, 0.12), lm);
    float win = step(winMin.x, f.x) * step(f.x, 1.0 - winMin.x) * step(winMin.y, f.y) * step(f.y, 0.85);
    float r = hash12(id + vSeed * 17.31);
    float litFrac = mix(0.26, 0.42, lm);
    float lit = step(1.0 - litFrac, r);
    vec3 warm = vec3(1.0, 0.66, 0.34);
    vec3 cool = vec3(0.7, 0.84, 1.0);
    vec3 wc = mix(warm, cool, step(mix(0.85, 0.35, lm), hash12(id * 1.37 + vSeed)));
    float aa = clamp(max(fwidth(cell.x), fwidth(cell.y)) * 1.2, 0.0, 1.0);
    float avgWin = litFrac * 0.5;
    float pattern = mix(win * lit * (0.6 + 0.8 * r), avgWin * 0.6, aa);
    col += wc * pattern * mix(0.55, 0.5, lm) * wall;

    // Warm street-level bounce light.
    col += vec3(1.0, 0.55, 0.25) * 0.05 * exp(-h / 14.0) * wall;

    // Lit crowns on the landmark towers: a slim band just below the roof line.
    float crown = smoothstep(vTop - 7.0, vTop - 1.5, h) * (1.0 - smoothstep(vTop + 2.0, vTop + 6.0, h)) * lm;
    col += vAccent * crown * 0.5 * wall + vAccent * 0.2 * crown * (1.0 - wall);

    // Hologram / "tech" look.
    float floors = smoothstep(0.08, 0.0, abs(fract(h / 15.6) - 0.5) - 0.44);
    float scan = exp(-pow((fract(h / 420.0 - uTime * 0.18 + vSeed * 0.05) - 0.5) * 22.0, 2.0));
    float dataWin = win * step(0.55, hash12(id + floor(uTime * 2.0 + r * 8.0))) * (1.0 - aa);
    vec3 cyan = vec3(0.15, 0.75, 1.0);
    vec3 holo = vec3(0.008, 0.022, 0.05)
      + cyan * (0.18 * floors * wall + 1.0 * scan * wall + 0.8 * fres * wall + 0.06 * (1.0 - wall) + 0.45 * dataWin * wall)
      + vAccent * crown * 0.6;
    // While a tower is in focus, the rest of the hologram city steps back.
    col = mix(col, holo * (1.0 - 0.45 * uFocusAmt), uTech);

    // Focused tower (services tour): bright scanning hologram.
    float inFocus = uFocusAmt * (1.0 - smoothstep(45.0, 70.0, length(vWorld.xz - uFocus.xz)));
    float sweep = exp(-pow((fract(h / 90.0 - uTime * 0.5) - 0.5) * 10.0, 2.0));
    vec3 focusCol = vec3(0.35, 0.9, 1.0) * (0.35 + 0.9 * sweep + 0.8 * fres) * wall
      + vec3(0.6, 0.95, 1.0) * win * lit * 0.8 * wall;
    col = mix(col, focusCol, inFocus * 0.85);

    gl_FragColor = vec4(applyFog(col, vWorld), 1.0);
  }
`;

function makeUniforms(pixelRatio: number): CityUniforms & Record<string, THREE.IUniform> {
  return {
    uTime: { value: 0 },
    uTech: { value: 0 },
    uGrow: { value: 1 },
    uArcs: { value: 0 },
    uPixelRatio: { value: pixelRatio },
    uFocus: { value: new THREE.Vector3() },
    uFocusAmt: { value: 0 },
    uFogColor: { value: FOG_COLOR },
    uFogDensity: { value: FOG_DENSITY },
  };
}

// --- landmark geometry helpers -----------------------------------------------------------------

function roundedPolygon(points: THREE.Vector2[], radius: number, segs = 6) {
  const shape = new THREE.Shape();
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const p = points[i];
    const prev = points[(i + n - 1) % n];
    const next = points[(i + 1) % n];
    const a = prev.clone().sub(p).normalize().multiplyScalar(radius).add(p);
    const b = next.clone().sub(p).normalize().multiplyScalar(radius).add(p);
    for (let s = 0; s <= segs; s++) {
      const t = s / segs;
      // quadratic bezier a -> p -> b
      const x = (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * p.x + t * t * b.x;
      const y = (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * p.y + t * t * b.y;
      if (i === 0 && s === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
  }
  shape.closePath();
  return shape;
}

function regular(n: number, r: number, phase = Math.PI / 2) {
  return Array.from({ length: n }, (_, i) => {
    const a = phase + (i / n) * Math.PI * 2;
    return new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r);
  });
}

function rect(w: number, d: number) {
  return [
    new THREE.Vector2(-w / 2, -d / 2),
    new THREE.Vector2(w / 2, -d / 2),
    new THREE.Vector2(w / 2, d / 2),
    new THREE.Vector2(-w / 2, d / 2),
  ];
}

function prism(shape: THREE.Shape, h: number, y0 = 0) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false, curveSegments: 4 });
  g.rotateX(-Math.PI / 2);
  g.translate(0, y0, 0);
  return g;
}

function box(w: number, h: number, d: number, x = 0, y0 = 0, z = 0, hSegs = 1) {
  return new THREE.BoxGeometry(w, h, d, 1, hSegs, 1).translate(x, y0 + h / 2, z);
}

function cyl(rTop: number, rBottom: number, h: number, y0 = 0, segs = 24) {
  return new THREE.CylinderGeometry(rTop, rBottom, h, segs).translate(0, y0 + h / 2, 0);
}

/** Builds the parts of a landmark in local space (base at y=0, centred on the footprint). */
function landmarkParts(l: Landmark): { parts: THREE.BufferGeometry[]; top: number } {
  const w = l.w ?? 40;
  const d = l.d ?? w;
  const H = l.height;
  const parts: THREE.BufferGeometry[] = [];
  let top = H;
  switch (l.shape) {
    case "commerzbank": {
      parts.push(prism(roundedPolygon(regular(3, w * 0.6), 9), H - 14));
      parts.push(prism(roundedPolygon(regular(3, w * 0.5), 7), 14, H - 14));
      break;
    }
    case "messeturm": {
      const body = H - 36;
      parts.push(prism(roundedPolygon(rect(w, w), 4, 3), body));
      parts.push(new THREE.ConeGeometry((w / 2) * Math.SQRT2 * 0.92, 36, 4).rotateY(Math.PI / 4).translate(0, body + 18, 0));
      top = H;
      break;
    }
    case "westend": {
      parts.push(box(w, H - 22, d));
      const ring = 24;
      for (let i = 0; i < ring; i++) {
        const a = (i / ring) * Math.PI * 2;
        const slat = new THREE.BoxGeometry(1.6, 24, 3).rotateY(-a).translate(Math.cos(a) * 17, H - 22 + 12, Math.sin(a) * 17);
        parts.push(slat);
      }
      top = H - 22;
      break;
    }
    case "maintower": {
      parts.push(cyl(w, w, H, 0, 32));
      parts.push(box(w * 1.5, H * 0.84, w * 1.1, w * 0.9, 0, 0));
      break;
    }
    case "omniturm": {
      const g = box(w, H, d, 0, 0, 0, 48);
      const pos = g.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i);
        const t = THREE.MathUtils.clamp((y - 55) / 45, 0, 1);
        pos.setX(i, pos.getX(i) + Math.sin(t * Math.PI) * 7);
        pos.setZ(i, pos.getZ(i) + Math.sin(t * Math.PI) * 4);
      }
      g.computeVertexNormals();
      parts.push(g);
      break;
    }
    case "trianon": {
      parts.push(prism(roundedPolygon(regular(3, w * 0.62), 3), H));
      break;
    }
    case "ecb": {
      for (const [side, hh] of [
        [-1, H],
        [1, H - 20],
      ] as const) {
        const g = box(w, hh, d * 0.6, 0, 0, side * d * 0.55, 40);
        const pos = g.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < pos.count; i++) {
          const t = pos.getY(i) / hh;
          const a = side * t * 0.18;
          const x = pos.getX(i);
          const z = pos.getZ(i);
          pos.setX(i, x * Math.cos(a) - z * Math.sin(a));
          pos.setZ(i, x * Math.sin(a) + z * Math.cos(a) - side * t * 6);
        }
        g.computeVertexNormals();
        parts.push(g);
      }
      // Großmarkthalle along the river
      parts.push(box(220, 24, 50, 0, 0, 70));
      break;
    }
    case "europaturm": {
      parts.push(cyl(8, 11, 218, 0, 20));
      parts.push(cyl(24, 12, 12, 212, 28));
      parts.push(cyl(26, 26, 12, 224, 28));
      parts.push(cyl(14, 26, 8, 236, 28));
      parts.push(cyl(3.5, 5, 50, 244, 10));
      top = 248;
      break;
    }
    case "dom": {
      parts.push(box(22, 62, 22));
      parts.push(new THREE.ConeGeometry(10, 36, 8).translate(0, 62 + 18, 0));
      parts.push(box(80, 30, 28, -46, 0, 0));
      parts.push(box(26, 26, 60, -30, 0, 0));
      top = 97;
      break;
    }
    case "chamfer": {
      const s = new THREE.CylinderGeometry(w / 2, w / 2, H, 8).rotateY(Math.PI / 8).scale(1, 1, d / w);
      parts.push(s.translate(0, H / 2, 0));
      break;
    }
    case "round": {
      parts.push(prism(roundedPolygon(rect(w, d), d / 2 - 1, 8), H));
      break;
    }
    case "twin": {
      parts.push(prism(roundedPolygon(rect(w * 0.8, d * 0.8), 4, 2), H));
      const g2 = prism(roundedPolygon(rect(w * 0.8, d * 0.8), 4, 2), H);
      parts.push(g2.translate(w * 0.7, 0, d * 0.75));
      break;
    }
    default: {
      parts.push(box(w, H - 8, d));
      parts.push(box(w * 0.7, 8, d * 0.7, 0, H - 8, 0));
      top = H - 8;
    }
  }
  if (l.antenna) {
    parts.push(cyl(0.9, 1.6, l.antenna - H, H, 6));
  }
  return { parts, top };
}

const ACCENTS: Record<string, [number, number, number]> = {
  "Commerzbank Tower": [1.0, 0.72, 0.3],
  Messeturm: [1.0, 0.85, 0.6],
  "Main Tower": [0.35, 0.65, 1.0],
  "Westend Tower": [0.85, 0.92, 1.0],
  EZB: [0.3, 0.75, 1.0],
  Europaturm: [1.0, 0.25, 0.2],
  Omniturm: [0.6, 0.9, 1.0],
  "FOUR T1": [0.5, 0.8, 1.0],
  "Tower 185": [0.9, 0.9, 1.0],
  Kaiserdom: [1.0, 0.6, 0.3],
};

function withAttributes(g: THREE.BufferGeometry, seed: number, top: number, accent: [number, number, number]) {
  let geo = g.index ? g.toNonIndexed() : g;
  geo.deleteAttribute("uv");
  if (!geo.attributes.normal) geo.computeVertexNormals();
  const n = geo.attributes.position.count;
  geo.setAttribute("aSeed", new THREE.Float32BufferAttribute(new Float32Array(n).fill(seed), 1));
  geo.setAttribute("aTop", new THREE.Float32BufferAttribute(new Float32Array(n).fill(top), 1));
  const acc = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) acc.set(accent, i * 3);
  geo.setAttribute("aAccent", new THREE.Float32BufferAttribute(acc, 3));
  return geo;
}

// ---------------------------------------------------------------------------------------------
// City
// ---------------------------------------------------------------------------------------------

export class City {
  readonly scene = new THREE.Scene();
  readonly uniforms: CityUniforms & Record<string, THREE.IUniform>;
  readonly labels: CityLabel[] = [];
  readonly hqPosition: THREE.Vector3;
  readonly landmarkPositions = new Map<string, THREE.Vector3>();

  private riverSamples: THREE.Vector2[] = [];
  private landmarkFootprints: { p: THREE.Vector2; r: number }[] = [];
  private sky: THREE.Mesh;

  constructor(pixelRatio: number, lowPower: boolean) {
    this.uniforms = makeUniforms(pixelRatio);
    this.scene.background = FOG_COLOR.clone();

    const [hx, hz] = toLocal(HQ.lat, HQ.lon);
    this.hqPosition = new THREE.Vector3(hx, 0, hz);

    this.sky = this.buildSky();
    this.buildRiver();
    this.buildGround();
    this.buildLandmarks();
    this.buildBlocks(lowPower);
    this.buildTraffic(lowPower ? 1400 : 3200);
    this.buildBeacon();
    this.buildDataArcs();
    this.buildDataRain(lowPower ? 600 : 1400);
  }

  private shader(opts: Partial<THREE.ShaderMaterialParameters>) {
    return new THREE.ShaderMaterial({ uniforms: this.uniforms, ...opts });
  }

  private buildSky() {
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(30000, 32, 16),
      this.shader({
        side: THREE.BackSide,
        depthWrite: false,
        vertexShader: /* glsl */ `
          varying vec3 vDir;
          void main() {
            vDir = normalize(position);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }`,
        fragmentShader: /* glsl */ `
          ${commonGlsl}
          varying vec3 vDir;
          void main() {
            float y = vDir.y;
            vec3 zenith = vec3(0.004, 0.007, 0.02);
            vec3 col = mix(horizonColor(vDir), zenith, smoothstep(0.0, 0.5, y));
            // stars
            vec2 sp = vec2(atan(vDir.z, vDir.x) * 260.0, y * 260.0);
            vec2 id = floor(sp);
            float s = hash12(id);
            vec2 f = fract(sp) - 0.5;
            float star = step(0.985, s) * smoothstep(0.25, 0.0, length(f)) * smoothstep(0.05, 0.3, y);
            star *= 0.6 + 0.4 * sin(uTime * (1.0 + s * 3.0) + s * 50.0);
            col += vec3(0.8, 0.9, 1.0) * star * (1.0 - uTech * 0.5);
            gl_FragColor = vec4(col, 1.0);
          }`,
      }),
    );
    sky.renderOrder = -1;
    sky.frustumCulled = false;
    this.scene.add(sky);
    return sky;
  }

  private buildRiver() {
    const pts = RIVER.map(([lat, lon]) => {
      const [x, z] = toLocal(lat, lon);
      return new THREE.Vector3(x, 0, z);
    });
    const curve = new THREE.CatmullRomCurve3(pts, false, "centripetal");
    const N = 400;
    const positions: number[] = [];
    const uvs: number[] = [];
    const index: number[] = [];
    let along = 0;
    let prev = curve.getPoint(0);
    for (let i = 0; i <= N; i++) {
      const p = curve.getPoint(i / N);
      const t = curve.getTangent(i / N);
      along += p.distanceTo(prev);
      prev = p;
      const nx = -t.z;
      const nz = t.x;
      const hw = RIVER_WIDTH / 2;
      positions.push(p.x + nx * hw, 0.6, p.z + nz * hw, p.x - nx * hw, 0.6, p.z - nz * hw);
      uvs.push(along, 0, along, 1);
      this.riverSamples.push(new THREE.Vector2(p.x, p.z));
      if (i < N) {
        const a = i * 2;
        index.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(index);
    const river = new THREE.Mesh(
      geo,
      this.shader({
        vertexShader: /* glsl */ `
          varying vec2 vUv; varying vec3 vWorld;
          void main() {
            vUv = uv;
            vec4 wp = modelMatrix * vec4(position, 1.0);
            vWorld = wp.xyz;
            gl_Position = projectionMatrix * viewMatrix * wp;
          }`,
        fragmentShader: /* glsl */ `
          ${commonGlsl}
          varying vec2 vUv; varying vec3 vWorld;
          void main() {
            vec3 viewDir = normalize(cameraPosition - vWorld);
            float fres = pow(1.0 - viewDir.y, 5.0);
            float across = vUv.y;
            float edge = smoothstep(0.0, 0.06, across) * smoothstep(1.0, 0.94, across);
            // Reflections of the lit banks: broken streaks stretched towards the viewer.
            vec2 p = vec2(vUv.x / 40.0 - uTime * 0.12, across * 90.0 + sin(vUv.x * 0.05 + uTime) * 0.4);
            float n = hash12(floor(p));
            float fadeFar = 1.0 - clamp(fwidth(p.y) * 1.5, 0.0, 1.0);
            float streak = smoothstep(0.86, 1.0, n) * (0.5 + 0.5 * sin(uTime * 2.0 + n * 30.0)) * fadeFar;
            vec3 refl = mix(vec3(1.0, 0.62, 0.3), vec3(0.6, 0.8, 1.0), step(0.93, n));
            vec3 col = vec3(0.006, 0.01, 0.022) + vec3(0.05, 0.06, 0.1) * fres + refl * streak * 0.16 * (0.4 + fres);
            col += vec3(1.0, 0.62, 0.3) * (1.0 - edge) * 0.06;
            // tech: flow lines
            float lines = smoothstep(0.02, 0.0, abs(fract(across * 6.0) - 0.5) - 0.46);
            float pulse = smoothstep(0.8, 1.0, fract(vUv.x / 900.0 - uTime * 0.35 + floor(across * 6.0) * 0.21));
            vec3 techCol = vec3(0.005, 0.02, 0.04) + vec3(0.15, 0.75, 1.0) * (lines * 0.25 + pulse * lines * 1.4 + fres * 0.3);
            col = mix(col, techCol, uTech);
            gl_FragColor = vec4(applyFog(col, vWorld), 1.0);
          }`,
      }),
    );
    this.scene.add(river);

    // Bridges
    const bridgeGeos: THREE.BufferGeometry[] = [];
    for (const lon of BRIDGES) {
      const [bx] = toLocal(0, lon);
      let best = 0;
      this.riverSamples.forEach((s, i) => {
        if (Math.abs(s.x - bx) < Math.abs(this.riverSamples[best].x - bx)) best = i;
      });
      const p = this.riverSamples[best];
      const q = this.riverSamples[Math.min(best + 1, this.riverSamples.length - 1)];
      const angle = Math.atan2(q.y - p.y, q.x - p.x);
      const g = new THREE.BoxGeometry(16, 6, RIVER_WIDTH + 70).rotateY(-angle).translate(p.x, 4, p.y);
      bridgeGeos.push(withAttributes(g, 0.3, 7, [0, 0, 0]));
    }
    this.scene.add(new THREE.Mesh(mergeGeometries(bridgeGeos), this.buildingMaterial()));
  }

  private buildGround() {
    const geo = new THREE.PlaneGeometry(60000, 60000).rotateX(-Math.PI / 2);
    const ground = new THREE.Mesh(
      geo,
      this.shader({
        uniforms: {
          ...this.uniforms,
          uAngle: { value: GRID_ANGLE },
          uBlock: { value: BLOCK },
          uCenter: { value: CITY_CENTER },
          uRadii: { value: CITY_RADII },
        },
        vertexShader: /* glsl */ `
          varying vec3 vWorld;
          void main() {
            vec4 wp = modelMatrix * vec4(position, 1.0);
            vWorld = wp.xyz;
            gl_Position = projectionMatrix * viewMatrix * wp;
          }`,
        fragmentShader: /* glsl */ `
          ${commonGlsl}
          uniform float uAngle;
          uniform float uBlock;
          uniform vec2 uCenter;
          uniform vec2 uRadii;
          varying vec3 vWorld;
          void main() {
            vec2 xz = vWorld.xz;
            vec2 wxz = xz + warp(xz);
            float ca = cos(uAngle), sa = sin(uAngle);
            vec2 g = vec2(ca * wxz.x + sa * wxz.y, -sa * wxz.x + ca * wxz.y) / uBlock;
            vec2 d = abs(fract(g + 0.5) - 0.5) * uBlock;       // metres to nearest street centre, per axis
            float fw = max(fwidth(g.x), fwidth(g.y)) * uBlock;  // metres per pixel
            bool alongY = d.x < d.y;                           // street runs along the grid's y axis
            float dm = min(d.x, d.y);
            vec2 lineId = floor(g + 0.5);
            float lineHash = alongY ? hash12(vec2(lineId.x, 1.7)) : hash12(vec2(4.3, lineId.y));
            float major = step(0.82, lineHash);                // a few brighter arterial roads
            float along = (alongY ? g.y : g.x) * uBlock;

            // Street surface (min ~1.2px wide so it never shimmers away in the distance).
            float halfW = max(11.0, fw * 0.6);
            float street = 1.0 - smoothstep(halfW - fw * 0.5, halfW + fw * 0.5, dm);
            float energy = 11.0 / halfW;
            // Lamp dots along both kerbs.
            float kerb = 1.0 - smoothstep(0.9, 0.9 + fw, abs(dm - 9.0));
            float dots = 1.0 - smoothstep(1.3, 1.3 + fw, abs(fract(along / 28.0) - 0.5) * 28.0);
            float lod = clamp(fw / 3.0, 0.0, 1.0);
            float lamps = mix(kerb * dots, 0.06, lod);

            float density = 1.0 - smoothstep(0.25, 1.05, length((xz - uCenter) / uRadii));
            float bright = (0.25 + 0.45 * lineHash + major * 1.1) * density;

            vec3 col = vec3(0.016, 0.019, 0.032);
            col += vec3(1.0, 0.58, 0.26) * street * bright * (0.05 * energy + lamps * 0.9);

            // tech: glowing circuit with travelling pulses
            float pulse = smoothstep(0.93, 1.0, fract(along / 900.0 - uTime * 0.45 + lineHash * 7.0));
            float trace = 1.0 - smoothstep(1.2, 1.2 + fw, dm);
            trace = max(trace, street * 0.25 * energy);
            vec3 techCol = vec3(0.004, 0.012, 0.028)
              + vec3(0.1, 0.55, 1.0) * trace * (0.25 + 0.5 * major) * (0.3 + density)
              + vec3(0.45, 0.95, 1.0) * pulse * trace * density * 2.2;
            col = mix(col, techCol, uTech);

            // Rings rippling out from the focused tower.
            float fd = length(xz - uFocus.xz);
            float rings = 1.0 - smoothstep(0.0, 0.06, abs(fract(fd / 70.0 - uTime * 0.6) - 0.5));  // one 8 m ring per 70 m
            col += vec3(0.3, 0.85, 1.0) * rings * uFocusAmt * (1.0 - smoothstep(60.0, 420.0, fd)) * 0.9;
            gl_FragColor = vec4(applyFog(col, vWorld), 1.0);
          }`,
      }),
    );
    this.scene.add(ground);
  }

  private buildingMaterial() {
    return this.shader({ vertexShader: buildingVertex, fragmentShader: buildingFragment });
  }

  private buildLandmarks() {
    const geos: THREE.BufferGeometry[] = [];
    const edges: THREE.BufferGeometry[] = [];
    const tips: number[] = [];
    LANDMARKS.forEach((l, i) => {
      const [x, z] = toLocal(l.lat, l.lon);
      const { parts, top } = landmarkParts(l);
      const m = new THREE.Matrix4().makeRotationY(l.rot ?? 0).setPosition(x, 0, z);
      const accent = ACCENTS[l.name] ?? [0.45, 0.65, 0.95];
      for (const p of parts) {
        p.applyMatrix4(m);
        const e = new THREE.EdgesGeometry(p, 35);
        edges.push(e);
        geos.push(withAttributes(p, i + 1.5, top, accent));
      }
      const tip = l.antenna ?? (l.shape === "europaturm" ? 294 : l.height);
      tips.push(x, tip + 1, z);
      this.landmarkFootprints.push({ p: new THREE.Vector2(x, z), r: (l.w ?? 40) * 0.9 + 30 + (l.shape === "ecb" ? 120 : 0) });
      this.landmarkPositions.set(l.name, new THREE.Vector3(x, top, z));
    });
    this.scene.add(new THREE.Mesh(mergeGeometries(geos), this.buildingMaterial()));

    const edgeLines = new THREE.LineSegments(
      mergeGeometries(edges),
      this.shader({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexShader: /* glsl */ `
          ${commonGlsl}
          varying vec3 vWorld;
          void main() {
            vec4 wp = modelMatrix * vec4(position, 1.0);
            wp.y *= growFactor(wp.xz);
            vWorld = wp.xyz;
            gl_Position = projectionMatrix * viewMatrix * wp;
          }`,
        fragmentShader: /* glsl */ `
          ${commonGlsl}
          varying vec3 vWorld;
          void main() {
            float d = length(vWorld - cameraPosition);
            float a = mix(0.1, 0.9, uTech) * exp(-d * 0.00012);
            gl_FragColor = vec4(vec3(0.35, 0.75, 1.0), a);
          }`,
      }),
    );
    this.scene.add(edgeLines);

    // Blinking aviation lights on the tallest tips.
    const tipGeo = new THREE.BufferGeometry();
    tipGeo.setAttribute("position", new THREE.Float32BufferAttribute(tips, 3));
    const tipPoints = new THREE.Points(
      tipGeo,
      this.shader({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexShader: /* glsl */ `
          ${commonGlsl}
          uniform float uPixelRatio;
          varying float vBlink;
          void main() {
            vec4 wp = modelMatrix * vec4(position, 1.0);
            wp.y *= growFactor(wp.xz);
            vec4 mv = viewMatrix * wp;
            vBlink = step(0.5, fract(uTime * 0.5 + hash12(wp.xz) ));
            gl_PointSize = clamp(9000.0 / -mv.z, 2.0, 14.0) * uPixelRatio;
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: /* glsl */ `
          varying float vBlink;
          void main() {
            float d = length(gl_PointCoord - 0.5);
            float a = smoothstep(0.5, 0.0, d) * (0.25 + 0.75 * vBlink);
            gl_FragColor = vec4(vec3(1.0, 0.15, 0.1) * 2.5, a);
          }`,
      }),
    );
    this.scene.add(tipPoints);
  }

  private distanceToRiver(x: number, z: number) {
    let best = Infinity;
    for (const s of this.riverSamples) {
      const dx = s.x - x;
      const dz = s.y - z;
      const d = dx * dx + dz * dz;
      if (d < best) best = d;
    }
    return Math.sqrt(best);
  }

  private buildBlocks(lowPower: boolean) {
    const rand = mulberry32(1337);
    const ca = Math.cos(GRID_ANGLE);
    const sa = Math.sin(GRID_ANGLE);
    const toWorld = (u: number, v: number) => {
      const [x, z] = unwarp(ca * u - sa * v, sa * u + ca * v);
      return new THREE.Vector2(x, z);
    };
    const matrices: THREE.Matrix4[] = [];
    const seeds: number[] = [];
    const tops: number[] = [];
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -GRID_ANGLE);
    const range = 60;
    const inner = BLOCK - STREET;
    const parks = PARKS.map(([lat, lon, r]) => {
      const [x, z] = toLocal(lat, lon);
      return { p: new THREE.Vector2(x, z), r };
    });
    const [, niddaZ] = toLocal(50.1505, 8.68);
    const [, forestZ] = toLocal(50.0915, 8.68);
    this.landmarkFootprints.push({ p: new THREE.Vector2(this.hqPosition.x, this.hqPosition.z), r: 110 });

    /** Adds a building given its centre in grid space (u, v), size along u / v, and height. */
    const add = (u: number, v: number, su: number, sv: number, h: number) => {
      const p = toWorld(u, v);
      if (this.distanceToRiver(p.x, p.y) < RIVER_WIDTH / 2 + 18 + Math.max(su, sv) / 2) return;
      if (this.landmarkFootprints.some((f) => f.p.distanceTo(p) < f.r)) return;
      matrices.push(new THREE.Matrix4().compose(new THREE.Vector3(p.x, 0, p.y), q, new THREE.Vector3(su, h, sv)));
      seeds.push(rand() * 100);
      tops.push(h);
    };

    for (let i = -range; i < range; i++) {
      for (let j = -range; j < range; j++) {
        const cu = (i + 0.5) * BLOCK;
        const cv = (j + 0.5) * BLOCK;
        const c = toWorld(cu, cv);
        const e = c.clone().sub(CITY_CENTER).divide(CITY_RADII).length();
        if (e > 1.05) continue;
        if (c.y > forestZ) continue; // Stadtwald — the forest south of Sachsenhausen
        if (Math.abs(c.y - niddaZ - Math.sin(c.x * 0.0009) * 250) < 220) continue; // Nidda valley
        if (parks.some((pk) => pk.p.distanceTo(c) < pk.r)) continue;
        const rCbd = c.length();
        const cbd = Math.exp(-(rCbd * rCbd) / (1300 * 1300));
        const keep = Math.min(1, 1.3 - e) * (lowPower ? 0.6 : 1);
        if (rand() > keep) continue;

        const urban = rCbd < 3200 ? 1 : rCbd < 4500 ? 0.5 : 0.15;
        if (rand() < urban * (lowPower ? 0.5 : 1)) {
          // Perimeter block ("Blockrand"): slabs around a courtyard, split into
          // segments of varying height, with the odd open side.
          const base = 15 + rand() * 9 + cbd * 12;
          const side = (horizontal: boolean, sign: number) => {
            if (rand() < 0.15) return;
            const depth = 11 + rand() * 7;
            const length = horizontal ? inner : inner - 2 * 14;
            const segs = 1 + Math.floor(rand() * 3);
            let offset = -length / 2;
            for (let k = 0; k < segs; k++) {
              const len = k === segs - 1 ? length / 2 - offset : (length / segs) * (0.7 + rand() * 0.6);
              const mid = offset + len / 2;
              const h = base * (0.75 + rand() * 0.5);
              if (horizontal) add(cu + mid, cv + sign * (inner / 2 - depth / 2), len - 1, depth, h);
              else add(cu + sign * (inner / 2 - depth / 2), cv + mid, depth, len - 1, h);
              offset += len;
            }
          };
          side(true, -1);
          side(true, 1);
          side(false, -1);
          side(false, 1);
          // Occasional mid-rise office tower near the centre.
          if (rand() < cbd * 0.55) {
            const s = 22 + rand() * 18;
            add(cu + (rand() - 0.5) * 20, cv + (rand() - 0.5) * 20, s, s * (0.7 + rand() * 0.5), 45 + rand() * 80 * cbd);
          }
        } else {
          // Detached houses / small slabs.
          const n = 1 + Math.floor(rand() * 4);
          for (let k = 0; k < n; k++) {
            const su = 12 + rand() * 30;
            const sv = 10 + rand() * 18;
            add(
              cu + (rand() - 0.5) * (inner - su),
              cv + (rand() - 0.5) * (inner - sv),
              su,
              sv,
              7 + rand() * 10 + (rand() < 0.08 ? 20 + rand() * 25 : 0),
            );
          }
        }
      }
    }

    const geo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
    geo.deleteAttribute("uv");
    geo.setAttribute("aSeed", new THREE.InstancedBufferAttribute(new Float32Array(seeds), 1));
    geo.setAttribute("aTop", new THREE.InstancedBufferAttribute(new Float32Array(tops), 1));
    geo.setAttribute("aAccent", new THREE.InstancedBufferAttribute(new Float32Array(seeds.length * 3), 3));
    const mesh = new THREE.InstancedMesh(geo, this.buildingMaterial(), matrices.length);
    matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.frustumCulled = false;
    this.scene.add(mesh);

    // A small modern campus at the HQ.
    const hq = this.hqPosition;
    const hqGeo = [
      box(60, 24, 32, 0, 0, 0),
      box(30, 36, 30, 38, 0, 10),
    ].map((g) => withAttributes(g.applyMatrix4(new THREE.Matrix4().makeRotationY(-GRID_ANGLE).setPosition(hq.x, 0, hq.z)), 99, 36, [0.3, 0.85, 1.0]));
    this.scene.add(new THREE.Mesh(mergeGeometries(hqGeo), this.buildingMaterial()));
  }

  private buildTraffic(count: number) {
    const rand = mulberry32(42);
    const ca = Math.cos(GRID_ANGLE);
    const sa = Math.sin(GRID_ANGLE);
    const start: number[] = [];
    const dir: number[] = [];
    const meta: number[] = []; // len, speed, offset, headlights?
    let made = 0;
    let guard = 0;
    while (made < count && guard++ < count * 20) {
      const horizontal = rand() < 0.5;
      const k = Math.round((rand() - 0.5) * 56);
      const from = (rand() - 0.5) * 7000;
      const len = 400 + rand() * 1800;
      const sgn = rand() < 0.5 ? 1 : -1;
      const lane = sgn * 5;
      const u = horizontal ? from : k * BLOCK + lane;
      const v = horizontal ? k * BLOCK + lane : from;
      const du = horizontal ? sgn : 0;
      const dv = horizontal ? 0 : sgn;
      const mu = u + du * len * 0.5;
      const mv = v + dv * len * 0.5;
      const [mx, mz] = unwarp(ca * mu - sa * mv, sa * mu + ca * mv);
      const e = new THREE.Vector2(mx, mz).sub(CITY_CENTER).divide(CITY_RADII).length();
      if (e > 0.9 || this.distanceToRiver(mx, mz) < RIVER_WIDTH) continue;
      const cars = 3 + Math.floor(rand() * 6);
      const speed = 12 + rand() * 16;
      for (let c = 0; c < cars; c++) {
        start.push(u, 1.5, v);
        dir.push(du, 0, dv);
        meta.push(len, speed, rand() * len, sgn > 0 ? 1 : 0);
        made++;
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(start, 3));
    geo.setAttribute("aDir", new THREE.Float32BufferAttribute(dir, 3));
    geo.setAttribute("aMeta", new THREE.Float32BufferAttribute(meta, 4));
    const points = new THREE.Points(
      geo,
      this.shader({
        uniforms: { ...this.uniforms, uAngle: { value: GRID_ANGLE } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexShader: /* glsl */ `
          ${commonGlsl}
          uniform float uPixelRatio;
          uniform float uAngle;
          attribute vec3 aDir;
          attribute vec4 aMeta;
          varying vec3 vColor;
          varying float vFade;
          void main() {
            float s = mod(aMeta.z + uTime * aMeta.y, aMeta.x);
            vec3 g = position + aDir * s;          // grid space
            float ca = cos(uAngle), sa = sin(uAngle);
            vec2 w = vec2(ca * g.x - sa * g.z, sa * g.x + ca * g.z);
            vec2 p = w;
            for (int i = 0; i < 3; i++) p = w - warp(p);
            vec4 mv = viewMatrix * vec4(p.x, g.y, p.y, 1.0);
            vFade = smoothstep(0.0, 60.0, s) * smoothstep(aMeta.x, aMeta.x - 60.0, s) * uGrow;
            vColor = mix(vec3(1.0, 0.25, 0.12), vec3(1.0, 0.9, 0.75), aMeta.w);
            vColor = mix(vColor, vec3(0.3, 0.9, 1.0), uTech);
            gl_PointSize = clamp(2600.0 / -mv.z, 1.0, 7.0) * uPixelRatio;
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: /* glsl */ `
          varying vec3 vColor;
          varying float vFade;
          void main() {
            float d = length(gl_PointCoord - 0.5);
            gl_FragColor = vec4(vColor * 1.6, smoothstep(0.5, 0.0, d) * vFade);
          }`,
      }),
    );
    points.frustumCulled = false;
    this.scene.add(points);
  }

  private buildBeacon() {
    const hq = this.hqPosition;
    const beamMat = (width: number, strength: number) =>
      this.shader({
        uniforms: { ...this.uniforms, uStrength: { value: strength }, uWidth: { value: width } },
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        vertexShader: /* glsl */ `
          varying vec2 vUv; varying vec3 vN; varying vec3 vWorld;
          void main() {
            vUv = uv;
            vec4 wp = modelMatrix * vec4(position, 1.0);
            vWorld = wp.xyz;
            vN = normalize(mat3(modelMatrix) * normal);
            gl_Position = projectionMatrix * viewMatrix * wp;
          }`,
        fragmentShader: /* glsl */ `
          ${commonGlsl}
          uniform float uStrength;
          varying vec2 vUv; varying vec3 vN; varying vec3 vWorld;
          void main() {
            vec3 v = normalize(cameraPosition - vWorld);
            float core = pow(abs(dot(normalize(vN.xz), normalize(v.xz))), 2.0);
            float fade = pow(1.0 - vUv.y, 1.6);
            float flicker = 0.9 + 0.1 * sin(uTime * 7.0 + vUv.y * 40.0);
            float travel = smoothstep(0.9, 1.0, fract(vUv.y * 5.0 - uTime * 0.6)) * 0.6;
            vec3 c = vec3(0.3, 0.85, 1.0) * (fade + travel * fade) * core * uStrength * flicker * uGrow;
            gl_FragColor = vec4(c, 1.0);
          }`,
      });
    const inner = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 3200, 16, 1, true).translate(0, 1600, 0), beamMat(5, 1.1));
    const outer = new THREE.Mesh(new THREE.CylinderGeometry(28, 16, 3200, 24, 1, true).translate(0, 1600, 0), beamMat(28, 0.18));
    inner.position.set(hq.x + 12, 36, hq.z);
    outer.position.copy(inner.position);
    this.scene.add(inner, outer);

    const ripple = new THREE.Mesh(
      new THREE.PlaneGeometry(700, 700).rotateX(-Math.PI / 2),
      this.shader({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);} `,
        fragmentShader: /* glsl */ `
          ${commonGlsl}
          varying vec2 vUv;
          void main() {
            float d = length(vUv - 0.5) * 2.0;
            float r = 0.0;
            for (int i = 0; i < 3; i++) {
              float p = fract(uTime * 0.25 + float(i) / 3.0);
              r += smoothstep(0.025, 0.0, abs(d - p)) * (1.0 - p);
            }
            r += smoothstep(0.2, 0.0, d) * 0.6;
            gl_FragColor = vec4(vec3(0.3, 0.85, 1.0) * r * uGrow, 1.0);
          }`,
      }),
    );
    ripple.position.set(hq.x, 1.2, hq.z);
    this.scene.add(ripple);

  }

  /** Light arcs: HQ ⇄ skyline ⇄ client locations. Visible in the "trusted" shot. */
  private buildDataArcs() {
    const hq = this.hqPosition.clone().setY(40);
    const cbd = this.landmarkPositions.get("Commerzbank Tower")!.clone();
    const arcs: [THREE.Vector3, THREE.Vector3, number][] = [];
    // Client arcs fan out westwards (away from the "clients" camera) so every name gets its own
    // spot in the sky; the remaining arcs point at real cities.
    const clients = CLIENT_LINKS.filter((c) => c.client);
    clients.forEach((c, i) => {
      const phi = THREE.MathUtils.degToRad(70 - (140 * i) / Math.max(1, clients.length - 1));
      const end = new THREE.Vector3(-Math.cos(phi), 0, Math.sin(phi)).multiplyScalar(14000).add(cbd).setY(-400);
      const lift = 2200 + (i % 2) * 700;
      arcs.push([cbd, end, lift]);
      const mid = cbd.clone().lerp(end, 0.5).setY(Math.max(cbd.y, end.y) + lift);
      const at = new THREE.QuadraticBezierCurve3(cbd, mid, end).getPoint(0.11);
      this.labels.push({ name: c.client!, position: at, href: c.href! });
    });
    for (const c of CLIENT_LINKS.filter((l) => !l.client)) {
      const [x, z] = toLocal(c.lat, c.lon);
      arcs.push([cbd, new THREE.Vector3(x, 0, z).normalize().multiplyScalar(16000).setY(-400), 2600]);
    }
    for (const name of ["Messeturm", "Main Tower", "EZB", "Westend Tower", "Europaturm", "Tower 185"]) {
      arcs.push([hq, this.landmarkPositions.get(name)!.clone(), 900]);
    }
    arcs.push([hq, cbd, 1100]);

    arcs.forEach(([a, b, lift], i) => {
      const mid = a.clone().lerp(b, 0.5).setY(Math.max(a.y, b.y) + lift);
      const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
      const geo = new THREE.TubeGeometry(curve, 96, i < CLIENT_LINKS.length ? 7 : 4, 6, false);
      const mesh = new THREE.Mesh(
        geo,
        this.shader({
          uniforms: { ...this.uniforms, uOffset: { value: i * 0.173 } },
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          vertexShader: /* glsl */ `varying float vT; varying vec3 vWorld; void main(){ vT = uv.x; vec4 wp = modelMatrix * vec4(position,1.0); vWorld = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`,
          fragmentShader: /* glsl */ `
            ${commonGlsl}
            uniform float uArcs;
            uniform float uOffset;
            varying float vT; varying vec3 vWorld;
            void main() {
              float head = fract(uTime * 0.22 + uOffset) * 1.5 - 0.25;
              float trail = smoothstep(head - 0.3, head, vT) * step(vT, head);
              float fog = exp(-length(vWorld - cameraPosition) * 0.00006);
              float a = (0.06 + trail * 0.75) * uArcs * fog;
              vec3 c = mix(vec3(0.3, 0.8, 1.0), vec3(1.0, 0.8, 0.5), step(0.5, fract(uOffset * 3.0)));
              gl_FragColor = vec4(c * a, 1.0);
            }`,
        }),
      );
      mesh.frustumCulled = false;
      this.scene.add(mesh);
    });
  }

  /** Particles streaming up from the rooftops, the city "uploading" in tech mode. */
  private buildDataRain(count: number) {
    const rand = mulberry32(99);
    const tops = [...this.landmarkPositions.values()];
    const pos: number[] = [];
    const meta: number[] = [];
    for (let i = 0; i < count; i++) {
      const t = tops[Math.floor(rand() * tops.length)];
      const spread = rand() < 0.6 ? 18 : 900;
      pos.push(t.x + (rand() - 0.5) * spread * 2, rand() < 0.6 ? t.y : 30, t.z + (rand() - 0.5) * spread * 2);
      meta.push(rand(), 30 + rand() * 90);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("aMeta", new THREE.Float32BufferAttribute(meta, 2));
    const pts = new THREE.Points(
      geo,
      this.shader({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexShader: /* glsl */ `
          ${commonGlsl}
          uniform float uPixelRatio;
          attribute vec2 aMeta;
          varying float vA;
          void main() {
            float life = fract(aMeta.x + uTime * aMeta.y / 600.0);
            vec3 p = position + vec3(0.0, life * 600.0, 0.0);
            vec4 mv = viewMatrix * modelMatrix * vec4(p, 1.0);
            vA = smoothstep(0.0, 0.1, life) * (1.0 - life) * uTech;
            gl_PointSize = clamp(5000.0 / -mv.z, 1.0, 6.0) * uPixelRatio;
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: /* glsl */ `
          varying float vA;
          void main() {
            vec2 c = gl_PointCoord - 0.5;
            float a = smoothstep(0.5, 0.0, length(c)) * vA;
            if (a < 0.01) discard;
            gl_FragColor = vec4(vec3(0.4, 0.9, 1.0) * 1.8, a);
          }`,
      }),
    );
    pts.frustumCulled = false;
    this.scene.add(pts);
  }

  update(camera: THREE.Camera) {
    this.sky.position.copy(camera.position);
  }
}
