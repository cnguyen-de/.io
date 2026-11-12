/**
 * Draws the city model. There is one model, one canvas and one renderer; the page offers several
 * "stages" (elements with `data-stage`), each showing the model in one of the three classic
 * projections:
 *
 *   axo        Fig. 1 — axonometric view, in the hero; turns and rises as the page scrolls
 *   plan       Fig. 2 — site plan, north up; arrives tilted and lies down flat
 *   elevation  Fig. 3 — view from the south, at night
 *
 * The canvas moves into whichever stage is on screen. The projection is orthographic throughout,
 * so every drawing has a true scale, which the page displays.
 */
import {
  BufferGeometry,
  DoubleSide,
  EqualStencilFunc,
  Float32BufferAttribute,
  IncrementStencilOp,
  Mesh,
  OrthographicCamera,
  Points,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector3,
  Vector4,
  WebGLRenderer
} from "three";
import { PLAN } from "../lib/geo";
import { build } from "./build";
import { towers, type View } from "./model";
import {
  LEADERS,
  LINE,
  LINE_CLASSES,
  faceFragment,
  faceVertex,
  flightFragment,
  flightVertex,
  groundFragment,
  groundVertex,
  lightFragment,
  lightVertex,
  lineFragment,
  lineVertex,
  shadowFragment
} from "./shaders";

