import * as THREE from "three";
import { easeInOutCubic } from "./utils";

/** Seconds for one pass across the screen. */
const FLIGHT_TIME = 11;

/**
 * Easter egg: a small airliner crossing the night sky with blinking navigation lights
 * (red on the left wingtip, green on the right, white strobes) — which is all you'd
 * really see of a plane at night.
 */
export class Plane {
  readonly group = new THREE.Group();
  private lights: THREE.Points;
  private lightMaterial: THREE.ShaderMaterial;
  private start = new THREE.Vector3();
  private end = new THREE.Vector3();
  private t = -1;

  constructor(pixelRatio: number) {
    // Body along +x (direction of flight), wings along z, all in metres.
    const dark = new THREE.MeshBasicMaterial({ color: 0x0b0f1a });
    const fuselage = new THREE.CylinderGeometry(2, 2, 38, 10).rotateZ(Math.PI / 2);
    const nose = new THREE.ConeGeometry(2, 5, 10).rotateZ(-Math.PI / 2).translate(21.5, 0, 0);
    const wings = new THREE.BoxGeometry(9, 0.6, 36).translate(1, -0.5, 0);
    const tailfin = new THREE.BoxGeometry(6, 8, 0.6).translate(-16, 4, 0);
    const stabiliser = new THREE.BoxGeometry(4, 0.5, 13).translate(-17, 1, 0);
    for (const g of [fuselage, nose, wings, tailfin, stabiliser]) this.group.add(new THREE.Mesh(g, dark));

    // Nav lights: position, colour, blink pattern (0 steady, 1 strobe, 2 beacon).
    const lights: [number, number, number, number, number, number, number][] = [
      [1, -0.5, -18.5, 1.0, 0.12, 0.08, 0], // left wingtip, red
      [1, -0.5, 18.5, 0.1, 1.0, 0.35, 0], // right wingtip, green
      [1, -0.5, -18.5, 1.0, 1.0, 1.0, 1], // wingtip strobes
      [1, -0.5, 18.5, 1.0, 1.0, 1.0, 1],
      [-19, 1.5, 0, 1.0, 1.0, 1.0, 1], // tail strobe
      [0, -2.2, 0, 1.0, 0.2, 0.1, 2], // belly beacon
    ];
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(lights.flatMap((l) => l.slice(0, 3)), 3));
    geo.setAttribute("aColor", new THREE.Float32BufferAttribute(lights.flatMap((l) => l.slice(3, 6)), 3));
    geo.setAttribute("aKind", new THREE.Float32BufferAttribute(lights.map((l) => l[6]), 1));
    this.lightMaterial = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uPixelRatio: { value: pixelRatio } },
      vertexShader: /* glsl */ `
        uniform float uTime;
        uniform float uPixelRatio;
        attribute vec3 aColor;
        attribute float aKind;
        varying vec3 vColor;
        varying float vOn;
        void main() {
          float strobe = step(fract(uTime * 0.8), 0.06);                      // double flash
          strobe = max(strobe, step(abs(fract(uTime * 0.8) - 0.12), 0.03));
          float beacon = step(fract(uTime * 1.1 + 0.4), 0.18);
          vOn = aKind < 0.5 ? 1.0 : (aKind < 1.5 ? strobe : beacon);
          vColor = aColor;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = clamp(9000.0 / -mv.z, 3.0, 16.0) * uPixelRatio * (aKind > 0.5 && aKind < 1.5 ? 1.4 : 1.0);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        varying vec3 vColor;
        varying float vOn;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.0, d) * vOn;
          if (a < 0.01) discard;
          gl_FragColor = vec4(vColor * 3.0, a);
        }`,
    });
    this.lights = new THREE.Points(geo, this.lightMaterial);
    this.lights.frustumCulled = false;
    this.group.add(this.lights);
    this.group.visible = false;
  }

  get flying() {
    return this.t >= 0;
  }

  /** Start a pass across the view of `camera`, from left to right, high in the sky. */
  fly(camera: THREE.PerspectiveCamera) {
    const forward = camera.getWorldDirection(new THREE.Vector3());
    forward.y = 0;
    forward.normalize();
    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
    const distance = 1500;
    const centre = camera.position.clone().addScaledVector(forward, distance);
    // Put it in the upper part of the frame: a third of the way up the view frustum.
    const halfHeight = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * distance;
    centre.y = camera.position.y + halfHeight * 0.45;
    const halfWidth = halfHeight * camera.aspect * 1.35;
    this.start.copy(centre).addScaledVector(right, -halfWidth).addScaledVector(forward, 250).add(new THREE.Vector3(0, -40, 0));
    this.end.copy(centre).addScaledVector(right, halfWidth).addScaledVector(forward, -150).add(new THREE.Vector3(0, 60, 0));
    this.t = 0;
    this.group.visible = true;
  }

  update(dt: number, time: number) {
    this.lightMaterial.uniforms.uTime.value = time;
    if (this.t < 0) return;
    this.t += dt / FLIGHT_TIME;
    if (this.t >= 1) {
      this.t = -1;
      this.group.visible = false;
      return;
    }
    // Near-constant cruise speed; only the very ends ease.
    const k = THREE.MathUtils.lerp(this.t, easeInOutCubic(this.t), 0.15);
    this.group.position.lerpVectors(this.start, this.end, k);
    const dir = this.end.clone().sub(this.start).normalize();
    this.group.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir);
    this.group.rotateX(-0.06); // a gentle bank
  }

  setPixelRatio(pr: number) {
    this.lightMaterial.uniforms.uPixelRatio.value = pr;
  }
}
