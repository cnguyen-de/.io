/**
 * The drawing style, as shaders. Everything is flat ink-on-paper: faces carry one of three paper
 * tones, edges are constant-width pen strokes, and shadows are the model itself, laid flat on the
 * ground along the sun's direction. Colours are plain sRGB values, mixed like on the page.
 */

/** Line classes; the order is also the order in which strokes are laid down. */
export const LINE = {
  grid: 0,
  minor: 1,
  rail: 2,
  major: 3,
  shore: 4,
  edge: 5,
  leader: 6,
  planInk: 7
} as const;
export const LINE_CLASSES = Object.keys(LINE).length;
/** Callout leaders can be switched off one by one (by the callout's rank). */
export const LEADERS = 12;

/** How a stroke behaves: silhouette strokes only show where a surface turns away from the viewer. */
export const MODE = { always: 0, silhouette: 1, grows: 2 } as const;

const common = /* glsl */ `
  uniform vec2 uCentre;
  uniform float uRadius;
  uniform float uSoft;
  uniform float uRise;
  uniform vec3 uSurface;
  uniform vec3 uInk;
  uniform vec3 uFog;

  // The drawing is a round island: it fades into the sheet at its rim …
  float revealAt(vec2 xz) {
    return 1.0 - smoothstep(uRadius - uSoft, uRadius, distance(xz, uCentre));
  }
  // … and buildings rise out of the plan a little inside of it.
  float growAt(vec2 c) {
    float t = clamp((uRadius - uSoft * 0.55 - distance(c, uCentre)) / uRise, 0.0, 1.0);
    return 1.0 - pow(1.0 - t, 3.0);
  }
  // Depth haze, for the elevation: far buildings sink into the sheet.
  float hazeAt(float depth) {
    return uFog.z * smoothstep(uFog.x, uFog.y, depth);
  }
`;

// --- Faces (and, flattened, their shadows) --------------------------------------------------------

export const faceVertex = /* glsl */ `
  ${common}
  attribute vec4 aInfo; // tower centre (xz), tower id, distance along the wall (-1 on roofs)
  uniform vec3 uSun;
  varying vec3 vNormal;
  varying vec3 vWorld;
  varying vec4 vInfo;
  varying float vHeight;

  void main() {
    vec3 p = position;
    p.y *= growAt(aInfo.xy);
    #ifdef SHADOW
      p.xz -= uSun.xz * (p.y / uSun.y);
      p.y = 0.0;
    #endif
    vNormal = normal;
    vWorld = p;
    vInfo = aInfo;
    vHeight = position.y;
    gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
  }
`;

export const faceFragment = /* glsl */ `
  ${common}
  uniform vec3 uSun;
  uniform vec3 uRed;
  uniform vec3 uToneTop;
  uniform vec3 uToneLit;
  uniform vec3 uToneShade;
  uniform float uPlan;
  uniform float uNight;
  uniform float uBands;
  uniform float uHover;
  uniform float uHoverAmt;
  uniform float uMpp;
  varying vec3 vNormal;
  varying vec3 vWorld;
  varying vec4 vInfo;
  varying float vHeight;

  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  void main() {
    vec3 n = normalize(vNormal);
    float wall = 1.0 - smoothstep(0.3, 0.9, n.y);
    vec2 side = n.xz / max(length(n.xz), 1e-4);
    float lit = smoothstep(-0.25, 0.5, dot(side, normalize(uSun.xz)));
    vec3 tone = mix(uToneTop, mix(uToneShade, uToneLit, lit), wall);

    // Storey bands on the façades, as long as they are wide enough apart to be drawn.
    float storey = vHeight / 7.5;
    float fw = fwidth(storey);
    float band = 1.0 - smoothstep(0.0, fw * 1.25, abs(fract(storey - 0.5) - 0.5));
    band *= wall * uBands * (1.0 - smoothstep(0.16, 0.4, fw));
    tone = mix(tone, uInk, band);

    // At night some windows are lit.
    if (uNight > 0.0 && vInfo.w >= 0.0) {
      // Windows are grouped into larger panes when the drawing gets too small for single ones.
      float group = max(1.0, ceil(uMpp / 1.25));
      vec2 cell = vec2(vInfo.w / 6.5, vHeight / 3.75) / group;
      vec2 fc = fwidth(cell);
      vec2 f = fract(cell);
      vec2 pane = smoothstep(vec2(0.18, 0.22), vec2(0.18, 0.22) + fc, f) * (1.0 - smoothstep(vec2(0.82, 0.78) - fc, vec2(0.82, 0.78), f));
      float on = step(0.84, hash(floor(cell) + vInfo.z * 3.7));
      float small = 1.0 - smoothstep(0.35, 0.8, max(fc.x, fc.y));
      tone = mix(tone, uInk, uNight * wall * on * pane.x * pane.y * small * 0.62);
    }

    tone = mix(tone, uRed, 0.2 * uHoverAmt * (1.0 - step(0.5, abs(vInfo.z - uHover))));
    tone = mix(tone, uInk, uPlan);

    vec3 col = mix(uSurface, tone, revealAt(vWorld.xz));
    col = mix(col, uSurface, hazeAt(gl_FragCoord.z));
    gl_FragColor = vec4(col, 1.0);
  }
`;

