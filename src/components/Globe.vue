<script setup lang="ts">
import createGlobe from "cobe";
import { onMounted, ref } from "vue";
import { useSpring } from "vue-use-spring";

const canvasRef = ref<HTMLCanvasElement | null>(null);
const pointerInteracting = ref<number | null>(null);
const pointerInteractionMovement = ref(0);
const phi = ref(4.3);

const api = useSpring(
  { r: 0 },
  {
    mass: 1,
    tension: 280,
    friction: 40,
    precision: 0.001
  }
);

onMounted(() => {
  createGlobe(canvasRef.value!, {
    devicePixelRatio: 2,
    width: 1000,
    height: 1000,
    phi: 4.3,
    theta: 0.8,
    dark: 1,
    diffuse: 1.2,
    mapSamples: 16000,
    mapBrightness: 6,
    baseColor: [0.3, 0.3, 0.3],
    markerColor: [0.1, 0.8, 1],
    glowColor: [1, 1, 1],
    markers: [
      // longitude latitude
      { location: [50, 8.7], size: 0.1 }
    ],
    onRender: (state) => {
      // Rotation disabled - only update on user interaction
      state.phi = phi.value + api.r;
    }
  });
  canvasRef.value!.style.opacity = "1";
});

function handlePointerDown(e: PointerEvent) {
  pointerInteracting.value = e.clientX - pointerInteractionMovement.value;
  canvasRef.value!.style.cursor = "grabbing";
}

function handlePointerUp(_: PointerEvent) {
  pointerInteracting.value = null;
  canvasRef.value!.style.cursor = "grab";
}

function handlePointerOut(_: PointerEvent) {
  pointerInteracting.value = null;
  canvasRef.value!.style.cursor = "grab";
}

function handleMouseMove(e: MouseEvent) {
  if (pointerInteracting.value !== null) {
    const delta = e.clientX - pointerInteracting.value;
    pointerInteractionMovement.value = delta;
    api.r = delta / 200;
  }
}

function handleTouchMove(e: TouchEvent) {
  if (pointerInteracting.value !== null && e.touches[0]) {
    const delta = e.touches[0].clientX - pointerInteracting.value;
    pointerInteractionMovement.value = delta;
    api.r = delta / 100;
  }
}
</script>

<template>
  <div class="absolute -left-10 mx-auto aspect-[1/1] w-full max-w-[600px] md:left-0 md:top-0">
    <canvas
      ref="canvasRef"
      class="mx-auto size-[450px] cursor-grab opacity-0 transition-opacity duration-500 [contain:layout_paint_size] md:size-[500px]"
      @pointerdown="handlePointerDown"
      @pointerup="handlePointerUp"
      @pointerout="handlePointerOut"
      @mousemove="handleMouseMove"
      @touchmove="handleTouchMove" />
  </div>
</template>
