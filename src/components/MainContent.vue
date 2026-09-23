<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, watchEffect } from "vue";
import { useLocale } from "../i18n/useLocale";
import { sceneState } from "../three/store";
import { SHOTS } from "../three/story";
import KineticText from "./KineticText.vue";
import Scene3D from "./Scene3D.vue";
import TechTicker from "./TechTicker.vue";

const { t, init } = useLocale();

const clients = [
  { name: "SOKA-BAU", href: "https://www.soka-bau.de/" },
  { name: "Mercedes-Benz.io", href: "https://www.mercedes-benz.io/" },
  { name: "LBBW", href: "https://www.lbbw.de" },
  { name: "GitLab", href: "https://gitlab.com/" },
  { name: "Bilfinger", href: "https://www.bilfinger.com/" },
];

// --- Chapters ---------------------------------------------------------------------------------
// Each chapter is a tall section whose content is pinned (position: sticky) while the page
// scrolls through it. Its local progress (0 → 1) scrubs both the camera and the text animations.

const CHAPTERS = ["hero", "location", "trusted", "services", "contact"] as const;
type Chapter = (typeof CHAPTERS)[number];

/** Camera shot at 20% and at 80% of each chapter; in between the camera flies. */
const SHOT_RANGE: Record<Chapter, [number, number]> = {
  hero: [SHOTS.hero, SHOTS.hero],
  location: [SHOTS.location, SHOTS.location],
  trusted: [SHOTS.trusted, SHOTS.trusted],
  services: [SHOTS.services[0], SHOTS.services[2]],
  contact: [SHOTS.contact, SHOTS.contact],
};

const progress = reactive<Record<Chapter, number>>({ hero: 0, location: 0, trusted: 0, services: 0, contact: 0 });
const els: Partial<Record<Chapter, HTMLElement>> = {};
let layout: { id: Chapter; top: number; range: number }[] = [];
let anchors: [y: number, shot: number][] = [];

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const smoothstep = (a: number, b: number, x: number) => {
  const k = clamp((x - a) / (b - a));
  return k * k * (3 - 2 * k);
};
/** Fade in after the chapter pins, fade out before it unpins. */
const envelope = (p: number) => smoothstep(0.06, 0.18, p) * (1 - smoothstep(0.82, 0.94, p));

function measure() {
  const vh = window.innerHeight;
  layout = CHAPTERS.map((id) => {
    const r = els[id]!.getBoundingClientRect();
    return { id, top: r.top + window.scrollY, range: Math.max(1, r.height - vh) };
  });
  anchors = layout.flatMap(({ id, top, range }) => {
    const [a, b] = SHOT_RANGE[id];
    return id === "hero"
      ? [[top, a] as [number, number], [top + range * 0.4, b] as [number, number]]
      : [[top + range * 0.2, a] as [number, number], [top + range * 0.8, b] as [number, number]];
  });
  update();
}

function update() {
  const y = window.scrollY;
  for (const { id, top, range } of layout) progress[id] = clamp((y - top) / range);
  // Piecewise-linear map from scroll position to camera shot.
  let shot = anchors[0]?.[1] ?? 0;
  for (let i = 0; i < anchors.length - 1; i++) {
    const [y0, s0] = anchors[i];
    const [y1, s1] = anchors[i + 1];
    if (y >= y0) shot = y1 > y0 ? s0 + (s1 - s0) * clamp((y - y0) / (y1 - y0)) : s1;
  }
  sceneState.shot = shot;
}

let ticking = false;
function onScroll() {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => {
    ticking = false;
    update();
  });
}

function goTo(id: Chapter) {
  const l = layout.find((c) => c.id === id);
  if (l) window.scrollTo({ top: l.top + l.range * 0.5, behavior: "smooth" });
}

// Re-measure whenever layout changes (styles/fonts arriving, resizes, language switch).
let observer: ResizeObserver | null = null;

onMounted(() => {
  init();
  measure();
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", measure);
  observer = new ResizeObserver(() => measure());
  observer.observe(document.body);
});

onBeforeUnmount(() => {
  window.removeEventListener("scroll", onScroll);
  window.removeEventListener("resize", measure);
  observer?.disconnect();
});

// --- Services stepper ---------------------------------------------------------------------------

const services = computed(() => [t.value.services.webDev, t.value.services.consulting, t.value.services.agility]);
/** 0 → 2 while the camera tours the three towers. */
const serviceStep = computed(() => clamp((progress.services - 0.2) / 0.6) * 2);
const activeService = computed(() => Math.round(serviceStep.value));
const serviceVisibility = (k: number) =>
  clamp(1 - (Math.abs(serviceStep.value - k) - 0.26) * 4) * envelope(progress.services);

