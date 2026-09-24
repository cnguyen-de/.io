import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { City } from "./city";
import { FRANKFURT, ORIGIN } from "./frankfurt";
import { GLOBE_RADIUS, Globe } from "./globe";
import { Plane } from "./plane";
import { SERVICE_TOWERS } from "./story";
import { clamp, damp, easeInCubic, easeInOutCubic, lerp, mulberry32, smoothstep } from "./utils";


interface Shot {
  pos: THREE.Vector3;
  target: THREE.Vector3;
  tech: number;
  arcs: number;
  drift: number;
  focus?: THREE.Vector3;
}

export interface HudState {
  lat: number;
  lon: number;
  altitude: string;
  phase: "globe" | "city";
  lock: boolean;
}

export interface ExperienceOptions {
  /** 0 = full globe → city intro, 2 = no intro */
  intro: 0 | 2;
  mobile: boolean;
  onIntroDone?: () => void;
  onHud?: (hud: HudState) => void;
  /** Dev only: freeze the intro timeline at this time (seconds). */
  debugTime?: number;
}

// Intro timeline (seconds)
const T_ZOOM_END = 4.1;
const T_SWITCH = 4.85;
const T_REVEAL = 7.4;
const T_END = 8.6;

const finalShader = {
  uniforms: {
    tDiffuse: { value: null },
    uFlash: { value: 0 },
    uBlur: { value: 0 },
    uFade: { value: 1 },
    uTime: { value: 0 },
    uRes: { value: new THREE.Vector2(1, 1) },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uFlash;
    uniform float uBlur;
    uniform float uFade;
    uniform float uTime;
    uniform vec2 uRes;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec2 dir = vUv - 0.5;
      vec3 col;
      if (uBlur > 0.002) {
        col = vec3(0.0);
        for (int i = 0; i < 16; i++) {
          float s = 1.0 - uBlur * 0.4 * float(i) / 15.0;
          col += texture2D(tDiffuse, 0.5 + dir * s).rgb;
        }
        col /= 16.0;
      } else {
        // a hint of chromatic aberration towards the edges
        float ca = dot(dir, dir) * 0.006;
        col = vec3(
          texture2D(tDiffuse, vUv - dir * ca).r,
          texture2D(tDiffuse, vUv).g,
          texture2D(tDiffuse, vUv + dir * ca).b
        );
      }
      float vig = 1.0 - smoothstep(0.35, 0.95, length(dir * vec2(1.0, 0.85)) * 1.25);
      col *= mix(0.45, 1.0, vig);
      col += vec3(0.55, 0.85, 1.0) * uFlash * (1.3 - length(dir));
      col += (hash(vUv * uRes + fract(uTime) * 91.7) - 0.5) * 0.03;
      col *= 1.0 - uFade;
      gl_FragColor = vec4(col, 1.0);
    }`,
};

export class Experience {
  private renderer: THREE.WebGLRenderer;
  private composer: EffectComposer;
  private renderPass: RenderPass;
  private bloom: UnrealBloomPass;
  private finalPass: ShaderPass;

  private globeScene = new THREE.Scene();
  private globeCamera = new THREE.PerspectiveCamera(40, 1, 0.05, 6000);
  private globe: Globe;

  private city: City;
  private plane: Plane;
  private camera = new THREE.PerspectiveCamera(42, 1, 5, 70000);
  private shots: Shot[];

  private phase: "globe" | "city" = "globe";
  private introTime = 0;
  private timeScale = 1;
  private revealed = false;
  private introFinished = false;

  private time = 0;
  private raf = 0;
  private last = performance.now();
  private shotF = 0;
  private pointer = new THREE.Vector2();
  private pointerSmooth = new THREE.Vector2();

  // smoothed camera state for the city
  private camPos = new THREE.Vector3();
  private camTarget = new THREE.Vector3();
  private params = { tech: 0, arcs: 0, focus: 0 };
  private focusPos = new THREE.Vector3();

  private labelEls: HTMLElement[] = [];
  private focusLabelEl: HTMLElement | null = null;
  private hudAccum = 0;
  private pixelRatio: number;
  private frameTimes: number[] = [];
  private disposed = false;

  constructor(
    private canvas: HTMLCanvasElement,
    private opts: ExperienceOptions,
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, opts.mobile ? 1.25 : 1.6);
    this.renderer.setPixelRatio(this.pixelRatio);

    // --- globe
    this.globe = new Globe(this.pixelRatio, !opts.mobile);
    this.globeScene.background = new THREE.Color(0x02040a);
    this.globeScene.add(this.globe.group, this.makeStars());

    // --- city
    this.city = new City(this.pixelRatio, opts.mobile);
    this.plane = new Plane(this.pixelRatio);
    this.city.scene.add(this.plane.group);
    const hq = this.city.hqPosition;
    const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
    const m = opts.mobile;
    this.shots = [
      // hero: bird's-eye view over the banking district, the Main in the foreground
      { pos: m ? v(650, 1500, 2200) : v(750, 950, 1350), target: m ? v(0, 0, -250) : v(-80, 0, -200), tech: 0, arcs: 0, drift: 1 },
      // location: aerial view with the HQ beacon to the north
      { pos: m ? v(900, 2300, 2600) : v(3400, 2500, 1500), target: m ? v(500, 0, -2300) : v(-300, 0, -2500), tech: 0, arcs: 0, drift: 0.4 },
      // trusted: data arcs from the skyline to clients
      { pos: m ? v(7600, 800, 1600) : v(5600, 700, 1900), target: m ? v(-600, 100, 300) : v(-600, 600, 1150), tech: 0.15, arcs: 1, drift: 0.4 },
      // services: the city turns into a hologram; the camera visits one tower per service
      ...SERVICE_TOWERS.map((name, i) => this.towerShot(name, [0.75, 0.15, -0.55][i])),
      // contact: the HQ beacon
      { pos: m ? v(hq.x - 500, 300, hq.z + 1700) : v(hq.x - 1100, 380, hq.z + 1300), target: m ? v(hq.x, 520, hq.z) : v(hq.x - 450, 420, hq.z), tech: 0, arcs: 0.1, drift: 0.6 },
    ];
    this.camPos.copy(this.shots[0].pos);
    this.camTarget.copy(this.shots[0].target);

    // --- post-processing
    this.composer = new EffectComposer(this.renderer);
    this.renderPass = new RenderPass(this.globeScene, this.globeCamera);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.8, 0.45, 0.8);
    this.finalPass = new ShaderPass(finalShader);
    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.composer.addPass(this.finalPass);

    if (opts.intro === 2) this.introTime = T_END;
    if (this.introTime >= T_SWITCH) this.enterCity();

    this.resize();
    window.addEventListener("resize", this.resize);
  }

  /** Orbit shot around a landmark; on desktop the tower sits right of centre, leaving room for text. */
  private towerShot(name: string, azimuth: number): Shot {
    const c = this.city.landmarkPositions.get(name)!;
    const m = this.opts.mobile;
    const dist = m ? 950 : 620;
    const height = m ? 520 : 380;
    const side = m ? 0 : 170;
    const right = new THREE.Vector3(Math.cos(azimuth), 0, -Math.sin(azimuth));
    return {
      pos: new THREE.Vector3(c.x + Math.sin(azimuth) * dist, height, c.z + Math.cos(azimuth) * dist),
      target: new THREE.Vector3(c.x, m ? 40 : 130, c.z).addScaledVector(right, -side),
      tech: 1,
      arcs: 0.08,
      drift: 0.8,
      focus: new THREE.Vector3(c.x, c.y, c.z),
    };
  }

  /** Resolves once heavy async assets (the globe's land mask) are ready; starts rendering. */
  async start() {
    await this.globe.ready.catch(() => undefined);
    if (this.disposed) return;
    this.renderer.compile(this.city.scene, this.camera);
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.tick);
  }

  private makeStars() {
    const rand = mulberry32(3);
    const pos: number[] = [];
    for (let i = 0; i < 2500; i++) {
      const v = new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize().multiplyScalar(2000 + rand() * 1500);
      pos.push(v.x, v.y, v.z);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    return new THREE.Points(
      geo,
      new THREE.PointsMaterial({ color: 0x9fb8ff, size: 1.4, sizeAttenuation: false, transparent: true, opacity: 0.7 }),
    );
  }

  setShot(f: number) {
    this.shotF = clamp(f, 0, this.shots.length - 1);
  }

  /** Easter egg: send a plane across the sky of the current view (ignored while one is flying). */
  flyPlane() {
    if (this.phase === "city" && !this.plane.flying) this.plane.fly(this.camera);
  }

  setPointer(x: number, y: number) {
    this.pointer.set(x, y);
  }

  attachLabels(els: HTMLElement[], focusLabel: HTMLElement | null) {
    this.labelEls = els;
    this.focusLabelEl = focusLabel;
  }

  get labels() {
    return this.city.labels;
  }

  /** Speed through the intro when the visitor gets impatient. */
  skipIntro() {
    if (this.introFinished) return;
    this.timeScale = this.phase === "globe" ? 6 : 3;
  }

  private enterCity() {
    this.phase = "city";
    this.renderPass.scene = this.city.scene;
    this.renderPass.camera = this.camera;
  }

  private size = { w: 0, h: 0, pr: 0 };
  private resize = () => {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    // Mobile browsers fire resize when the URL bar slides; the canvas is sized in lvh so nothing changes.
    if (w === this.size.w && h === this.size.h && this.pixelRatio === this.size.pr) return;
    this.size = { w, h, pr: this.pixelRatio };
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(w, h, false);
    this.composer.setPixelRatio(this.pixelRatio);
    this.composer.setSize(w, h);
    for (const cam of [this.camera, this.globeCamera]) {
      cam.aspect = w / h;
      cam.updateProjectionMatrix();
    }
    this.finalPass.uniforms.uRes.value.set(w * this.pixelRatio, h * this.pixelRatio);
    this.globe.setPixelRatio(this.pixelRatio);
    this.city.uniforms.uPixelRatio.value = this.pixelRatio;
    this.plane.setPixelRatio(this.pixelRatio);
  };

  private tick = () => {
    this.raf = requestAnimationFrame(this.tick);
    const now = performance.now();
    const realDt = (now - this.last) / 1000;
    const dt = Math.min(realDt, 0.05);
    this.last = now;
    this.time += dt;

    // The intro follows the wall clock (even on slow devices) so it always ends on schedule.
    if (this.opts.debugTime !== undefined) this.introTime = this.opts.debugTime;
    else if (!this.introFinished) this.introTime += Math.min(realDt, 0.25) * this.timeScale;
    const t = this.introTime;

    const f = this.finalPass.uniforms;
    f.uTime.value = this.time;
    f.uFade.value = 1 - smoothstep(0, 0.9, t);
    f.uFlash.value = Math.exp(-(((t - T_SWITCH) / 0.2) ** 2)) * 0.6;
    f.uBlur.value = t < T_SWITCH ? smoothstep(T_ZOOM_END - 0.2, T_SWITCH, t) : 1 - smoothstep(T_SWITCH, T_SWITCH + 0.9, t);

    if (t < T_SWITCH) this.updateGlobe(t);
    else {
      if (this.phase === "globe") this.enterCity();
      this.updateCity(t, dt);
    }

    if (!this.revealed && t >= T_REVEAL) {
      this.revealed = true;
      this.opts.onIntroDone?.();
    }
    if (!this.introFinished && t >= T_END) {
      this.introFinished = true;
      this.timeScale = 1;
    }

    this.composer.render(dt);
    this.adaptQuality(dt);
  };

  private updateGlobe(t: number) {
    const lat = THREE.MathUtils.degToRad(FRANKFURT.lat);
    const lon = THREE.MathUtils.degToRad(FRANKFURT.lon);
    const k = easeInOutCubic(clamp((t - 0.2) / (T_ZOOM_END - 0.2)));
    const dive = easeInCubic(clamp((t - T_ZOOM_END) / (T_SWITCH - T_ZOOM_END)));

    const g = this.globe.group;
    g.rotation.set(lerp(0.3, lat, k), lerp(-lon + 1.05, -lon, k) + this.time * 0.02 * (1 - k), 0);

    const R = GLOBE_RADIUS;
    const dist = lerp(lerp(390, 150, k), R + 0.9, dive);
    const cam = this.globeCamera;
    // Slightly off-axis so the globe sits a bit low and the approach feels like a descent.
    cam.position.set(0, lerp(40, 6, k) * (1 - dive), dist);
    cam.lookAt(0, lerp(18, 0, k), 0);
    cam.fov = lerp(40, 75, dive);
    cam.updateProjectionMatrix();

    this.globe.update(this.time, smoothstep(2.4, T_ZOOM_END, t), 1 - smoothstep(2.2, 3.3, t));

    this.emitHud(0, {
      lat: THREE.MathUtils.radToDeg(g.rotation.x),
      lon: -THREE.MathUtils.radToDeg(g.rotation.y),
      altitude: `${Math.max(0, ((dist - R) / R) * 6371).toFixed(0)} km`,
      phase: "globe",
      lock: k > 0.85,
    });
  }

  private shotAt(f: number) {
    const i = Math.min(Math.floor(f), this.shots.length - 2);
    const a = this.shots[i];
    const b = this.shots[i + 1];
    const e = smoothstep(0.15, 0.85, f - i);
    return {
      pos: a.pos.clone().lerp(b.pos, e),
      target: a.target.clone().lerp(b.target, e),
      tech: lerp(a.tech, b.tech, e),
      arcs: lerp(a.arcs, b.arcs, e),
      drift: lerp(a.drift, b.drift, e),
      // The highlight glides from tower to tower; it fades in/out where only one side has a focus.
      focus: (a.focus ?? b.focus)?.clone().lerp(b.focus ?? a.focus!, e),
      focusAmt: lerp(a.focus ? 1 : 0, b.focus ? 1 : 0, e),
    };
  }

  private updateCity(t: number, dt: number) {
    const shot = this.shotAt(this.shotF);

    // slow orbital drift around the target
    const angle = Math.sin(this.time * 0.06) * 0.14 * shot.drift;
    const offset = shot.pos.clone().sub(shot.target).applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
    const goalPos = shot.target.clone().add(offset);

    const lambda = 3.2;
    this.camPos.set(
      damp(this.camPos.x, goalPos.x, lambda, dt),
      damp(this.camPos.y, goalPos.y, lambda, dt),
      damp(this.camPos.z, goalPos.z, lambda, dt),
    );
    this.camTarget.set(
      damp(this.camTarget.x, shot.target.x, lambda, dt),
      damp(this.camTarget.y, shot.target.y, lambda, dt),
      damp(this.camTarget.z, shot.target.z, lambda, dt),
    );
    this.params.tech = damp(this.params.tech, shot.tech, 2.5, dt);
    this.params.arcs = damp(this.params.arcs, shot.arcs, 2.5, dt);
    this.params.focus = damp(this.params.focus, shot.focusAmt, 4, dt);
    if (shot.focus && this.params.focus < 0.02) this.focusPos.copy(shot.focus);
    else if (shot.focus) {
      this.focusPos.set(
        damp(this.focusPos.x, shot.focus.x, lambda, dt),
        damp(this.focusPos.y, shot.focus.y, lambda, dt),
        damp(this.focusPos.z, shot.focus.z, lambda, dt),
      );
    }

    let pos = this.camPos.clone();
    let target = this.camTarget.clone();

    // Intro swoop: from high above the city down into the current shot.
    const u = clamp((t - T_SWITCH) / (T_END - T_SWITCH));
    if (u < 1) {
      const e = easeInOutCubic(u);
      const e2 = easeInOutCubic(clamp(u * 1.25));
      const start = new THREE.Vector3(200, 7800, 900);
      const startTarget = new THREE.Vector3(200, 0, -200);
      const bend = new THREE.Vector3(pos.x * 0.4, 2600, pos.z + 1800);
      const a = start.clone().lerp(bend, e);
      const b = bend.clone().lerp(pos, e);
      pos = a.lerp(b, e);
      target = startTarget.lerp(target, e2);
    }
    this.city.uniforms.uGrow.value = smoothstep(0, 0.8, u);

    // pointer parallax
    this.pointerSmooth.x = damp(this.pointerSmooth.x, this.pointer.x, 3, dt);
    this.pointerSmooth.y = damp(this.pointerSmooth.y, this.pointer.y, 3, dt);
    const cam = this.camera;
    cam.position.copy(pos);
    cam.lookAt(target);
    const dist = pos.distanceTo(target);
    cam.translateX(this.pointerSmooth.x * dist * 0.025);
    cam.translateY(-this.pointerSmooth.y * dist * 0.015);
    cam.lookAt(target);

    const U = this.city.uniforms;
    U.uTime.value = this.time;
    U.uTech.value = this.params.tech;
    U.uArcs.value = this.params.arcs;
    U.uFocus.value.copy(this.focusPos);
    U.uFocusAmt.value = this.params.focus;
    this.city.update(cam);
    this.plane.update(dt, this.time);

    this.bloom.strength = lerp(0.75, 1.0, this.params.tech);
    this.updateLabels();

    const lat = ORIGIN.lat - target.z / 111_200;
    const lon = ORIGIN.lon + target.x / (111_320 * Math.cos((ORIGIN.lat * Math.PI) / 180));
    this.emitHud(dt, { lat, lon, altitude: `${Math.max(0, cam.position.y).toFixed(0)} m`, phase: "city", lock: true });
  }

  private tmp = new THREE.Vector3();
  private project(pos: THREE.Vector3, el: HTMLElement, opacity: number) {
    const p = this.tmp.copy(pos).project(this.camera);
    const onScreen = p.z < 1 && Math.abs(p.x) < 1.1 && Math.abs(p.y) < 1.1;
    const o = onScreen ? opacity : 0;
    el.style.opacity = o.toFixed(3);
    el.style.visibility = o > 0.01 ? "visible" : "hidden";
    el.style.pointerEvents = o > 0.6 ? "auto" : "none";
    el.style.transform = `translate3d(${((p.x + 1) / 2) * this.canvas.clientWidth}px, ${((1 - p.y) / 2) * this.canvas.clientHeight}px, 0)`;
  }

  private updateLabels() {
    const intro = smoothstep(T_REVEAL, T_END, this.introTime);
    this.city.labels.forEach((label, i) => {
      const el = this.labelEls[i];
      // Client names pop in one after another as the arcs light up.
      if (el) this.project(label.position, el, clamp(this.params.arcs * 2.2 - 0.2 * i) * intro);
    });
    if (this.focusLabelEl) {
      this.project(this.tmp2.copy(this.focusPos).setY(this.focusPos.y + 45), this.focusLabelEl, this.params.focus);
    }
  }

  private tmp2 = new THREE.Vector3();

  private emitHud(dt: number, hud: HudState) {
    this.hudAccum += dt;
    if (dt > 0 && this.hudAccum < 0.08) return;
    this.hudAccum = 0;
    this.opts.onHud?.(hud);
  }

  /** Drop the render resolution on slow devices, measured after the intro. */
  private adaptQuality(dt: number) {
    if (!this.introFinished || this.pixelRatio <= 0.75) return;
    this.frameTimes.push(dt);
    if (this.frameTimes.length < 90) return;
    const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    this.frameTimes = [];
    if (avg > 1 / 38) {
      this.pixelRatio = Math.max(0.75, this.pixelRatio - 0.25);
      this.resize();
    }
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener("resize", this.resize);
    this.composer.dispose();
    this.renderer.dispose();
  }
}

export function webglAvailable() {
  try {
    const c = document.createElement("canvas");
    return !!c.getContext("webgl2");
  } catch {
    return false;
  }
}