// --- Small helpers ----------------------------------------------------------------------------------

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const easeOut = (t: number) => 1 - (1 - clamp(t)) ** 3;
/** Frame-rate independent smoothing towards a goal. */
const damp = (a: number, b: number, lambda: number, dt: number) => lerp(a, b, 1 - Math.exp(-lambda * dt));
const rad = (deg: number) => (deg * Math.PI) / 180;
const rgb = (hex: number) => new Vector3(((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255);

/** The model is drawn at most 60 times a second; this is one such frame in milliseconds. */
const FRAME = 1000 / 60;

// --- Style ------------------------------------------------------------------------------------------

/** The two sheets: ink on paper by day, paper on ink at night (same values as global.css). */
const SHEET = {
  paper: {
    surface: 0xf7f7f3,
    ink: 0x0d0f14,
    red: 0x3096dc,
    top: 0xffffff,
    lit: 0xfbfbf8,
    shade: 0xdedfda,
    shadow: 0.085,
    water: 0.07,
    park: 0.05,
    bands: 0.075
  },
  ink: {
    surface: 0x0d0f14,
    ink: 0xf7f7f3,
    red: 0x7cc6f4,
    top: 0x1a1e27,
    lit: 0x161a22,
    shade: 0x10131a,
    shadow: 0,
    water: 0.05,
    park: 0.03,
    bands: 0.05
  }
};

/** Stroke widths in CSS pixels, by line class. */
const WIDTHS: Record<keyof typeof LINE, number> = {
  grid: 1,
  minor: 1,
  rail: 1,
  major: 1.4,
  shore: 1,
  edge: 1.15,
  leader: 1,
  planInk: 1,
  planRed: 1.15
};

// --- Poses ------------------------------------------------------------------------------------------

/** Everything that defines a drawing: what is looked at, from where, at which scale. */
interface Pose {
  /** Point on the ground the view is built around (m). */
  tx: number;
  tz: number;
  /** Where that point sits in the stage, as fractions from the top left. */
  cx: number;
  cy: number;
  /** Direction the model is seen from: 0° = from the south, positive = from the east of that. */
  az: number;
  /** Angle above the horizon: 0° = elevation, 90° = plan. */
  el: number;
  /** Metres per CSS pixel. */
  mpp: number;
  /** Radius of the island of city that is drawn (m). */
  radius: number;
}

const POSE_KEYS = ["tx", "tz", "cx", "cy", "az", "el", "mpp", "radius"] as const;

/** Fig. 1. `u` runs from 0 to 1 while the hero scrolls past: the view rises, turns and widens. */
function axoPose(w: number, h: number, u: number): Pose {
  const wide = smoothstep(520, 1240, w);
  const e = smoothstep(0, 1, u);
  const r0 = lerp(560, 860, wide);
  const r1 = lerp(1150, 1750, wide);
  const mpp0 = r0 / (w * lerp(0.56, 0.37, wide));
  const mpp1 = r1 / Math.min(w * lerp(0.6, 0.45, wide), h * 0.78);
  return {
    tx: lerp(250, 60, e),
    tz: lerp(-10, -260, e),
    cx: lerp(lerp(0.5, 0.69, wide), 0.5, e),
    cy: lerp(lerp(0.74, 0.685, wide), 0.56, e),
    az: lerp(27, -16, e),
    el: lerp(lerp(19, 23, wide), 50, e),
    mpp: lerp(mpp0, mpp1, e),
    radius: lerp(r0, r1, e)
  };
}

/** Fig. 2. `q` runs from 0 (the figure enters the screen) to 1 (it lies flat, north up). */
function planPose(w: number, _h: number, q: number): Pose {
  const e = smoothstep(0.05, 1, q);
  return {
    tx: PLAN.minX + PLAN.width / 2,
    tz: PLAN.minZ + PLAN.height / 2,
    cx: 0.5,
    cy: 0.5,
    az: lerp(-34, 0, e),
    el: lerp(36, 90, e),
    mpp: PLAN.width / w,
    radius: lerp(900, 4200, smoothstep(0, 0.8, q))
  };
}

/** Fig. 3. Wide screens see the skyline from the Messe to the cathedral; narrow ones the banks. */
function elevationPose(w: number, h: number, q: number): Pose {
  // The towers fill the height of the sheet; the scale only gives way a little to fit the Messe in.
  const tall = 430 / h;
  const mpp = Math.min(tall * 1.3, Math.max(tall, 2750 / w));
  const tx = lerp(300, -150, smoothstep(1300, 2700, w * mpp));
  return {
    tx,
    tz: -100,
    cx: 0.5,
    cy: 1 - 1 / h,
    az: lerp(-9, 0, easeOut(q)),
    el: 0,
    mpp,
    radius: lerp(500, 4600, smoothstep(0, 0.9, q))
  };
}

// --- Stages -----------------------------------------------------------------------------------------

interface Label {
  el: HTMLElement;
  at: Vector3;
  side: "left" | "right";
  rank: number;
  tower: number;
  /** The side the text currently sits on. */
  placed: "left" | "right";
  width: number;
  shown: number;
}

interface Stage {
  el: HTMLElement;
  view: View;
  /** Where the canvas goes. */
  slot: HTMLElement;
  /** The element whose scrolling drives the view (the hero section for Fig. 1). */
  track: HTMLElement;
  labels: Label[];
  hover: HTMLElement | null;
  overlay: HTMLElement | null;
  ratio: HTMLElement | null;
  bar: HTMLElement | null;
  barLabel: HTMLElement | null;
  compass: HTMLElement | null;
  names: Record<string, string>;
  width: number;
  height: number;
  /** Where a pinned stage sticks, in pixels from the top of the screen. */
  pinTop: number;
  visible: boolean;
  live: boolean;
  /** Seconds the stage has been drawn for (drives the opening animation). */
  age: number;
  /** View changes made by dragging: turn and tilt, in degrees. */
  turn: number;
  tilt: number;
}

function readStage(el: HTMLElement): Stage {
  const find = (name: string) => el.querySelector<HTMLElement>(`[data-${name}]`);
  const labels = [...el.querySelectorAll<HTMLElement>("[data-at]")].map((label) => {
    const [x, y, z] = label.dataset.at!.split(" ").map(Number);
    return {
      el: label,
      at: new Vector3(x, y, z),
      side: (label.dataset.side ?? "right") as Label["side"],
      rank: Number(label.dataset.rank ?? 0),
      tower: Number(label.dataset.tower ?? -1),
      placed: (label.dataset.side ?? "right") as Label["side"],
      width: 0,
      shown: 0
    };
  });
  return {
    el,
    view: el.dataset.stage as View,
    slot: find("stage-canvas") ?? el,
    track: el.closest<HTMLElement>("[data-stage-track]") ?? el,
    labels: labels.sort((a, b) => a.rank - b.rank),
    hover: find("hover"),
    overlay: find("stage-overlay"),
    ratio: find("scale-ratio"),
    bar: find("scale-bar"),
    barLabel: find("scale-label"),
    compass: find("compass"),
    names: JSON.parse(el.dataset.names ?? "{}"),
    width: 1,
    height: 1,
    pinTop: 0,
    visible: false,
    live: false,
    age: 0,
    turn: 0,
    tilt: 0
  };
}

// --- The engine -------------------------------------------------------------------------------------

export class Engine {
  private renderer: WebGLRenderer;
  private canvas: HTMLCanvasElement;
  private scene = new Scene();
  private camera = new OrthographicCamera(-1, 1, 1, -1, 100, 30000);
  private uniforms;

  private stages: Stage[];
  private active: Stage | null = null;
  private pose: Pose | null = null;
  private observer: IntersectionObserver;
  private resizer: ResizeObserver;

  private raf = 0;
  private last = 0;
  /** When the last frame was due (ms), for the 60 fps cap. */
  private drawn = 0;
  private time = 0;
  private dpr = Math.min(window.devicePixelRatio || 1, 2);
  private frames: number[] = [];

  private plane = new BufferGeometry();
  /** The night flight: seconds lingered on Fig. 3, and progress of the crossing (-1 = on the ground). */
  private flight = { lingered: 0, t: -1, flown: false };

  private pointer = { x: 0, y: 0, inside: false, sx: 0, sy: 0 };
  private drag: { id: number; x: number; y: number } | null = null;
  private released = 0;
  private hovered = -1;
  private hoverAmt = 0;
  private fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  constructor(stageEls: HTMLElement[]) {
    this.canvas = document.createElement("canvas");
    this.canvas.className = "stage__gl";
    this.canvas.setAttribute("aria-hidden", "true");
    this.renderer = new WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      stencil: true,
      powerPreference: "high-performance"
    });
    this.renderer.setPixelRatio(this.dpr);

    this.uniforms = {
      uCentre: { value: new Vector2() },
      uRadius: { value: 0 },
      uSoft: { value: 260 },
      uRise: { value: 230 },
      uSun: { value: new Vector3(-0.56, 0.74, 0.5).normalize() },
      uViewDir: { value: new Vector3(0, 0, 1) },
      uRes: { value: new Vector2(1, 1) },
      uDpr: { value: this.dpr },
      uMpp: { value: 1 },
      uBias: { value: 0 },
      uTime: { value: 0 },
      uSurface: { value: new Vector3() },
      uInk: { value: new Vector3() },
      uRed: { value: new Vector3() },
      uToneTop: { value: new Vector3() },
      uToneLit: { value: new Vector3() },
      uToneShade: { value: new Vector3() },
      uShadow: { value: 0 },
      uWater: { value: 0 },
      uPark: { value: 0 },
      uBands: { value: 0 },
      uPlan: { value: 0 },
      uNight: { value: 0 },
      uFog: { value: new Vector3(0, 1, 0) },
      uHover: { value: -1 },
      uHoverAmt: { value: 0 },
      uLeaders: { value: new Array<number>(LEADERS).fill(0) },
      uFlight: { value: 0 },
      uClass: { value: Array.from({ length: LINE_CLASSES }, () => new Vector4()) },
      uWidth: { value: Object.values(WIDTHS) }
    };

    const { faces, ground, strokes, beacons } = build();
    const material = (vertexShader: string, fragmentShader: string, options: object = {}) =>
      new ShaderMaterial({ uniforms: this.uniforms, vertexShader, fragmentShader, ...options });
    const add = <T extends Mesh | Points>(object: T, order: number) => {
      object.frustumCulled = false;
      object.matrixAutoUpdate = false;
      object.renderOrder = order;
      this.scene.add(object);
      return object;
    };

    // Water and parks lie under everything else.
    add(
      new Mesh(
        ground,
        material(groundVertex, groundFragment, { side: DoubleSide, depthTest: false, depthWrite: false })
      ),
      -1
    );
    // The model: paper faces, pushed back a little so that the strokes on their edges stay on top.
    add(
      new Mesh(
        faces,
        material(faceVertex, faceFragment, {
          side: DoubleSide,
          polygonOffset: true,
          polygonOffsetFactor: 1,
          polygonOffsetUnits: 1
        })
      ),
      0
    );
    // Shadows: the same faces, laid flat. The stencil keeps overlapping shadows from adding up.
    add(
      new Mesh(
        faces,
        material(faceVertex, shadowFragment, {
          defines: { SHADOW: "" },
          side: DoubleSide,
          transparent: true,
          depthWrite: false,
          stencilWrite: true,
          stencilFunc: EqualStencilFunc,
          stencilRef: 0,
          stencilZPass: IncrementStencilOp
        })
      ),
      1
    );
    add(new Mesh(strokes, material(lineVertex, lineFragment, { transparent: true, depthWrite: false })), 2);
    add(new Points(beacons, material(lightVertex, lightFragment, { transparent: true, depthWrite: false })), 3);

    // The night flight (see fly()): nose light, beacon, tail strobe.
    this.plane.setAttribute("position", new Float32BufferAttribute(new Float32Array(9), 3));
    this.plane.setAttribute("aLight", new Float32BufferAttribute([1, 0, 7, 0, 1, 13, 1, 2, 12], 3));
    add(new Points(this.plane, material(flightVertex, flightFragment, { transparent: true, depthWrite: false })), 4);

    this.stages = stageEls.map(readStage);
    this.resizer = new ResizeObserver(() => this.measure());
    this.observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const stage = this.stages.find((s) => s.el === entry.target);
          if (stage) stage.visible = entry.isIntersecting;
        }
        this.choose();
      },
      { rootMargin: "30% 0px" }
    );
    for (const stage of this.stages) {
      this.observer.observe(stage.el);
      this.resizer.observe(stage.slot);
      this.listen(stage);
    }
    window.addEventListener("pointermove", this.onMove, { passive: true });
    // Label widths change once the web fonts are in.
    document.fonts?.ready.then(() => this.measure());
    document.addEventListener("visibilitychange", this.choose);
  }

  // --- Which stage is being drawn -------------------------------------------------------------------

  private choose = () => {
    const next = document.hidden ? null : (this.stages.find((s) => s.visible) ?? null);
    if (next !== this.active) {
      this.active = next;
      this.pose = null;
      this.hovered = -1;
      this.flight = { lingered: 0, t: -1, flown: false };
      if (next) {
        next.slot.appendChild(this.canvas);
        next.turn = next.tilt = 0;
        this.measure();
      }
    }
    if (next && !this.raf) {
      this.last = performance.now();
      this.raf = requestAnimationFrame(this.tick);
    }
  };

  private measure() {
    for (const stage of this.stages) {
      stage.width = stage.slot.clientWidth || 1;
      stage.height = stage.slot.clientHeight || 1;
      stage.pinTop = parseFloat(getComputedStyle(stage.el).top) || 0;
      for (const label of stage.labels) label.width = label.el.offsetWidth;
    }
    const stage = this.active;
    if (!stage) return;
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.setSize(stage.width, stage.height, false);
    this.uniforms.uDpr.value = this.dpr;
    this.uniforms.uRes.value.set(stage.width * this.dpr, stage.height * this.dpr);
  }

  // --- Input ----------------------------------------------------------------------------------------

  private listen(stage: Stage) {
    const el = stage.slot;
    el.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 || stage !== this.active) return;
      this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
      // Mouse drags are followed past the stage's edge; touches stay free to scroll the page.
      if (e.pointerType === "mouse") el.setPointerCapture(e.pointerId);
      stage.el.classList.add("is-dragging");
    });
    el.addEventListener("pointermove", (e) => {
      if (!this.drag || this.drag.id !== e.pointerId) return;
      stage.turn -= ((e.clientX - this.drag.x) / stage.width) * 150;
      if (e.pointerType === "mouse" || stage.view !== "axo")
        stage.tilt += ((e.clientY - this.drag.y) / stage.height) * 70;
      stage.tilt =
        stage.view === "axo"
          ? clamp(stage.tilt, -12, 40)
          : stage.view === "plan"
            ? clamp(stage.tilt, -55, 0)
            : clamp(stage.tilt, 0, 38);
      this.drag.x = e.clientX;
      this.drag.y = e.clientY;
      stage.el.classList.add("is-touched");
    });
    const end = (e: PointerEvent) => {
      if (!this.drag || this.drag.id !== e.pointerId) return;
      this.drag = null;
      this.released = this.time;
      stage.el.classList.remove("is-dragging");
    };
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
    el.addEventListener("pointerleave", () => (this.pointer.inside = false));
  }

  private onMove = (e: PointerEvent) => {
    const stage = this.active;
    if (!stage || e.pointerType !== "mouse") return;
    const rect = stage.slot.getBoundingClientRect();
    this.pointer.x = e.clientX - rect.left;
    this.pointer.y = e.clientY - rect.top;
    this.pointer.inside = e.target === this.canvas;
  };

  // --- Frame ----------------------------------------------------------------------------------------

  private tick = (now: number) => {
    this.raf = 0;
    const stage = this.active;
    if (!stage) return;
    this.raf = requestAnimationFrame(this.tick);

    // Screens that refresh faster than 60 Hz get every second (or third) frame: the drawing gains
    // nothing from more, and the battery loses. Time owed from a late frame is carried over, so
    // refresh rates that are no multiple of 60 still average out to it.
    const since = now - this.drawn;
    if (since < FRAME - 1) return;
    this.drawn = now - clamp(since - FRAME, 0, FRAME);

    const dt = Math.min((now - this.last) / 1000, 0.05);
    this.last = now;
    this.time += dt;
    // The pinned hero stage ends up under the section that follows; nothing to draw then.
    if (stage.view === "axo" && stage.track.getBoundingClientRect().bottom <= stage.pinTop) return;
    stage.age += dt;

    const { width: w, height: h } = stage;
    const goal = this.goal(stage, w, h);
    if (!this.pose) this.pose = { ...goal };
    for (const key of POSE_KEYS) this.pose[key] = damp(this.pose[key], goal[key], key === "radius" ? 5 : 9, dt);

    // The pointer nudges the view a little; the model never quite sits still.
    const p = this.pointer;
    p.sx = damp(p.sx, this.fine ? clamp((p.x / w) * 2 - 1, -1, 1) : 0, 2.5, dt);
    p.sy = damp(p.sy, this.fine ? clamp((p.y / h) * 2 - 1, -1, 1) : 0, 2.5, dt);
    const sway = Math.sin(this.time * 0.17) * 1.6;
    const flat = stage.view === "plan" ? smoothstep(60, 90, this.pose.el) : 0;
    const az = this.pose.az + (sway - p.sx * 3.2) * (1 - flat);
    const el = clamp(this.pose.el + p.sy * 1.6 * (1 - flat) * (stage.view === "elevation" ? 0 : 1), 0, 90);

    this.look(this.pose, az, el, w, h);
    this.style(stage, el, flat);
    this.fly(stage, dt, w, h);
    this.pick(stage, dt);
    this.renderer.render(this.scene, this.camera);

    this.annotate(stage, flat);
    this.report(stage, az, el);
    this.adapt(dt);
    if (!stage.live) {
      stage.live = true;
      stage.el.classList.add("is-live");
    }
  };

  /** Where the view should be right now: the figure's pose, plus what the visitor did to it. */
  private goal(stage: Stage, w: number, h: number): Pose {
    const vh = window.innerHeight;
    let pose: Pose;
    if (stage.view === "axo") {
      // The stage is pinned inside its (taller) track; progress is how far the track has moved on.
      const rect = stage.track.getBoundingClientRect();
      const start = stage.pinTop;
      const run = Math.max(1, rect.height - h * 0.2);
      pose = axoPose(w, h, clamp((start - rect.top) / run));
      // Opening: the island spreads from the centre while the model turns into place.
      pose.radius *= easeOut(stage.age / 2.6);
      pose.az -= (1 - easeOut(stage.age / 3.4)) * 18;
    } else {
      const rect = stage.slot.getBoundingClientRect();
      const q = clamp((vh - rect.top) / (vh * 0.42 + rect.height * 0.5));
      pose = stage.view === "plan" ? planPose(w, h, q) : elevationPose(w, h, q);
      // Plan and elevation are defined by their projection: after a drag they settle back.
      if (!this.drag && this.time - this.released > 1.2) {
        stage.turn = damp(stage.turn, 0, 2.2, 1 / 60);
        stage.tilt = damp(stage.tilt, 0, 2.2, 1 / 60);
      }
    }
    pose.az += stage.turn;
    pose.el = clamp(pose.el + stage.tilt, 0, 90);
    return pose;
  }

  private look(pose: Pose, azDeg: number, elDeg: number, w: number, h: number) {
    const [a, e] = [rad(azDeg), rad(elDeg)];
    const dir = new Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e));
    const cam = this.camera;
    cam.position.set(pose.tx, 0, pose.tz).addScaledVector(dir, 12000);
    cam.up.set(-Math.sin(a) * Math.sin(e), Math.cos(e), -Math.cos(a) * Math.sin(e));
    cam.lookAt(pose.tx, 0, pose.tz);
    cam.left = -pose.cx * w * pose.mpp;
    cam.right = (1 - pose.cx) * w * pose.mpp;
    cam.top = pose.cy * h * pose.mpp;
    cam.bottom = -(1 - pose.cy) * h * pose.mpp;
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();

    const u = this.uniforms;
    u.uViewDir.value.copy(dir);
    u.uCentre.value.set(pose.tx, pose.tz);
    u.uRadius.value = pose.radius;
    u.uMpp.value = pose.mpp;
    u.uTime.value = this.time;
    // Strokes sit about two metres in front of the faces they outline.
    u.uBias.value = (2 * 2) / (cam.far - cam.near);
  }

  private style(stage: Stage, el: number, flat: number) {
    const u = this.uniforms;
    const night = stage.view === "elevation";
    const sheet = night ? SHEET.ink : SHEET.paper;
    u.uSurface.value.copy(rgb(sheet.surface));
    u.uInk.value.copy(rgb(sheet.ink));
    u.uRed.value.copy(rgb(sheet.red));
    u.uToneTop.value.copy(rgb(sheet.top));
    u.uToneLit.value.copy(rgb(sheet.lit));
    u.uToneShade.value.copy(rgb(sheet.shade));
    u.uShadow.value = sheet.shadow;
    u.uWater.value = sheet.water;
    u.uPark.value = sheet.park;
    u.uBands.value = sheet.bands;
    u.uNight.value = night ? 1 : 0;
    u.uPlan.value = flat;
    u.uSoft.value = stage.view === "axo" ? 260 : 420;
    // At night the far towers sink into the dark; depth runs from the camera into the sheet.
    u.uFog.value.set(0.36, 0.465, night ? 0.62 : 0);
    this.renderer.setClearColor(sheet.surface, 1);

    // Seen (almost) edge-on, the base map would collapse into a smear: it only shows from above.
    const lift = night ? smoothstep(3, 16, el) * 0.7 : 1;
    const ink = rgb(sheet.ink);
    const red = rgb(sheet.red);
    const set = (cls: number, colour: Vector3, strength: number) =>
      u.uClass.value[cls].set(colour.x, colour.y, colour.z, strength);
    set(LINE.grid, ink, 0.1 * lift);
    set(LINE.minor, ink, 0.17 * lift);
    set(LINE.rail, ink, 0.25 * lift);
    set(LINE.major, ink, 0.38 * lift);
    set(LINE.shore, ink, 0.34 * lift);
    set(LINE.edge, ink, night ? 0.8 : 1);
    set(LINE.leader, red, stage.view === "axo" ? 1 : 0);
    set(LINE.planInk, ink, stage.view === "plan" ? flat : 0);
    set(LINE.planRed, red, stage.view === "plan" ? flat : 0);
  }

  /**
   * Easter egg: stay with the night skyline for a few seconds and an airliner crosses the sky from
   * the east, descending towards the airport — just its lights, which is all one sees at night.
   * Once per visit to the figure.
   */
  private fly(stage: Stage, dt: number, w: number, h: number) {
    const f = this.flight;
    const pose = this.pose!;
    if (stage.view !== "elevation") {
      f.t = -1;
      this.uniforms.uFlight.value = 0;
      return;
    }
    if (f.t < 0) {
      f.lingered += dt;
      if (!f.flown && f.lingered > 5 && pose.radius > 4000) [f.t, f.flown] = [0, true];
    } else {
      f.t += dt / 22;
      if (f.t >= 1) f.t = -1;
    }
    this.uniforms.uFlight.value = f.t < 0 ? 0 : smoothstep(0, 0.04, f.t) * (1 - smoothstep(0.96, 1, f.t));
    if (f.t < 0) return;
    const span = w * pose.mpp;
    const x = pose.tx + span * (0.5 - pose.cx) + span * (0.56 - 1.12 * f.t);
    const y = h * pose.mpp * lerp(0.86, 0.6, f.t);
    const position = this.plane.getAttribute("position");
    // East to west, nose first: 40 m from nose light to tail strobe, on the viewer's side of the city.
    [-20, 0, 20].forEach((offset, i) => position.setXYZ(i, x + offset, y - offset * 0.04, 1400));
    position.needsUpdate = true;
  }

  // --- Picking --------------------------------------------------------------------------------------

  /** How far a tower has risen (same rule as `growAt` in the shaders). */
  private grown(x: number, z: number) {
    const u = this.uniforms;
    const d = Math.hypot(x - u.uCentre.value.x, z - u.uCentre.value.y);
    return 1 - (1 - clamp((u.uRadius.value - u.uSoft.value * 0.55 - d) / u.uRise.value)) ** 3;
  }

  private origin = new Vector3();
  private pick(stage: Stage, dt: number) {
    let hit = -1;
    if (stage.view === "axo" && this.fine && this.pointer.inside && !this.drag) {
      // A ray straight into the sheet, tested against every named tower's bounding box.
      const ndcX = (this.pointer.x / stage.width) * 2 - 1;
      const ndcY = 1 - (this.pointer.y / stage.height) * 2;
      const o = this.origin.set(ndcX, ndcY, -1).unproject(this.camera);
      const d = this.uniforms.uViewDir.value;
      let nearest = Infinity;
      for (const t of towers) {
        if (!t.name) continue;
        const g = this.grown(t.centre[0], t.centre[1]);
        if (g < 0.6) continue;
        let [t0, t1] = [-Infinity, Infinity];
        const lo = [t.min[0], 0, t.min[2]];
        const hi = [t.max[0], t.top * g, t.max[2]];
        const from = [o.x, o.y, o.z];
        const along = [-d.x, -d.y, -d.z];
        for (let i = 0; i < 3; i++) {
          const inv = 1 / (along[i] || 1e-9);
          const [a, b] = [(lo[i] - from[i]) * inv, (hi[i] - from[i]) * inv];
          t0 = Math.max(t0, Math.min(a, b));
          t1 = Math.min(t1, Math.max(a, b));
        }
        if (t0 <= t1 && t0 < nearest) [nearest, hit] = [t0, t.id];
      }
    }
    if (hit !== this.hovered) {
      this.hovered = hit;
      if (hit >= 0) this.uniforms.uHover.value = hit;
      stage.el.classList.toggle("is-pointing", hit >= 0);
    }
    this.hoverAmt = damp(this.hoverAmt, this.hovered >= 0 ? 1 : 0, 12, dt);
    this.uniforms.uHoverAmt.value = this.hoverAmt;
  }

  // --- Labels ---------------------------------------------------------------------------------------

  private v = new Vector3();
  private project(at: Vector3, stage: Stage, grow: number) {
    const p = this.v.set(at.x, at.y * grow, at.z).project(this.camera);
    return [((p.x + 1) / 2) * stage.width, ((1 - p.y) / 2) * stage.height] as const;
  }

  private annotate(stage: Stage, flat: number) {
    if (stage.overlay) stage.overlay.style.opacity = stage.view === "plan" ? (flat * flat).toFixed(3) : "1";

    // Callouts follow their towers; where two would collide, the less important one steps back.
    const placed: [number, number, number, number][] = [];
    const most = stage.width < 640 ? 3 : stage.width < 1024 ? 5 : 99;
    const hoverTower = this.hovered >= 0 ? towers[this.hovered] : null;
    let hoverHasCallout = false;
    for (const label of stage.labels) {
      const tower = towers[label.tower];
      const grow = tower ? this.grown(tower.centre[0], tower.centre[1]) : 1;
      const [x, y] = this.project(label.at, stage, grow);
      // The text goes on its preferred side of the leader, or on the other one if only that is free.
      let side: Label["side"] | null = null;
      let box: [number, number, number, number] = [0, 0, 0, 0];
      for (const candidate of label.side === "left" ? (["left", "right"] as const) : (["right", "left"] as const)) {
        const x0 = candidate === "left" ? x - label.width : x;
        box = [x0, y - 9, x0 + label.width, y + 9];
        const fits = box[0] > 8 && box[2] < stage.width - 8 && box[1] > 8 && box[3] < stage.height - 44;
        const free = placed.every(
          (o) => box[2] < o[0] - 6 || box[0] > o[2] + 6 || box[3] < o[1] - 2 || box[1] > o[3] + 2
        );
        if (fits && free) {
          side = candidate;
          break;
        }
      }
      const show = grow > 0.9 && side !== null && label.rank < most;
      if (show) placed.push(box);
      if (show && tower === hoverTower) hoverHasCallout = true;
      if (show && side !== label.placed) {
        // Switch sides while the label is out of sight.
        if (label.shown < 0.05) {
          label.placed = side!;
          label.el.classList.toggle("callout--left", side === "left");
          label.el.classList.toggle("callout--right", side === "right");
        }
      }
      label.shown = damp(label.shown, show && side === label.placed ? 1 : 0, 10, 1 / 60);
      label.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      label.el.style.opacity = label.shown.toFixed(3);
      label.el.classList.toggle("is-hot", tower === hoverTower);
    }
    // A leader is only drawn while its text is.
    stage.labels.forEach((label) => (this.uniforms.uLeaders.value[label.rank] = label.shown));

    // The tower under the pointer names itself, unless it already carries a callout.
    if (stage.hover) {
      const show = hoverTower && !hoverHasCallout;
      if (show) {
        const [x, y] = this.project(
          new Vector3(hoverTower.centre[0], hoverTower.top + 14, hoverTower.centre[1]),
          stage,
          1
        );
        stage.hover.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
        const name = stage.names[hoverTower.name!] ?? hoverTower.name!;
        const text = `${name}|${Math.round(hoverTower.top)} m`;
        if (stage.hover.dataset.text !== text) {
          stage.hover.dataset.text = text;
          stage.hover.querySelector("[data-hover-name]")!.textContent = name;
          stage.hover.querySelector("[data-hover-height]")!.textContent = `${Math.round(hoverTower.top)} m`;
        }
      }
      stage.hover.style.opacity = show ? "1" : "0";
    }
  }

  // --- Scale bar, scale and compass -----------------------------------------------------------------

  private reported = "";
  private report(stage: Stage, az: number, el: number) {
    const mpp = this.pose!.mpp;
    // A CSS pixel is 1/96 inch, which gives the drawing an honest scale figure.
    const scale = mpp / (0.0254 / 96);
    const step = scale > 20000 ? 1000 : scale > 5000 ? 500 : 100;
    const metres = [1000, 500, 250, 100, 50].find((m) => m / mpp <= Math.min(170, stage.width * 0.24)) ?? 50;
    const key = `${stage.view}|${Math.round(scale / step)}|${metres}|${(metres / mpp).toFixed(1)}|${az.toFixed(1)}|${el.toFixed(1)}`;
    if (key === this.reported) return;
    this.reported = key;
    if (stage.ratio)
      stage.ratio.textContent = `1 : ${(Math.round(scale / step) * step).toLocaleString("en-US").replace(/,/g, " ")}`;
    if (stage.bar) stage.bar.style.width = `${(metres / mpp).toFixed(1)}px`;
    if (stage.barLabel) stage.barLabel.textContent = metres >= 1000 ? `${metres / 1000} km` : `${metres} m`;
    if (stage.compass)
      stage.compass.style.transform = `scaleY(${Math.max(0.16, Math.sin(rad(el))).toFixed(3)}) rotate(${az.toFixed(1)}deg)`;
  }

  // --- Housekeeping ---------------------------------------------------------------------------------

  /** Lowers the render resolution on devices that cannot keep up. */
  private adapt(dt: number) {
    if (this.dpr <= 1) return;
    this.frames.push(dt);
    if (this.frames.length < 80) return;
    const average = this.frames.reduce((a, b) => a + b, 0) / this.frames.length;
    this.frames = [];
    if (average > 1 / 40) {
      this.dpr = Math.max(1, this.dpr - 0.5);
      this.measure();
    }
  }

  start() {
    this.choose();
  }
}
