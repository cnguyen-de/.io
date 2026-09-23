<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, reactive, ref, shallowRef, watch } from "vue";
import type { Experience, HudState } from "../three/Experience";
import { sceneState } from "../three/store";
import { isMobile, prefersReducedMotion } from "../three/utils";
import { useLocale } from "../i18n/useLocale";

const { t } = useLocale();

const canvasRef = ref<HTMLCanvasElement | null>(null);
const labelEls: HTMLElement[] = [];
const focusLabelRef = ref<HTMLElement | null>(null);
const labels = shallowRef<{ name: string; href: string }[]>([]);
const hud = reactive<HudState & { visible: boolean }>({
  lat: 0,
  lon: 0,
  altitude: "",
  phase: "globe",
  lock: false,
  visible: false,
});
const introRunning = ref(false);

let experience: Experience | null = null;

watch(
  () => sceneState.shot,
  (f) => experience?.setShot(f),
);

function onPointer(e: PointerEvent) {
  if (e.pointerType !== "mouse") return;
  experience?.setPointer((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
}

function skip() {
  experience?.skipIntro();
}

const skipEvents = ["wheel", "touchstart", "keydown"] as const;

onMounted(async () => {
  const fallback = () => {
    sceneState.webgl = false;
    sceneState.revealed = true;
  };
  // Never keep the content hidden behind a slow download.
  const safety = setTimeout(() => (sceneState.revealed = true), 15000);

  try {
    const mod = await import("../three/Experience");
    if (!mod.webglAvailable() || !canvasRef.value) return fallback();

    // Full globe → city intro on every visit (skippable); none for reduced motion.
    const intro = prefersReducedMotion() ? 2 : 0;
    introRunning.value = intro < 2;
    hud.visible = true;

    experience = new mod.Experience(canvasRef.value, {
      intro,
      mobile: isMobile(),
      onIntroDone: () => {
        sceneState.revealed = true;
        introRunning.value = false;
        skipEvents.forEach((ev) => window.removeEventListener(ev, skip));
      },
      onHud: (h) => Object.assign(hud, h),
      debugTime: import.meta.env.DEV ? Number(new URLSearchParams(location.search).get("t") ?? NaN) || undefined : undefined,
    });
    labels.value = experience.labels.map((l) => ({ name: l.name, href: l.href }));
    await nextTick();
    experience.attachLabels(labelEls, focusLabelRef.value);
    experience.setShot(sceneState.shot);

    window.addEventListener("pointermove", onPointer, { passive: true });
    skipEvents.forEach((ev) => window.addEventListener(ev, skip, { passive: true }));
    if (intro === 2) sceneState.revealed = true;

    await experience.start();
    clearTimeout(safety);
  } catch (err) {
    console.error("3D scene failed, falling back to static background", err);
    experience?.dispose();
    experience = null;
    fallback();
  }
});

onBeforeUnmount(() => {
  experience?.dispose();
  window.removeEventListener("pointermove", onPointer);
  skipEvents.forEach((ev) => window.removeEventListener(ev, skip));
});

const fmt = (v: number, pos: string, neg: string) => `${Math.abs(v).toFixed(4)}° ${v >= 0 ? pos : neg}`;
</script>

<template>
  <div aria-hidden="true" class="pointer-events-none fixed inset-0 -z-10 h-lvh w-full">
    <div
      v-if="!sceneState.webgl"
      class="absolute inset-0 bg-[url('/hero.webp')] bg-cover bg-center bg-no-repeat blur-3xl"></div>
    <canvas v-else ref="canvasRef" class="block h-full w-full"></canvas>

    <!-- Client names riding on the arcs, projected from 3D -->
    <a
      v-for="(label, i) in labels"
      :key="label.name"
      :ref="(el) => (labelEls[i] = el as HTMLElement)"
      :href="label.href"
      target="_blank"
      rel="noopener noreferrer"
      tabindex="-1"
      class="scene-label scene-label--client absolute left-0 top-0"
      style="visibility: hidden; opacity: 0">
      <span class="scene-label__dot"></span>
      <span class="scene-label__text">{{ label.name }}</span>
    </a>
    <div ref="focusLabelRef" class="scene-label scene-label--focus absolute left-0 top-0" style="visibility: hidden; opacity: 0">
      <span class="scene-label__text">{{ sceneState.focusLabel }}</span>
    </div>
  </div>

  <!-- HUD -->
  <div
    v-if="hud.visible"
    aria-hidden="true"
    class="pointer-events-none fixed bottom-4 left-4 z-40 font-mono text-[10px] uppercase leading-relaxed tracking-[0.2em] text-cyan-200/70 md:bottom-6 md:left-6 md:text-[11px]">
    <div class="flex items-center gap-2">
      <span class="inline-block size-1.5 animate-pulse rounded-full bg-cyan-300"></span>
      <span v-if="hud.phase === 'globe' && !hud.lock">{{ t.intro.acquiring }}</span>
      <span v-else>{{ t.intro.locked }}</span>
    </div>
    <div class="tabular-nums">{{ fmt(hud.lat, "N", "S") }} · {{ fmt(hud.lon, "E", "W") }}</div>
    <div class="tabular-nums">ALT {{ hud.altitude }}</div>
  </div>

  <Transition name="fade">
    <button
      v-if="introRunning"
      class="fixed bottom-5 right-4 z-50 rounded-full border border-white/15 bg-black/30 px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-gray-300 backdrop-blur-sm transition hover:border-white/40 hover:text-white md:bottom-6 md:right-6"
      @click="skip">
      {{ t.intro.skip }} →
    </button>
  </Transition>
</template>

<style>
.scene-label {
  will-change: transform, opacity;
  transition: opacity 0.2s linear;
}
.scene-label__dot {
  position: absolute;
  left: -3px;
  top: -3px;
  width: 6px;
  height: 6px;
  border-radius: 9999px;
  background: rgb(103 232 249);
  box-shadow: 0 0 12px 2px rgb(34 211 238 / 0.8);
}
.scene-label__text {
  position: absolute;
  left: 0;
  bottom: 10px;
  transform: translateX(-50%);
  white-space: nowrap;
  padding: 2px 8px;
  border: 1px solid rgb(165 243 252 / 0.25);
  border-radius: 9999px;
  background: rgb(3 7 18 / 0.6);
  color: rgb(207 250 254);
  font-family: ui-monospace, Menlo, monospace;
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  backdrop-filter: blur(4px);
}
.scene-label--client .scene-label__text {
  font-size: 13px;
  letter-spacing: 0.08em;
  text-transform: none;
  padding: 5px 12px;
  border-color: rgb(253 230 138 / 0.5);
  color: rgb(254 243 199);
  box-shadow: 0 0 30px rgb(251 191 36 / 0.25);
  transition: border-color 0.2s, background 0.2s;
}
.scene-label--client .scene-label__dot {
  background: rgb(253 230 138);
  box-shadow: 0 0 12px 2px rgb(251 191 36 / 0.8);
}
@media (max-width: 767px) {
  .scene-label--client {
    display: none;
  }
}
.scene-label--client:hover .scene-label__text {
  border-color: rgb(253 230 138);
  background: rgb(120 53 15 / 0.5);
}
.scene-label--focus .scene-label__text {
  bottom: 0;
  font-size: 13px;
  padding: 6px 14px;
  border-color: rgb(103 232 249 / 0.8);
  color: white;
  box-shadow: 0 0 40px rgb(34 211 238 / 0.45);
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.6s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
