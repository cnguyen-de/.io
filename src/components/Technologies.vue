<script setup lang="ts">
import IconCloud from "./IconCloud/IconCloud.vue";

const items = [
  { id: 1, text: "amazonwebservices" },
  { id: 2, text: "angular" },
  { id: 6, text: "postgresql" },
  { id: 7, text: "docker" },
  { id: 8, text: "ffmpeg" },
  { id: 9, text: "firebase" },
  { id: 10, text: "flask" },
  { id: 11, text: "html5" },
  { id: 35, text: "helm" },
  { id: 15, text: "javascript" },
  { id: 16, text: "kubernetes" },
  { id: 17, text: "tensorflow" },
  { id: 18, text: "kubernetes" },
  { id: 19, text: "mongodb" },
  { id: 20, text: "mysql" },
  { id: 22, text: "nextdotjs" },
  { id: 23, text: "nodedotjs" },
  { id: 24, text: "opencv" },
  { id: 25, text: "postgresql" },
  { id: 26, text: "python" },
  { id: 27, text: "pytorch" },
  { id: 28, text: "react" },
  { id: 30, text: "spring" },
  { id: 31, text: "springboot" },
  { id: 36, text: "supabase" },
  { id: 32, text: "typescript" },
  { id: 33, text: "vuedotjs" },
  { id: 34, text: "webstorm" }
];
const imageUrls = items.map((item) => `https://cdn.simpleicons.org/${item.text}`);
</script>

<template>
  <div class="grid place-content-center p-6">
    <IconCloud :images="imageUrls" client:only />
  </div>
</template>