export const shadowFragment = /* glsl */ `
  ${common}
  uniform float uShadow;
  varying vec3 vWorld;

  void main() {
    float a = uShadow * revealAt(vWorld.xz);
    if (a < 0.004) discard;
    gl_FragColor = vec4(uInk, a);
  }
`;

// --- Ground: water and parks ----------------------------------------------------------------------

export const groundVertex = /* glsl */ `
  attribute float aKind;
  varying vec2 vXZ;
  varying float vKind;

  void main() {
    vXZ = position.xz;
    vKind = aKind;
    gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0);
  }
`;

export const groundFragment = /* glsl */ `
  ${common}
  uniform float uWater;
  uniform float uPark;
  uniform float uMpp;
  uniform float uTime;
  varying vec2 vXZ;
  varying float vKind;

  void main() {
    float tone;
    if (vKind < 0.5) {
      // Water: a flat wash with a few drifting ripple strokes.
      vec2 q = vec2(vXZ.x * 0.5 + vXZ.y * 0.25, vXZ.y);
      float row = floor(q.y / 26.0);
      float along = q.x / 150.0 + row * 0.37 + uTime * 0.012 * (mod(row, 2.0) < 0.5 ? 1.0 : -0.7);
      float dash = smoothstep(0.62, 0.7, fract(along)) * (1.0 - smoothstep(0.9, 0.98, fract(along)));
      float across = abs(fract(q.y / 26.0) - 0.5) * 26.0;
      float ripple = dash * (1.0 - smoothstep(uMpp * 0.4, uMpp * 1.1, across)) * (1.0 - smoothstep(2.4, 4.5, uMpp));
      tone = uWater + ripple * 0.11;
    } else {
      // Parks: stippled, like on a survey sheet.
      vec2 g = vXZ / 15.0;
      vec2 f = fract(g + vec2(0.5 * mod(floor(g.y), 2.0), 0.0)) - 0.5;
      float dotMask = 1.0 - smoothstep(1.3, 1.3 + uMpp, length(f) * 15.0);
      tone = uPark * 0.3 + dotMask * uPark * 3.2 * (1.0 - smoothstep(1.6, 4.2, uMpp));
    }
    gl_FragColor = vec4(mix(uSurface, uInk, tone * revealAt(vXZ)), 1.0);
  }
`;

// --- Pen strokes ----------------------------------------------------------------------------------

export const lineVertex = /* glsl */ `
  ${common}
  attribute vec3 aA;
  attribute vec3 aB;
  attribute vec3 aN1;
  attribute vec3 aN2;
  attribute vec4 aInfo;  // tower centre (xz), tower id, rank of the callout (leaders only)
  attribute vec2 aStyle; // class, mode
  uniform vec4 uClass[${LINE_CLASSES}]; // rgb, strength
  uniform float uWidth[${LINE_CLASSES}];
  uniform vec3 uViewDir;
  uniform vec2 uRes;
  uniform float uDpr;
  uniform float uBias;
  uniform float uLeaders[${LEADERS}];
  uniform float uHover;
  uniform float uHoverAmt;
  uniform vec3 uRed;
  varying vec3 vColor;
  varying float vStrength;
  varying float vAcross;
  varying float vHalf;
  varying vec2 vXZ;

  void main() {
    int cls = int(aStyle.x + 0.5);
    vec4 style = uClass[cls];
    bool grows = aStyle.y > 1.5;
    bool silhouette = mod(aStyle.y, 2.0) > 0.5;

    float g = grows ? growAt(aInfo.xy) : 1.0;
    vec3 a = aA;
    vec3 b = aB;
    a.y *= g;
    b.y *= g;

    bool hide = style.a < 0.004;
    float leader = cls == ${LINE.leader} ? uLeaders[int(aInfo.w + 0.5)] : 1.0;
    if (leader < 0.02) hide = true;
    if (silhouette && dot(aN1, uViewDir) * dot(aN2, uViewDir) > 0.0) hide = true;

    vec4 ca = projectionMatrix * viewMatrix * vec4(a, 1.0);
    vec4 cb = projectionMatrix * viewMatrix * vec4(b, 1.0);
    vec2 px = uRes * 0.5;
    vec2 d = cb.xy / cb.w * px - ca.xy / ca.w * px;
    float len = length(d);
    if (len < 0.05) hide = true;
    vec2 dir = len > 1e-4 ? d / len : vec2(1.0, 0.0);
    vec2 nrm = vec2(-dir.y, dir.x);

    float w = uWidth[cls] * uDpr;
    float reach = w * 0.5 + 1.0;
    vec4 c = mix(ca, cb, position.x);
    c.xy += (nrm * position.y * reach + dir * (position.x * 2.0 - 1.0) * w * 0.5) / px * c.w;
    c.z -= uBias * c.w;

    vColor = mix(style.rgb, uRed, uHoverAmt * (grows && cls == ${LINE.edge} ? 1.0 - step(0.5, abs(aInfo.z - uHover)) : 0.0));
    vStrength = style.a * leader;
    vAcross = position.y * reach;
    vHalf = w * 0.5;
    vXZ = mix(a.xz, b.xz, position.x);
    gl_Position = hide ? vec4(2.0, 2.0, 2.0, 1.0) : c;
  }
`;

