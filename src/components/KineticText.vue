<script setup lang="ts">
import { computed } from "vue";

/**
 * Text whose words rise out of a mask as `progress` passes `enter`, and leave upwards after `exit`.
 * Driven by scroll progress rather than time, so it scrubs with the page.
 */
const props = withDefaults(
  defineProps<{
    text: string;
    progress: number;
    enter?: number;
    exit?: number;
    stagger?: number;
    tag?: string;
  }>(),
  { enter: 0.08, exit: 0.84, stagger: 0.012, tag: "span" },
);

const clamp = (x: number) => Math.min(1, Math.max(0, x));

const words = computed(() =>
  props.text.split(" ").map((word, i) => {
    const inT = clamp((props.progress - props.enter - i * props.stagger) / 0.07);
    const outT = clamp((props.progress - props.exit - i * props.stagger * 0.5) / 0.07);
    const ease = (t: number) => 1 - (1 - t) ** 3;
    return {
      word,
      style: {
        transform: `translate3d(0, ${((1 - ease(inT)) * 110 - ease(outT) * 110).toFixed(2)}%, 0)`,
        opacity: (inT * (1 - outT)).toFixed(3),
      },
    };
  }),
);
</script>

<template>
  <component :is="tag" :aria-label="text">
    <span v-for="(w, i) in words" :key="i" aria-hidden="true" class="inline-block overflow-hidden pb-[0.12em] align-bottom">
      <span class="inline-block will-change-transform" :style="w.style">{{ w.word }}&nbsp;</span>
    </span>
  </component>
</template>
