<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch, watchEffect } from "vue";
import { useStepScroll } from "../composables/useStepScroll";
import { CLIENTS } from "../data/clients";
import { STACK } from "../data/stack";
import icons from "../data/tech-icons.json";
import { useLocale } from "../i18n/useLocale";
import { sceneState } from "../three/store";
import { SHOTS } from "../three/story";
import { prefersReducedMotion } from "../three/utils";
import KineticText from "./KineticText.vue";
import Scene3D from "./Scene3D.vue";

const { t, init } = useLocale();
const techIcons: Record<string, string> = icons;

// --- Chapters ---------------------------------------------------------------------------------
// Each chapter is a tall section whose content is pinned (position: sticky) while the page
// scrolls through it. Its local progress (0 → 1) scrubs both the camera and the text animations.

const CHAPTERS = ["hero", "location", "trusted", "services", "stack", "contact"] as const;
type Chapter = (typeof CHAPTERS)[number];

/**
 * Scroll stops within each chapter (as chapter progress). Each stop is a moment where the
 * chapter's content is fully shown; one swipe / wheel gesture moves exactly one stop.
 */
const SNAPS: Record<Chapter, number[]> = {
  hero: [0],
  location: [0.5],
  trusted: [0.5],
  services: [0.2, 0.5, 0.8], // one per service
  stack: [0.5],
  contact: [1],
};

/** Camera shot at 20% and at 80% of each chapter; in between the camera flies. */
const SHOT_RANGE: Record<Chapter, [number, number]> = {
  hero: [SHOTS.hero, SHOTS.hero],
  location: [SHOTS.location, SHOTS.location],
  trusted: [SHOTS.trusted, SHOTS.trusted],
  services: [SHOTS.services[0], SHOTS.services[2]],
  stack: [SHOTS.stack, SHOTS.stack],
  contact: [SHOTS.contact, SHOTS.contact],
};

const progress = reactive<Record<Chapter, number>>({ hero: 0, location: 0, trusted: 0, services: 0, stack: 0, contact: 0 });
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

const { scrollTo } = useStepScroll({
  stops: () => layout.flatMap(({ id, top, range }) => SNAPS[id].map((p) => Math.round(top + range * p))),
  enabled: () => sceneState.revealed,
  duration: prefersReducedMotion() ? 350 : 1100,
});