watchEffect(() => {
  sceneState.focusLabel = services.value[activeService.value].title;
});

// --- Chapter rail -------------------------------------------------------------------------------

const rail = computed(() =>
  (["location", "trusted", "services", "contact"] as const).map((id, i) => ({
    id,
    n: String(i + 1).padStart(2, "0"),
    label: t.value.chapters[id],
    progress: progress[id],
    active: progress[id] > 0.02 && progress[id] < 0.98,
  })),
);

const heroOut = computed(() => {
  const p = smoothstep(0.05, 0.4, progress.hero);
  return { opacity: 1 - p, transform: `translate3d(0, ${-p * 80}px, 0) scale(${1 - p * 0.06})`, filter: `blur(${p * 8}px)` };
});
</script>

<template>
  <Scene3D />

  <!-- Chapter rail -->
  <nav
    class="fixed right-4 top-1/2 z-40 hidden -translate-y-1/2 flex-col gap-5 transition-opacity duration-700 md:flex"
    :class="sceneState.revealed && progress.hero > 0.3 ? 'opacity-100' : 'pointer-events-none opacity-0'"
    aria-label="Chapters">
    <button
      v-for="c in rail"
      :key="c.id"
      class="group flex items-center justify-end gap-3 font-mono text-[11px] uppercase tracking-[0.2em]"
      @click="goTo(c.id)">
      <span class="transition-all duration-500" :class="c.active ? 'text-cyan-100 opacity-100' : 'text-gray-400 opacity-0 group-hover:opacity-100'">
        {{ c.label }}
      </span>
      <span :class="c.active ? 'text-cyan-200' : 'text-gray-500'">{{ c.n }}</span>
      <span class="relative h-8 w-px bg-white/15">
        <span class="absolute left-0 top-0 w-px bg-cyan-300" :style="{ height: `${c.progress * 100}%` }"></span>
      </span>
    </button>
  </nav>

  <main
    class="relative w-full transition-opacity duration-1000"
    :class="sceneState.revealed ? 'opacity-100' : 'pointer-events-none opacity-0'">
    <!-- Hero -->
    <section id="hero" :ref="(el) => (els.hero = el as HTMLElement)" class="relative h-[170svh]">
      <div class="pointer-events-none sticky top-0 flex h-svh flex-col items-center px-4 pt-[18svh] md:pt-[20svh]">
        <div class="flex flex-col items-center will-change-transform" :style="heroOut">
          <h1
            class="hero-title reveal text-primary py-4 text-center text-6xl font-bold tracking-tight md:text-8xl lg:text-9xl"
            :class="{ 'reveal--in': sceneState.revealed }">
            May Solutions
          </h1>
          <h2
            class="reveal reveal--delay z-10 mt-2 text-center text-base font-normal uppercase tracking-[0.35em] text-gray-200 md:text-xl md:font-light lg:text-2xl"
            :class="{ 'reveal--in': sceneState.revealed }">
            {{ t.hero.tagline }}
          </h2>
        </div>
        <div
          class="reveal reveal--delay-2 absolute bottom-10 flex flex-col items-center gap-3 font-mono text-[10px] uppercase tracking-[0.3em] text-cyan-100/70"
          :class="{ 'reveal--in': sceneState.revealed }"
          :style="{ opacity: sceneState.revealed ? 1 - progress.hero * 4 : 0 }">
          {{ t.intro.scroll }}
          <span class="scroll-line"></span>
        </div>
      </div>
    </section>

    <!-- 01 Frankfurt -->
    <section :ref="(el) => (els.location = el as HTMLElement)" class="relative h-[240svh]">
      <div class="pointer-events-none sticky top-0 h-svh overflow-hidden">
        <div class="scrim scrim--right" :style="{ opacity: envelope(progress.location) }"></div>
        <div class="chapter-text md:left-auto md:right-[12vw] md:text-right">
          <p class="eyebrow" :style="{ opacity: envelope(progress.location) }">01 — {{ t.location.eyebrow }}</p>
          <KineticText tag="h2" class="chapter-heading" :text="t.location.heading" :progress="progress.location" />
          <p class="chapter-body md:ml-auto" :style="{ opacity: envelope(progress.location) }">{{ t.location.body }}</p>
        </div>
      </div>
    </section>

    <!-- 02 Clients -->
    <section :ref="(el) => (els.trusted = el as HTMLElement)" class="relative h-[240svh]">
      <div class="pointer-events-none sticky top-0 h-svh overflow-hidden">
        <div class="scrim scrim--left" :style="{ opacity: envelope(progress.trusted) }"></div>
        <div class="chapter-text">
          <p class="eyebrow" :style="{ opacity: envelope(progress.trusted) }">02 — {{ t.chapters.trusted }}</p>
          <KineticText tag="h2" class="chapter-heading" :text="t.trusted.heading" :progress="progress.trusted" />
          <p class="chapter-body" :style="{ opacity: envelope(progress.trusted) }">{{ t.trusted.body }}</p>
          <ul class="mt-6 flex flex-wrap gap-x-5 gap-y-2" :style="{ opacity: envelope(progress.trusted) }">
            <li v-for="(c, i) in clients" :key="c.name" :style="{ opacity: clamp((progress.trusted - 0.2 - i * 0.03) * 12) }">
              <a :href="c.href" target="_blank" rel="noopener noreferrer" class="client-link pointer-events-auto">{{ c.name }}</a>
            </li>
          </ul>
          <p class="mt-5 font-mono text-[11px] uppercase tracking-[0.2em] text-amber-100/60" :style="{ opacity: envelope(progress.trusted) }">
            ↗ {{ t.trusted.hint }}
          </p>
        </div>
      </div>
    </section>

    <!-- 03 Services -->
    <section :ref="(el) => (els.services = el as HTMLElement)" class="relative h-[420svh]">
      <div class="pointer-events-none sticky top-0 h-svh overflow-hidden">
        <div class="scrim scrim--left" :style="{ opacity: envelope(progress.services) }"></div>
        <div class="chapter-text md:top-[16svh] md:bottom-auto">
          <p class="eyebrow" :style="{ opacity: envelope(progress.services) }">03 — {{ t.services.eyebrow }}</p>
          <KineticText tag="h2" class="chapter-heading" :text="t.services.heading" :progress="progress.services" :exit="0.9" />
          <p class="chapter-body hidden md:block" :style="{ opacity: envelope(progress.services) }">{{ t.services.body }}</p>

          <!-- One service per tower -->
          <div class="relative mt-6 min-h-[17rem] md:mt-8 md:min-h-[16rem]">
            <article
              v-for="(s, k) in services"
              :key="k"
              class="absolute inset-x-0 top-0"
              :style="{
                opacity: serviceVisibility(k),
                transform: `translate3d(0, ${(serviceStep - k) * -40}px, 0)`,
              }"
              :aria-hidden="activeService !== k">
              <p class="font-mono text-sm tracking-[0.2em] text-cyan-200">
                {{ String(k + 1).padStart(2, "0") }} <span class="text-gray-500">/ 03</span>
              </p>
              <h3 class="text-primary mt-2 text-2xl font-semibold tracking-wide md:text-4xl">{{ s.title }}</h3>
              <p class="chapter-body mt-3">{{ s.body }}</p>
            </article>
          </div>
          <div class="mt-4 flex gap-2" :style="{ opacity: envelope(progress.services) }">
            <span v-for="k in 3" :key="k" class="relative h-0.5 w-12 overflow-hidden bg-white/15">
              <span class="absolute inset-y-0 left-0 bg-cyan-300" :style="{ width: `${clamp(serviceStep + 1 - (k - 1)) * 100}%` }"></span>
            </span>
          </div>
        </div>
        <div class="absolute inset-x-0 top-20 md:bottom-28 md:top-auto" :style="{ opacity: envelope(progress.services) }">
          <div class="pointer-events-auto">
            <TechTicker />
          </div>
        </div>
      </div>
    </section>

    <!-- 04 Contact -->
    <section :ref="(el) => (els.contact = el as HTMLElement)" class="relative h-[200svh]">
      <div class="pointer-events-none sticky top-0 h-svh overflow-hidden">
        <div class="scrim scrim--bottom" :style="{ opacity: smoothstep(0.06, 0.18, progress.contact) }"></div>
        <div class="absolute inset-x-0 bottom-[14svh] flex flex-col items-center px-6 text-center">
          <p class="eyebrow" :style="{ opacity: smoothstep(0.06, 0.18, progress.contact) }">04 — {{ t.chapters.contact }}</p>
          <KineticText tag="h2" class="chapter-heading md:text-7xl" :text="t.contact.heading" :progress="progress.contact" :exit="2" />
          <p class="chapter-body mx-auto" :style="{ opacity: smoothstep(0.1, 0.22, progress.contact) }">{{ t.contact.cta }}</p>
          <a
            href="mailto:contact@may-solutions.io"
            class="cta pointer-events-auto mt-8 rounded-full border border-cyan-300/40 bg-cyan-400/10 px-7 py-3 text-lg text-cyan-50 backdrop-blur-sm transition hover:border-cyan-200 hover:bg-cyan-400/20 focus:outline-none focus:ring-2 focus:ring-cyan-200"
            :style="{ opacity: smoothstep(0.14, 0.26, progress.contact), transform: `translateY(${(1 - smoothstep(0.14, 0.26, progress.contact)) * 20}px)` }">
            contact@may-solutions.io
          </a>
        </div>
      </div>
    </section>
  </main>

  <!-- Footer -->
  <footer
    class="relative mx-auto flex justify-center border-t border-gray-500/20 bg-gray-950/60 p-3 backdrop-blur-sm transition-opacity duration-1000"
    :class="sceneState.revealed ? 'opacity-100' : 'opacity-0'">
    <a
      href="/impressum"
      class="rounded-sm text-gray-300 underline-offset-2 transition-all hover:underline focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2">
      {{ t.footer.imprint }}
    </a>
  </footer>
