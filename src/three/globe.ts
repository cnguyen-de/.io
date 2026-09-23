import * as THREE from "three";
import { feature } from "topojson-client";
import { FRANKFURT, WORLD_CITIES } from "./frankfurt";
import { mulberry32 } from "./utils";

export const GLOBE_RADIUS = 100;

/** Unit vector for a lat/lon; lon 0 / lat 0 faces +z. */
export function latLonToVec(lat: number, lon: number, r = 1) {
  const la = THREE.MathUtils.degToRad(lat);
  const lo = THREE.MathUtils.degToRad(lon);
  return new THREE.Vector3(Math.cos(la) * Math.sin(lo) * r, Math.sin(la) * r, Math.cos(la) * Math.cos(lo) * r);
}

type Position = number[];
type Geometry = { type: "Polygon"; coordinates: Position[][] } | { type: "MultiPolygon"; coordinates: Position[][][] };
type Feature = { id?: string | number; geometry: Geometry | null };

const MASK_W = 2048;
const MASK_H = 1024;
const GERMANY_ID = "276";

/** Rasterizes country polygons into an equirectangular mask: R = land, G = Germany. */
async function buildMask() {
  const topo = (await import("world-atlas/countries-110m.json")).default as unknown as Parameters<typeof feature>[0];
  const objects = (topo as unknown as { objects: Record<string, unknown> }).objects;
  const collection = feature(topo, objects.countries as Parameters<typeof feature>[1]) as unknown as {
    features: Feature[];
  };

  const canvas = document.createElement("canvas");
  canvas.width = MASK_W;
  canvas.height = MASK_H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, MASK_W, MASK_H);

  const drawPolygon = (rings: Position[][]) => {
    // Draw three copies shifted by ±360° so polygons crossing the antimeridian stay intact.
    for (const shift of [-MASK_W, 0, MASK_W]) {
      ctx.beginPath();
      for (const ring of rings) {
        let prevLon = ring[0][0];
        let offset = 0;
        ring.forEach(([lon, lat], i) => {
          if (i > 0 && Math.abs(lon - prevLon) > 180) offset += lon < prevLon ? 360 : -360;
          prevLon = lon;
          const x = ((lon + offset + 180) / 360) * MASK_W + shift;
          const y = ((90 - lat) / 180) * MASK_H;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.closePath();
      }
      ctx.fill("evenodd");
    }
  };

  for (const f of collection.features) {
    if (!f.geometry) continue;
    ctx.fillStyle = String(f.id) === GERMANY_ID ? "#ffff00" : "#ff0000";
    if (f.geometry.type === "Polygon") drawPolygon(f.geometry.coordinates);
    else f.geometry.coordinates.forEach(drawPolygon);
  }

  const data = ctx.getImageData(0, 0, MASK_W, MASK_H).data;
  return (lat: number, lon: number): 0 | 1 | 2 => {
    const x = Math.min(MASK_W - 1, Math.max(0, Math.floor(((lon + 180) / 360) * MASK_W)));
    const y = Math.min(MASK_H - 1, Math.max(0, Math.floor(((90 - lat) / 180) * MASK_H)));
    const i = (y * MASK_W + x) * 4;
    if (data[i + 1] > 127) return 2;
    return data[i] > 127 ? 1 : 0;
  };
}

const dotVertex = /* glsl */ `
  attribute float aKind;
  attribute float aRand;
  attribute float aLayer;
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uDetail;
  uniform vec3 uFocus;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vec3 n = normalize(normalMatrix * normalize(position));
    float facing = dot(n, normalize(-mv.xyz));
    float focus = smoothstep(0.12, 0.0, distance(normalize(position), uFocus));
    float twinkle = 0.75 + 0.25 * sin(uTime * (1.0 + aRand * 2.0) + aRand * 40.0);

    vec3 land = vec3(0.4, 0.5, 0.78);
    vec3 germany = vec3(0.15, 0.9, 1.0) * 1.5;
    vColor = mix(land, germany, step(1.5, aKind)) * twinkle;
    vColor += vec3(0.3, 0.9, 1.0) * focus * 1.4;

    float layerAlpha = aLayer > 0.5 ? uDetail : 1.0 - uDetail * 0.6;
    vAlpha = smoothstep(-0.05, 0.35, facing) * layerAlpha;

    float size = (aLayer > 0.5 ? 0.2 : 0.75) * (1.0 + focus * 0.6);
    gl_PointSize = clamp(size * uPixelRatio * (320.0 / -mv.z), 0.0, 24.0 * uPixelRatio);
    gl_Position = projectionMatrix * mv;
  }
`;

const dotFragment = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    float a = smoothstep(0.5, 0.2, d) * vAlpha;
    if (a < 0.01) discard;
    gl_FragColor = vec4(vColor, a);
  }
