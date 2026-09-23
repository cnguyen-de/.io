<script setup lang="ts">
const stack: [slug: string, name: string][] = [
  ["typescript", "TypeScript"],
  ["vuedotjs", "Vue"],
  ["react", "React"],
  ["angular", "Angular"],
  ["nextdotjs", "Next.js"],
  ["nodedotjs", "Node.js"],
  ["python", "Python"],
  ["springboot", "Spring Boot"],
  ["flask", "Flask"],
  ["postgresql", "PostgreSQL"],
  ["mongodb", "MongoDB"],
  ["mysql", "MySQL"],
  ["supabase", "Supabase"],
  ["firebase", "Firebase"],
  ["docker", "Docker"],
  ["kubernetes", "Kubernetes"],
  ["helm", "Helm"],
  ["tensorflow", "TensorFlow"],
  ["pytorch", "PyTorch"],
  ["opencv", "OpenCV"],
  ["ffmpeg", "FFmpeg"],
];
</script>

<template>
  <div class="ticker relative w-full overflow-hidden" aria-label="Technologies">
    <ul class="ticker__track flex w-max gap-3">
      <li
        v-for="([slug, name], i) in [...stack, ...stack]"
        :key="i"
        :aria-hidden="i >= stack.length"
        class="flex items-center gap-2 rounded-full border border-cyan-200/15 bg-gray-950/50 px-4 py-2 font-mono text-xs uppercase tracking-[0.15em] text-cyan-50/80 backdrop-blur-sm">
        <img :src="`https://cdn.simpleicons.org/${slug}/a5f3fc`" :alt="''" width="16" height="16" loading="lazy" />
        {{ name }}
      </li>
    </ul>
  </div>
</template>

<style>
.ticker {
  mask-image: linear-gradient(to right, transparent, black 10%, black 90%, transparent);
}
.ticker__track {
  animation: ticker 45s linear infinite;
}
.ticker:hover .ticker__track {
  animation-play-state: paused;
}
@keyframes ticker {
  to {
    transform: translateX(calc(-50% - 0.375rem));
  }
}
@media (prefers-reduced-motion: reduce) {
  .ticker__track {
    animation: none;
  }
}
</style>