</template>

<style>
.text-primary {
  background: linear-gradient(to top, rgb(148 163 184 / 1), white);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.hero-title {
  filter: drop-shadow(0 4px 30px rgb(0 0 0 / 0.7)) drop-shadow(0 0 60px rgb(34 211 238 / 0.15));
}

@layer components {
/* Text column of a pinned chapter: bottom-left on phones, vertically centred on desktop. */
.chapter-text {
  position: absolute;
  left: 1.5rem;
  right: 1.5rem;
  bottom: 12svh;
  max-width: 36rem;
}
@media (min-width: 768px) {
  .chapter-text {
    left: 8vw;
    right: auto;
    bottom: 22svh;
  }
}
.chapter-heading {
  display: block;
  font-size: clamp(2rem, 4.6vw, 4rem);
  line-height: 1.02;
  font-weight: 700;
  letter-spacing: -0.03em;
  color: white;
  text-shadow: 0 2px 30px rgb(0 0 0 / 0.6);
}
.chapter-body {
  margin-top: 1.25rem;
  max-width: 30rem;
  font-size: 1.05rem;
  line-height: 1.65;
  font-weight: 300;
  color: rgb(209 213 219);
  text-shadow: 0 1px 12px rgb(0 0 0 / 0.8);
}

/* Soft gradient behind the text instead of cards. */
.scrim {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.scrim--left {
  background: linear-gradient(to right, rgb(3 7 18 / 0.85), rgb(3 7 18 / 0.45) 40%, transparent 70%);
}
.scrim--right {
  background: linear-gradient(to left, rgb(3 7 18 / 0.85), rgb(3 7 18 / 0.45) 40%, transparent 70%);
}
.scrim--bottom {
  background: linear-gradient(to top, rgb(3 7 18 / 0.9), rgb(3 7 18 / 0.4) 45%, transparent 75%);
}
@media (max-width: 767px) {
  .scrim--left,
  .scrim--right {
    background: linear-gradient(to top, rgb(3 7 18 / 0.92), rgb(3 7 18 / 0.55) 50%, transparent 80%);
  }
}

.eyebrow {
  margin-bottom: 0.9rem;
  font-family: ui-monospace, Menlo, monospace;
  font-size: 0.72rem;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  color: rgb(165 243 252 / 0.85);
}

}

.client-link {
  position: relative;
  font-size: 1.05rem;
  color: rgb(254 243 199);
  transition: color 0.2s;
}
.client-link::after {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  bottom: -3px;
  height: 1px;
  background: rgb(253 230 138 / 0.6);
  transform: scaleX(0.25);
  transform-origin: left;
  transition: transform 0.3s ease;
}
.client-link:hover::after {
  transform: scaleX(1);
}

.reveal {
  opacity: 0;
  transform: translateY(24px);
  filter: blur(8px);
  transition:
    opacity 1.2s ease,
    transform 1.2s cubic-bezier(0.2, 0.8, 0.2, 1),
    filter 1.2s ease;
}
.reveal--delay {
  transition-delay: 0.25s;
}
.reveal--delay-2 {
  transition-delay: 0.8s;
}
.reveal--in {
  opacity: 1;
  transform: none;
  filter: none;
}
.hero-title.reveal--in {
  filter: drop-shadow(0 4px 30px rgb(0 0 0 / 0.7)) drop-shadow(0 0 60px rgb(34 211 238 / 0.15));
}

.scroll-line {
  display: block;
  width: 1px;
  height: 40px;
  background: linear-gradient(to bottom, rgb(165 243 252 / 0), rgb(165 243 252 / 0.9));
  animation: scroll-line 2s ease-in-out infinite;
  transform-origin: top;
}
@keyframes scroll-line {
  0% {
    transform: scaleY(0);
  }
  50% {
    transform: scaleY(1);
  }
  100% {
    transform: scaleY(1);
    opacity: 0;
  }
}

.cta {
  box-shadow: 0 0 40px rgb(34 211 238 / 0.2);
}
</style>