`;

const arcVertex = /* glsl */ `
  varying float vT;
  void main() {
    vT = uv.x;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const arcFragment = /* glsl */ `
  uniform float uTime;
  uniform float uOffset;
  uniform float uOpacity;
  uniform vec3 uColor;
  varying float vT;
  void main() {
    float head = fract(uTime * 0.28 + uOffset) * 1.6 - 0.3;
    float trail = smoothstep(head - 0.35, head, vT) * step(vT, head);
    float a = (0.12 + trail * 1.4) * uOpacity * smoothstep(0.0, 0.04, vT) * smoothstep(1.0, 0.96, vT);
    gl_FragColor = vec4(uColor * (0.6 + trail * 1.8), a);
  }
`;

export class Globe {
  readonly group = new THREE.Group();
  /** Frankfurt in the globe's object space (constant). */
  readonly focus = latLonToVec(FRANKFURT.lat, FRANKFURT.lon);
  readonly ready: Promise<void>;

  private dotMaterial: THREE.ShaderMaterial;
  private arcMaterials: THREE.ShaderMaterial[] = [];
  private markerMaterial: THREE.ShaderMaterial;

  constructor(pixelRatio: number, dense: boolean) {
    const R = GLOBE_RADIUS;

    // Dark ocean sphere with a faint rim.
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(R * 0.995, 96, 64),
      new THREE.ShaderMaterial({
        vertexShader: /* glsl */ `
          varying vec3 vN; varying vec3 vV;
          void main() {
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: /* glsl */ `
          varying vec3 vN; varying vec3 vV;
          void main() {
            float f = pow(1.0 - max(dot(vN, vV), 0.0), 3.0);
            vec3 c = vec3(0.006, 0.011, 0.026) + vec3(0.1, 0.35, 0.8) * f * 0.28;
            gl_FragColor = vec4(c, 1.0);
          }`,
      }),
    );
    this.group.add(sphere);

    // Atmosphere halo, rendered on the back faces of a bigger sphere.
    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(R * 1.18, 64, 48),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexShader: /* glsl */ `
          varying vec3 vN; varying vec3 vV;
          void main() {
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: /* glsl */ `
          varying vec3 vN; varying vec3 vV;
          void main() {
            float i = pow(clamp(0.72 + dot(vN, vV), 0.0, 1.0), 5.0);
            gl_FragColor = vec4(vec3(0.25, 0.6, 1.0) * i * 1.3, i);
          }`,
      }),
    );
    // The halo must not rotate with the globe, but it is a sphere so it doesn't matter.
    this.group.add(atmosphere);

    this.dotMaterial = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: pixelRatio },
        uDetail: { value: 0 },
        uFocus: { value: this.focus.clone() },
      },
      vertexShader: dotVertex,
      fragmentShader: dotFragment,
    });

    this.markerMaterial = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 } },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform float uTime; varying vec2 vUv;
        void main() {
          float d = length(vUv - 0.5) * 2.0;
          float ring = 0.0;
          for (int i = 0; i < 3; i++) {
            float p = fract(uTime * 0.6 + float(i) / 3.0);
            ring += smoothstep(0.06, 0.0, abs(d - p)) * (1.0 - p);
          }
          float core = smoothstep(0.14, 0.0, d) * 2.0;
          vec3 c = vec3(0.3, 0.9, 1.0) * (ring + core);
          gl_FragColor = vec4(c, clamp(ring + core, 0.0, 1.0));
        }`,
    });
    const marker = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), this.markerMaterial);
    marker.position.copy(this.focus).multiplyScalar(R * 1.002);
    marker.lookAt(this.focus.clone().multiplyScalar(R * 2));
    this.group.add(marker);

    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.12, 14, 8, 1, true).translate(0, 7, 0),
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexShader: /* glsl */ `varying float vY; void main(){ vY = uv.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);} `,
        fragmentShader: /* glsl */ `varying float vY; void main(){ gl_FragColor = vec4(vec3(0.4,0.9,1.0)*2.0, 1.0 - vY); }`,
      }),
    );
    beam.position.copy(marker.position);
    beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), this.focus);
    this.group.add(beam);

    this.buildArcs();
    this.ready = this.buildDots(dense);
  }

  private buildArcs() {
    const R = GLOBE_RADIUS;
    const from = this.focus;
    WORLD_CITIES.forEach(([lat, lon], i) => {
      const to = latLonToVec(lat, lon);
      const angle = from.angleTo(to);
      const pts: THREE.Vector3[] = [];
      for (let s = 0; s <= 48; s++) {
        const t = s / 48;
        const v = new THREE.Vector3().copy(from).lerp(to, t).normalize();
        // slerp for long arcs
        const sinA = Math.sin(angle);
        if (sinA > 1e-4) {
          v.copy(from)
            .multiplyScalar(Math.sin((1 - t) * angle) / sinA)
            .add(to.clone().multiplyScalar(Math.sin(t * angle) / sinA));
        }
        pts.push(v.multiplyScalar(R * (1.003 + Math.sin(Math.PI * t) * angle * 0.22)));
      }
      const material = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uTime: { value: 0 },
          uOffset: { value: i * 0.137 },
          uOpacity: { value: 1 },
          uColor: { value: new THREE.Color(i % 3 === 0 ? 0xffc27a : 0x5fd4ff) },
        },
        vertexShader: arcVertex,
        fragmentShader: arcFragment,
      });
      this.arcMaterials.push(material);
      const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 64, 0.22, 6, false);
      this.group.add(new THREE.Mesh(tube, material));
    });
  }

  private async buildDots(dense: boolean) {
    const mask = await buildMask();
    const positions: number[] = [];
    const kinds: number[] = [];
    const rands: number[] = [];
    const layers: number[] = [];
    const rand = mulberry32(7);
    const R = GLOBE_RADIUS;

    // Global layer: Fibonacci sphere.
    const N = dense ? 70000 : 40000;
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < N; i++) {
      const y = 1 - (i / (N - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const th = golden * i;
      const x = Math.cos(th) * r;
      const z = Math.sin(th) * r;
      const lat = THREE.MathUtils.radToDeg(Math.asin(y));
      const lon = THREE.MathUtils.radToDeg(Math.atan2(x, z));
      const kind = mask(lat, lon);
      if (!kind) continue;
      positions.push(x * R, y * R, z * R);
      kinds.push(kind);
      rands.push(rand());
      layers.push(0);
    }

    // Detail layer around Frankfurt, revealed while diving in.
    const step = dense ? 0.09 : 0.13;
    for (let lat = FRANKFURT.lat - 9; lat < FRANKFURT.lat + 9; lat += step) {
      const lonStep = step / Math.cos(THREE.MathUtils.degToRad(lat));
      for (let lon = FRANKFURT.lon - 14; lon < FRANKFURT.lon + 14; lon += lonStep) {
        const la = lat + (rand() - 0.5) * step * 0.6;
        const lo = lon + (rand() - 0.5) * lonStep * 0.6;
        const kind = mask(la, lo);
        if (!kind) continue;
        const v = latLonToVec(la, lo, R * 1.0005);
        positions.push(v.x, v.y, v.z);
        kinds.push(kind);
        rands.push(rand());
        layers.push(1);
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("aKind", new THREE.Float32BufferAttribute(kinds, 1));
    geometry.setAttribute("aRand", new THREE.Float32BufferAttribute(rands, 1));
    geometry.setAttribute("aLayer", new THREE.Float32BufferAttribute(layers, 1));
    const points = new THREE.Points(geometry, this.dotMaterial);
    points.frustumCulled = false;
    this.group.add(points);
  }

  update(time: number, detail: number, arcs: number) {
    this.dotMaterial.uniforms.uTime.value = time;
    this.dotMaterial.uniforms.uDetail.value = detail;
    this.markerMaterial.uniforms.uTime.value = time;
    for (const m of this.arcMaterials) {
      m.uniforms.uTime.value = time;
      m.uniforms.uOpacity.value = arcs;
    }
  }

  setPixelRatio(pr: number) {
    this.dotMaterial.uniforms.uPixelRatio.value = pr;
  }
}
