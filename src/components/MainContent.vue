<script setup lang="ts">
import { onMounted } from "vue";
import { useLocale } from "../i18n/useLocale";
import Globe from "./Globe.vue";
import Particles from "./Particles.vue";
import Technologies from "./Technologies.vue";

const { t, locale, init } = useLocale();

onMounted(() => {
  init();
});
</script>

<template>
  <main class="relative mx-auto flex min-h-dvh max-w-7xl flex-col items-center bg-transparent py-4 md:p-0">
    <!-- Hero -->
    <section id="hero" class="relative flex h-[100vh] w-full flex-col items-center justify-center">
      <h1
        class="bg-gradient-to-t from-slate-300/50 to-white bg-clip-text py-4 text-center text-5xl font-bold text-transparent drop-shadow-lg md:text-7xl lg:text-9xl">
        May Solutions
      </h1>
      <h2
        class="text-primary z-10 mt-4 text-center text-xl font-normal uppercase tracking-tight text-gray-400 md:text-2xl md:font-thin lg:text-3xl">
        {{ t.hero.tagline }}
      </h2>
      <Particles class="absolute inset-0" :quantity="100" :ease="100" color="#FFF" :staticity="10" :refresh="true" />
    </section>

    <!-- Frankfurt / Globe -->
    <section class="relative flex flex-col items-center bg-gray-950 pb-[500px] xl:pb-40">
      <div class="grid grid-cols-1 gap-10 pt-14 md:grid-cols-2">
        <div class="relative h-1 w-full">
          <Globe class="z-0 mx-auto pt-72 md:pt-0" />
        </div>
        <div class="z-10 flex flex-col gap-4 p-4 text-xl text-gray-300 md:p-20">
          <h2 class="text-primary pt-0 text-3xl font-semibold md:pt-10 md:text-5xl">
            {{ t.location.heading }}
          </h2>
          <p class="text-left text-lg font-thin">
            {{ t.location.body }}
          </p>
        </div>
      </div>
    </section>

    <!-- Trusted by -->
    <section
      class="relative w-full bg-gradient-to-br from-gray-950/20 from-20% via-gray-900 via-50% to-gray-950/30 to-80% py-40">
      <div class="bg-grid absolute inset-0"></div>
      <h2 class="text-primary z-10 px-4 py-10 text-center text-3xl font-semibold tracking-tighter md:text-5xl">
        {{ t.trusted.heading }}
      </h2>
      <p class="px-4 text-left text-lg font-thin text-gray-300 md:text-center xl:px-40">
        {{ t.trusted.body }}
      </p>
      <div
        class="mx-auto grid w-full max-w-6xl grid-cols-1 place-items-center gap-8 px-4 py-14 text-gray-300 md:grid-cols-2 xl:grid-cols-4">
        <a
          href="https://www.soka-bau.de/"
          target="_blank"
          rel="noopener noreferrer"
          class="z-10 w-full text-xl hover:text-gray-200 md:text-2xl lg:text-3xl xl:text-xl">
          <div
            class="animate w-full rounded-xl bg-gradient-to-br from-gray-400 from-5% via-gray-600 via-20% to-gray-800 to-90% p-px text-white shadow-xl hover:cursor-pointer">
            <div class="flex h-full flex-col rounded-[calc(0.75rem_-_1px)] bg-gray-950/90 p-6">
              <p class="mb-auto whitespace-nowrap text-center font-normal text-gray-400 md:font-thin">SOKA-BAU</p>
            </div>
          </div>
        </a>
        <a
          href="https://www.mercedes-benz.io/"
          target="_blank"
          rel="noopener noreferrer"
          class="z-10 w-full text-xl hover:text-gray-200 md:text-2xl lg:text-3xl xl:text-xl">
          <div
            class="animate w-full rounded-xl bg-gradient-to-br from-gray-400 from-5% via-gray-600 via-20% to-gray-800 to-90% p-px text-white shadow-xl hover:cursor-pointer">
            <div class="flex h-full flex-col rounded-[calc(0.75rem_-_1px)] bg-gray-950/90 p-6">
              <p class="mb-auto whitespace-nowrap text-center font-normal text-gray-400 md:font-thin">
                Mercedes-Benz.io
              </p>
            </div>
          </div>
        </a>
        <a
          href="https://www.lbbw.de"
          target="_blank"
          rel="noopener noreferrer"
          class="z-10 w-full text-xl hover:text-gray-200 md:text-2xl lg:text-3xl xl:text-xl">
          <div
            class="animate w-full rounded-xl bg-gradient-to-br from-gray-400 from-5% via-gray-600 via-20% to-gray-800 to-90% p-px text-white shadow-xl hover:cursor-pointer">
            <div class="flex h-full flex-col rounded-[calc(0.75rem_-_1px)] bg-gray-950/90 p-6">
              <p class="mb-auto whitespace-nowrap text-center font-normal text-gray-400 md:font-thin">LBBW</p>
            </div>
          </div>
        </a>
        <a
          href="https://gitlab.com/"
          target="_blank"
          rel="noopener noreferrer"
          class="z-10 w-full text-xl hover:text-gray-200 md:text-2xl lg:text-3xl xl:text-xl">
          <div
            class="animate w-full rounded-xl bg-gradient-to-br from-gray-400 from-5% via-gray-600 via-20% to-gray-800 to-90% p-px text-white shadow-xl hover:cursor-pointer">
            <div class="flex h-full flex-col rounded-[calc(0.75rem_-_1px)] bg-gray-950/90 p-6">
              <p class="mb-auto whitespace-nowrap text-center font-normal text-gray-400 md:font-thin">GitLab</p>
            </div>
          </div>
        </a>
      </div>
    </section>

    <!-- Services -->
    <section class="relative px-4 py-40">
      <h2 class="text-primary z-10 px-4 py-10 text-center text-3xl font-semibold tracking-tighter md:text-5xl">
        {{ t.services.heading }}
      </h2>
      <p class="px-4 text-left text-lg font-thin text-gray-300 md:text-center xl:px-40">
        {{ t.services.body }}
      </p>
      <Technologies />
      <div class="grid grid-cols-1 gap-10 pt-14 xl:grid-cols-3">
        <div
          v-for="card in [
            { title: t.services.webDev.title, body: t.services.webDev.body },
            { title: t.services.consulting.title, body: t.services.consulting.body },
            { title: t.services.agility.title, body: t.services.agility.body }
          ]"
          :key="card.title"
          class="animate w-full rounded-xl bg-gradient-to-br from-gray-400 from-5% via-gray-600 via-20% to-gray-800 to-90% p-px text-white shadow-xl hover:cursor-pointer">
          <div class="flex h-full flex-col rounded-[calc(0.75rem_-_1px)] bg-gray-950/90 p-6">
            <h3 class="text-primary pb-4 text-xl tracking-wide md:text-2xl">{{ card.title }}</h3>
            <p class="mb-auto font-normal text-gray-400 md:font-thin">{{ card.body }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Contact -->
    <section class="flex flex-col items-center pb-48 pt-20">
      <h2 class="text-primary z-10 px-4 py-4 text-center text-3xl font-bold tracking-tighter md:text-5xl">
        {{ t.contact.heading }}
      </h2>
      <p class="pb-6 text-center text-lg font-thin text-gray-400">
        {{ t.contact.cta }}
      </p>
      <a
        href="mailto:contact@may-solutions.io"
        class="focus:ring-offset-background rounded-sm text-gray-300 underline-offset-2 transition-all hover:cursor-pointer hover:underline focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2">
        <span class="text-lg text-gray-400 underline hover:text-sky-500">📨 contact@may-solutions.io</span>
      </a>
    </section>
  </main>

  <!-- Footer -->
  <footer
    class="border-px relative bottom-0 left-0 mx-auto flex justify-center border-t border-solid border-gray-500/20 p-2">
    <a
      href="/impressum"
      class="focus:ring-offset-background rounded-sm text-gray-300 underline-offset-2 transition-all hover:cursor-pointer hover:underline focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2">
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

.bg-grid {
  background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32' width='32' height='32' fill='none' stroke='rgb(148 163 184 / 0.1)'%3e%3cpath d='M0 .5H31.5V32'/%3e%3c/svg%3e");
  mask: linear-gradient(150deg, transparent 10%, white);
}

.animate:hover {
  animation: CardGradient 0.5s ease-in forwards;
}

@keyframes CardGradient {
  0% {
    --tw-gradient-from-position: 0;
    --tw-gradient-via-position: 20%;
  }
  10% {
    --tw-gradient-from-position: 10%;
    --tw-gradient-via-position: 30%;
  }
  20% {
    --tw-gradient-from-position: 20%;
    --tw-gradient-via-position: 40%;
  }
  30% {
    --tw-gradient-from-position: 30%;
    --tw-gradient-via-position: 50%;
  }
  100% {
    --tw-gradient-from-position: 30%;
    --tw-gradient-via-position: 50%;
  }
}
</style>