function goTo(id: Chapter, stop = 0) {
  const l = layout.find((c) => c.id === id);
  if (l) scrollTo(Math.round(l.top + l.range * SNAPS[id][stop]));
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

// --- Clients ------------------------------------------------------------------------------------
// One client at a time is singled out: its row lights up and so does its arc in the scene.
// The spotlight wanders down the list on its own and follows the pointer / keyboard focus.

const clientsShown = computed(() => envelope(progress.trusted) > 0.5);
const spotlight = ref(-1);
let spotlightTimer = 0;

function wander(delay: number) {
  spotlightTimer = window.setTimeout(() => {
    if (sceneState.hoverClient < 0) spotlight.value = (spotlight.value + 1) % CLIENTS.length;
    wander(2600);
  }, delay);
}

watch(clientsShown, (shown) => {
  clearTimeout(spotlightTimer);
  spotlight.value = -1;
  if (shown && !prefersReducedMotion()) wander(900);
});
// Carry on from wherever the visitor last pointed.
watch(
  () => sceneState.hoverClient,
  (i) => i >= 0 && (spotlight.value = i),
);
watchEffect(() => {
  sceneState.activeClient = !clientsShown.value ? -1 : sceneState.hoverClient >= 0 ? sceneState.hoverClient : spotlight.value;
});
onBeforeUnmount(() => clearTimeout(spotlightTimer));

/** Rows (and the technology groups below) arrive one after another. */
const stagger = (p: number, i: number, step = 0.03) => smoothstep(0.1 + i * step, 0.2 + i * step, p) * (1 - smoothstep(0.82, 0.94, p));
const rise = (p: number, i: number, step = 0.03) => {
  const v = stagger(p, i, step);
  return { opacity: v, transform: `translate3d(0, ${((1 - v) * 24).toFixed(2)}px, 0)` };
};

// --- Services stepper ---------------------------------------------------------------------------

const services = computed(() => [t.value.services.webDev, t.value.services.consulting, t.value.services.ai]);
/** 0 → 2 while the camera tours the three towers. */
const serviceStep = computed(() => clamp((progress.services - 0.2) / 0.6) * 2);
const activeService = computed(() => Math.round(serviceStep.value));
const serviceVisibility = (k: number) =>
  clamp(1 - (Math.abs(serviceStep.value - k) - 0.26) * 4) * envelope(progress.services);

watchEffect(() => {
  sceneState.focusLabel = services.value[activeService.value].title;
});

// --- Easter egg ---------------------------------------------------------------------------------
// Linger on the contact chapter for 5 s and a plane crosses the sky. Re-arms after leaving.

let planeTimer = 0;
watch(
  () => progress.contact > 0.9,
  (atContact) => {
    clearTimeout(planeTimer);
    if (atContact) planeTimer = window.setTimeout(() => sceneState.planeFlights++, 5000);
  },
);
onBeforeUnmount(() => clearTimeout(planeTimer));

// --- Chapter rail -------------------------------------------------------------------------------

const rail = computed(() =>
  (["location", "trusted", "services", "stack", "contact"] as const).map((id, i) => ({
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

  <!-- pointer-events-none: only links and buttons catch the pointer, so the client chips in the scene stay clickable. -->
  <main
    class="pointer-events-none relative z-10 w-full transition-opacity duration-1000"
    :class="sceneState.revealed ? 'opacity-100' : 'opacity-0'">
    <!-- Hero -->
    <section id="hero" :ref="(el) => (els.hero = el as HTMLElement)" class="relative h-[170svh]">
      <div class="pointer-events-none sticky top-0 flex h-svh flex-col items-center px-4 pt-[18svh] md:pt-[20svh]">
        <!-- A soft pool of shade keeps the name and claim legible over the lit street grid. -->
        <div class="hero-scrim" :style="{ opacity: sceneState.revealed ? 1 - smoothstep(0.05, 0.4, progress.hero) : 0 }"></div>
        <div class="relative flex flex-col items-center will-change-transform" :style="heroOut">
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
          <p
            class="hero-descriptor reveal reveal--delay-2 mt-6 max-w-xs text-balance text-center text-base font-light text-gray-200 md:mt-8 md:max-w-none md:text-xl"
            :class="{ 'reveal--in': sceneState.revealed }">
            {{ t.hero.descriptor }}
            <strong class="font-semibold text-white">{{ t.hero.descriptorStrong }}</strong>
          </p>
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
        <div class="chapter-text chapter-text--clients">
          <p class="eyebrow" :style="{ opacity: envelope(progress.trusted) }">02 — {{ t.chapters.trusted }}</p>
          <!-- The heading stays quiet; the names are the headline. -->
          <h2 class="chapter-kicker" :style="{ opacity: envelope(progress.trusted) }">{{ t.trusted.heading }}</h2>
          <ol class="client-list">
            <li
              v-for="(c, i) in CLIENTS"
              :key="c.id"
              class="client-row"
              :class="{ 'is-active': sceneState.activeClient === i }">
              <span class="client-row__rule" :style="{ opacity: stagger(progress.trusted, i, 0.02) }"></span>
              <a
                :href="c.href"
                target="_blank"
                rel="noopener noreferrer"
                class="client-row__link pointer-events-auto"
                :aria-label="`${c.name} — ${t.trusted.sectors[c.id]}`"
                @pointerenter="sceneState.hoverClient = i"
                @pointerleave="sceneState.hoverClient = -1"
                @focus="sceneState.hoverClient = i"
                @blur="sceneState.hoverClient = -1">
                <span class="client-row__n" :style="{ opacity: stagger(progress.trusted, i, 0.02) }">{{ String(i + 1).padStart(2, "0") }}</span>
                <KineticText class="client-row__name" :text="c.name" :progress="progress.trusted" :enter="0.09 + i * 0.02" />
                <span class="client-row__sector" :style="{ opacity: stagger(progress.trusted, i + 1, 0.02) }">{{ t.trusted.sectors[c.id] }}</span>
                <span class="client-row__arrow" aria-hidden="true">↗</span>
              </a>
            </li>
          </ol>
          <p class="chapter-note client-note mt-6 hidden md:block" :style="{ opacity: envelope(progress.trusted) }">{{ t.trusted.body }}</p>
          <p
            class="mt-4 hidden font-mono text-[11px] uppercase tracking-[0.2em] text-amber-100/60 min-[1100px]:block"
            :style="{ opacity: envelope(progress.trusted) }">
            ↗ {{ t.trusted.hint }}
          </p>
        </div>
      </div>
    </section>

    <!-- 03 Services -->
    <section :ref="(el) => (els.services = el as HTMLElement)" class="relative h-[420svh]">
      <div class="pointer-events-none sticky top-0 h-svh overflow-hidden">
        <div class="scrim scrim--left scrim--services" :style="{ opacity: envelope(progress.services) }"></div>
        <div class="chapter-text chapter-text--services">
          <h2 class="eyebrow" :style="{ opacity: envelope(progress.services) }">03 — {{ t.services.heading }}</h2>

          <!-- All three services at a glance; the current one is spelled out below. -->
          <div class="service-tabs" :style="{ opacity: envelope(progress.services) }">
            <button
              v-for="(s, k) in services"
              :key="k"
              type="button"
              class="service-tab pointer-events-auto"
              :class="{ 'is-active': activeService === k }"
              :aria-current="activeService === k ? 'step' : undefined"
              @click="goTo('services', k)">
              <span class="service-tab__bar"><span :style="{ width: `${clamp(serviceStep + 1 - k) * 100}%` }"></span></span>
              <span class="service-tab__n">{{ String(k + 1).padStart(2, "0") }}</span>
              {{ s.title }}
            </button>
          </div>

          <!-- Services stacked in one grid cell: the block is as tall as the longest one. -->
          <div class="mt-6 grid md:mt-8">
            <article
              v-for="(s, k) in services"
              :key="k"
              class="[grid-area:1/1]"
              :style="{
                opacity: serviceVisibility(k),
                transform: `translate3d(0, ${(serviceStep - k) * -40}px, 0)`,
              }"
              :aria-hidden="activeService !== k">
              <!-- The tab names the category; the heading says what the visitor gets. -->
              <h3 class="service-title" :aria-label="`${s.title}: ${s.claim}`">{{ s.claim }}</h3>
              <p class="service-body">{{ s.body }}</p>
              <dl class="service-spec">
                <div v-for="[label, detail] in s.rows" :key="label">
                  <dt>{{ label }}</dt>
                  <dd>{{ detail }}</dd>
                </div>
                <!-- Proof, in the amber of the client list it points back to. -->
                <div class="service-spec__reference">
                  <dt>{{ t.services.reference }}</dt>
                  <dd>{{ s.reference }}</dd>
                </div>
              </dl>
            </article>
          </div>
          <p class="service-method" :style="{ opacity: envelope(progress.services) }">{{ t.services.method }}</p>
        </div>
      </div>
    </section>

    <!-- 04 Technologies -->
    <section :ref="(el) => (els.stack = el as HTMLElement)" class="relative h-[240svh]">
      <div class="pointer-events-none sticky top-0 h-svh overflow-hidden">
        <div class="scrim scrim--stack" :style="{ opacity: envelope(progress.stack) }"></div>
        <div class="stack">
          <div class="stack__head" :style="{ opacity: envelope(progress.stack) }">
            <div>
              <p class="eyebrow">04 — {{ t.chapters.stack }}</p>
              <h2 class="chapter-kicker">{{ t.stack.heading }}</h2>
            </div>
            <p class="chapter-note hidden lg:block">{{ t.stack.body }}</p>
          </div>
          <div class="stack__grid">
            <section v-for="(g, gi) in STACK" :key="g.id" class="stack-group" :style="rise(progress.stack, gi)">
              <h3 class="stack-group__title">{{ t.stack.groups[g.id] }}</h3>
              <ul class="stack-group__items">
                <li v-for="[slug, name] in g.items" :key="slug" class="stack-item pointer-events-auto">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path :d="techIcons[slug]" /></svg>
                  {{ name }}
                </li>
              </ul>
            </section>
          </div>
        </div>
      </div>
    </section>

    <!-- 05 Contact -->
    <section :ref="(el) => (els.contact = el as HTMLElement)" class="relative h-[200svh]">
      <div class="pointer-events-none sticky top-0 h-svh overflow-hidden">
        <div class="scrim scrim--bottom" :style="{ opacity: smoothstep(0.06, 0.18, progress.contact) }"></div>
        <div class="absolute inset-x-0 bottom-[14svh] flex flex-col items-center px-6 text-center">
          <p class="eyebrow" :style="{ opacity: smoothstep(0.06, 0.18, progress.contact) }">05 — {{ t.chapters.contact }}</p>
          <KineticText tag="h2" class="chapter-heading md:text-7xl" :text="t.contact.heading" :progress="progress.contact" :exit="2" />
          <p class="chapter-body mx-auto" :style="{ opacity: smoothstep(0.1, 0.22, progress.contact) }">{{ t.contact.cta }}</p>
          <a
            href="mailto:contact@may-solutions.io"
            class="cta pointer-events-auto mt-8 rounded-full border border-cyan-300/40 bg-cyan-400/10 px-7 py-3 text-lg text-cyan-50 backdrop-blur-sm transition hover:border-cyan-200 hover:bg-cyan-400/20 focus:outline-none focus:ring-2 focus:ring-cyan-200"
            :style="{ opacity: smoothstep(0.14, 0.26, progress.contact), transform: `translateY(${(1 - smoothstep(0.14, 0.26, progress.contact)) * 20}px)` }">
            contact@may-solutions.io
          </a>
        </div>
        <a
          href="/impressum"
          class="pointer-events-auto absolute bottom-5 right-4 font-mono text-[11px] uppercase tracking-[0.2em] text-gray-400 transition hover:text-white focus:outline-none focus:ring-2 focus:ring-white md:bottom-6 md:right-6"
          :style="{ opacity: smoothstep(0.3, 0.6, progress.contact) }">
          {{ t.footer.imprint }}
        </a>
      </div>
    </section>
  </main>

</template>

<style>
.text-primary {
  background: linear-gradient(to top, rgb(148 163 184 / 1), white);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.hero-scrim {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse 70% 42% at 50% 36%, rgb(3 7 18 / 0.62), rgb(3 7 18 / 0.3) 55%, transparent 100%);
  transition: opacity 1.2s ease;
}
.hero-descriptor {
  text-shadow:
    0 1px 3px rgb(0 0 0 / 0.9),
    0 0 24px rgb(0 0 0 / 0.9);
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
  /* Not text-shadow: KineticText masks each word, which would clip the shadow into a box. */
  filter: drop-shadow(0 2px 14px rgb(0 0 0 / 0.55));
}
.service-title {
  max-width: 34rem;
  font-size: clamp(1.55rem, 2.7vw, 2.6rem);
  line-height: 1.08;
  font-weight: 700;
  letter-spacing: -0.025em;
  text-wrap: balance;
  color: white;
  text-shadow: 0 2px 30px rgb(0 0 0 / 0.6);
}
.service-body {
  margin-top: 0.9rem;
  max-width: 31rem;
  font-size: 1rem;
  line-height: 1.6;
  font-weight: 300;
  color: rgb(209 213 219);
  text-shadow: 0 1px 12px rgb(0 0 0 / 0.8);
}
/* What each service consists of, as a small spec sheet. */
.service-spec {
  margin-top: 1.1rem;
  max-width: 34rem;
  border-bottom: 1px solid rgb(165 243 252 / 0.18);
}
.service-spec > div {
  display: grid;
  grid-template-columns: 7.5rem 1fr;
  align-items: baseline;
  gap: 0.75rem;
  padding: 0.45rem 0;
  border-top: 1px solid rgb(165 243 252 / 0.18);
}
.service-spec dt {
  font-family: ui-monospace, Menlo, monospace;
  font-size: 0.64rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgb(165 243 252 / 0.85);
}
.service-spec dd {
  font-size: 0.93rem;
  font-weight: 500;
  text-wrap: balance;
  color: rgb(243 244 246);
  text-shadow: 0 1px 12px rgb(0 0 0 / 0.8);
}
.service-spec .service-spec__reference dt {
  color: rgb(253 230 138 / 0.9);
}
.service-spec .service-spec__reference dd {
  color: rgb(254 243 199);
}
.service-method {
  margin-top: 1rem;
  max-width: 31rem;
  font-family: ui-monospace, Menlo, monospace;
  font-size: 0.66rem;
  line-height: 1.7;
  letter-spacing: 0.08em;
  color: rgb(156 163 175);
  text-shadow: 0 1px 12px rgb(0 0 0 / 0.8);
}
@media (min-width: 768px) {
  .service-body {
    font-size: 1.05rem;
  }
  .service-spec {
    margin-top: 1.4rem;
  }
  .service-spec > div {
    grid-template-columns: 9.5rem 1fr;
    padding: 0.55rem 0;
  }
  .service-spec dt {
    font-size: 0.68rem;
    letter-spacing: 0.18em;
  }
  .service-spec dd {
    font-size: 1rem;
  }
  .service-method {
    margin-top: 1.25rem;
  }
}
@media (min-width: 768px) {
  .chapter-text--services {
    bottom: 14svh;
  }
}
/* Short phones: claim and spec sheet carry the message; the prose and the method note step aside. */
@media (max-width: 767px) and (max-height: 720px) {
  .service-method,
  .service-body {
    display: none;
  }
  .service-title {
    font-size: 1.4rem;
  }
  .service-spec > div {
    grid-template-columns: 7rem 1fr;
    padding: 0.32rem 0;
  }
  .service-spec dd {
    font-size: 0.86rem;
  }
}
/* Secondary copy that should not compete with the names / technologies it sits next to. */
.chapter-note {
  max-width: 30rem;
  font-size: 0.95rem;
  line-height: 1.6;
  font-weight: 300;
  color: rgb(156 163 175);
  text-shadow: 0 1px 12px rgb(0 0 0 / 0.8);
}
/* A heading that introduces a list: the list is the headline, not this. */
.chapter-kicker {
  font-size: clamp(1.15rem, 1.7vw, 1.5rem);
  line-height: 1.3;
  font-weight: 300;
  color: rgb(229 231 235);
  text-shadow: 0 1px 12px rgb(0 0 0 / 0.8);
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
.scrim--stack {
  background: linear-gradient(to top, rgb(3 7 18 / 0.95), rgb(3 7 18 / 0.82) 45%, rgb(3 7 18 / 0.3) 70%, transparent 88%);
}
@media (max-width: 767px) {
  /* These two chapters carry tall text blocks over the bright hologram city. */
  .scrim--stack,
  .scrim--left.scrim--services {
    background: linear-gradient(to top, rgb(3 7 18 / 0.96), rgb(3 7 18 / 0.86) 70%, transparent 94%);
  }
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

/* --- Clients: the names are the headline ------------------------------------------------------ */
.client-list {
  margin-top: 1.1rem;
}
.client-row {
  position: relative;
}
/* Hairline above each row; the active row's line lights up from the left. */
.client-row__rule {
  position: absolute;
  inset: 0 0 auto 0;
  height: 1px;
  background: rgb(255 255 255 / 0.12);
}
.client-row__rule::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(to right, rgb(253 230 138), rgb(253 230 138 / 0));
  transform: scaleX(0);
  transform-origin: left;
  transition: transform 0.6s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.client-row.is-active .client-row__rule::after {
  transform: scaleX(1);
}
.client-row__link {
  display: grid;
  grid-template-columns: 2rem 1fr;
  align-items: center;
  padding: 0.55rem 0 0.6rem;
  outline: none;
}
.client-row__n {
  font-family: ui-monospace, Menlo, monospace;
  font-size: 0.68rem;
  letter-spacing: 0.15em;
  color: rgb(156 163 175);
  transition: color 0.35s;
}
.client-row__name {
  font-size: clamp(1.55rem, min(3.1vw, 4.2svh), 2.6rem);
  line-height: 1.08;
  font-weight: 700;
  letter-spacing: -0.025em;
  white-space: nowrap;
  color: white;
  transition: color 0.35s;
}
.client-row__sector {
  grid-column: 2;
  margin-top: 0.1rem;
  font-family: ui-monospace, Menlo, monospace;
  font-size: 0.66rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: rgb(156 163 175);
  transition: color 0.35s;
}
.client-row__arrow {
  display: none;
  color: rgb(253 230 138);
  opacity: 0;
  transform: translate(-6px, 6px);
  transition:
    opacity 0.35s,
    transform 0.35s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.client-row.is-active .client-row__name {
  color: rgb(253 230 138);
}
.client-row.is-active .client-row__n,
.client-row.is-active .client-row__sector {
  color: rgb(254 243 199);
}
.client-row.is-active .client-row__arrow {
  opacity: 1;
  transform: none;
}
.client-row__link:focus-visible .client-row__name {
  text-decoration: underline;
  text-decoration-thickness: 2px;
  text-underline-offset: 6px;
}
@media (min-width: 768px) {
  .chapter-text--clients {
    bottom: 13svh;
    max-width: 30rem;
  }
  .client-row__link {
    grid-template-columns: 2.5rem 1fr 1.5rem;
    padding: 0.6rem 0 0.7rem;
  }
  .client-row__arrow {
    display: block;
    grid-column: 3;
    grid-row: 1;
    justify-self: end;
    font-size: 1.1rem;
  }
}
/* Six names need the room on laptop-height screens; the note is the first thing to go. */
@media (max-height: 800px) {
  .chapter-note.client-note {
    display: none;
  }
}

/* --- Services: three tabs, one spelled out ------------------------------------------------------ */
.service-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 0.6rem;
  margin-top: 0.25rem;
}
.service-tab {
  position: relative;
  padding-top: 0.6rem;
  font-family: ui-monospace, Menlo, monospace;
  font-size: 0.625rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: rgb(156 163 175);
  transition: color 0.3s;
}
.service-tab:hover,
.service-tab.is-active {
  color: white;
}
.service-tab:focus-visible {
  outline: 2px solid rgb(165 243 252);
  outline-offset: 4px;
}
.service-tab__n {
  margin-right: 0.35em;
  color: rgb(103 232 249 / 0.7);
}
.service-tab__bar {
  position: absolute;
  inset: 0 0 auto 0;
  height: 2px;
  overflow: hidden;
  background: rgb(255 255 255 / 0.15);
}
.service-tab__bar > span {
  position: absolute;
  inset: 0 auto 0 0;
  background: rgb(103 232 249);
}
@media (min-width: 768px) {
  .service-tabs {
    gap: 0.5rem 1.5rem;
  }
  .service-tab {
    font-size: 0.7rem;
    letter-spacing: 0.16em;
  }
}

/* --- Technologies: grouped and readable, across the whole width --------------------------------- */
.stack {
  position: absolute;
  left: 1.5rem;
  right: 1.5rem;
  bottom: 9svh;
}
.stack__grid {
  display: grid;
  gap: 0.9rem;
  margin-top: 1.25rem;
}
.stack-group {
  border-top: 1px solid rgb(165 243 252 / 0.22);
  padding-top: 0.6rem;
  will-change: transform, opacity;
}
.stack-group__title {
  font-family: ui-monospace, Menlo, monospace;
  font-size: 0.66rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: rgb(165 243 252 / 0.85);
}
.stack-group__items {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem 1.1rem;
  margin-top: 0.45rem;
}
.stack-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1rem;
  font-weight: 500;
  color: rgb(243 244 246);
  text-shadow: 0 1px 12px rgb(0 0 0 / 0.8);
  transition:
    color 0.25s,
    transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.stack-item svg {
  width: 0.95em;
  height: 0.95em;
  flex: none;
  fill: rgb(165 243 252);
  transition: filter 0.25s;
}
.stack-item:hover {
  color: white;
  transform: translateX(4px);
}
.stack-item:hover svg {
  filter: drop-shadow(0 0 8px rgb(34 211 238 / 0.9));
}
/* Short phones: tighten everything so the last group clears the HUD. */
@media (max-width: 767px) and (max-height: 720px) {
  .stack {
    bottom: 10.5svh;
  }
  .stack .eyebrow {
    margin-bottom: 0.5rem;
  }
  .stack__grid {
    gap: 0.5rem;
    margin-top: 0.8rem;
  }
  .stack-group {
    padding-top: 0.4rem;
  }
  .stack-group__items {
    gap: 0.15rem 1rem;
    margin-top: 0.25rem;
  }
  .stack-item {
    font-size: 0.92rem;
  }
}
@media (min-width: 768px) {
  .stack {
    left: 8vw;
    right: 12vw;
    bottom: 13svh;
  }
  .stack__head {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 3rem;
  }
  .stack__grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 2rem 1.5rem;
    margin-top: 2rem;
  }
  .stack-group {
    padding-top: 0.9rem;
  }
  .stack-group__items {
    flex-direction: column;
    gap: 0.6rem;
    margin-top: 1rem;
  }
  .stack-item {
    gap: 0.7rem;
    font-size: clamp(1.05rem, 1.4vw, 1.3rem);
  }
}
@media (min-width: 1024px) {
  .stack__grid {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }
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