export const lineFragment = /* glsl */ `
  ${common}
  varying vec3 vColor;
  varying float vStrength;
  varying float vAcross;
  varying float vHalf;
  varying vec2 vXZ;

  void main() {
    float alpha = 1.0 - smoothstep(vHalf - 0.5, vHalf + 0.5, abs(vAcross));
    float s = vStrength * revealAt(vXZ) * (1.0 - hazeAt(gl_FragCoord.z));
    // Strokes are opaque and pre-mixed with the paper, so crossings don't darken.
    gl_FragColor = vec4(mix(uSurface, vColor, s), alpha);
  }
`;

// --- Lights: obstruction lights on the towers and the night flight ----------------------------------

export const lightVertex = /* glsl */ `
  ${common}
  attribute vec4 aInfo; // tower centre (xz), phase, size
  uniform float uTime;
  uniform float uDpr;
  uniform float uNight;
  varying float vGlow;

  void main() {
    vec3 p = position;
    p.y *= growAt(aInfo.xy);
    // A slow double flash, out of step from tower to tower.
    float t = fract(uTime * 0.42 + aInfo.z);
    float flash = smoothstep(0.0, 0.04, t) * (1.0 - smoothstep(0.1, 0.5, t));
    vGlow = uNight * revealAt(p.xz) * (0.22 + 0.78 * flash);
    gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
    gl_Position.z -= 0.002 * gl_Position.w;
    gl_PointSize = aInfo.w * uDpr;
  }
`;

export const lightFragment = /* glsl */ `
  uniform vec3 uRed;
  varying float vGlow;

  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float core = 1.0 - smoothstep(0.12, 0.3, d);
    float halo = pow(max(0.0, 1.0 - d), 2.4) * 0.55;
    float a = (core + halo) * vGlow;
    if (a < 0.004) discard;
    gl_FragColor = vec4(uRed, a);
  }
`;

// The night flight: three lights of an airliner on approach — a steady one, a red beacon, a strobe.
export const flightVertex = /* glsl */ `
  attribute vec3 aLight; // 1 = paper white / 0 = red, kind (0 steady, 1 beacon, 2 strobe), size
  uniform float uTime;
  uniform float uDpr;
  uniform float uFlight;
  varying float vGlow;
  varying float vWhite;

  void main() {
    float t = fract(uTime * 0.9);
    float beacon = smoothstep(0.0, 0.05, t) * (1.0 - smoothstep(0.12, 0.3, t));
    float strobe = step(0.5, t) * step(t, 0.54) + step(0.62, t) * step(t, 0.66);
    vGlow = uFlight * (aLight.y < 0.5 ? 0.8 : aLight.y < 1.5 ? beacon : strobe);
    vWhite = aLight.x;
    gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0);
    gl_PointSize = aLight.z * uDpr;
  }
`;

export const flightFragment = /* glsl */ `
  uniform vec3 uRed;
  uniform vec3 uInk;
  varying float vGlow;
  varying float vWhite;

  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float a = ((1.0 - smoothstep(0.14, 0.34, d)) + pow(max(0.0, 1.0 - d), 2.4) * 0.5) * vGlow;
    if (a < 0.004) discard;
    gl_FragColor = vec4(mix(uRed, uInk, vWhite), a);
  }
`;
