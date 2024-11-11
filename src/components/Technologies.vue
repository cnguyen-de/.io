<script setup lang='ts'>
import InfiniteScroll from "./InfiniteScroll.vue";

const items = [
    { "id": 1, "text": "AWS" },
    { "id": 2, "text": "Angular" },
    { "id": 5, "text": "Cloud" },
    { "id": 6, "text": "Databases" },
    { "id": 7, "text": "Docker" },
    { "id": 8, "text": "FFmpeg" },
    { "id": 9, "text": "Firebase" },
    { "id": 10, "text": "Flask" },
    { "id": 11, "text": "Frontend" },
    { "id": 35, "text": "Helm Charts" },
    { "id": 15, "text": "JavaScript" },
    { "id": 16, "text": "Kubernetes" },
    { "id": 17, "text": "Machine Learning" },
    { "id": 18, "text": "Microservices" },
    { "id": 19, "text": "MongoDB" },
    { "id": 20, "text": "MySQL" },
    { "id": 22, "text": "Next.js" },
    { "id": 23, "text": "Node.js" },
    { "id": 24, "text": "OpenCV" },
    { "id": 25, "text": "PostgreSQL" },
    { "id": 26, "text": "Python" },
    { "id": 27, "text": "PyTorch" },
    { "id": 28, "text": "React" },
    { "id": 30, "text": "Spring" },
    { "id": 31, "text": "Spring Boot" },
    { "id": 36, "text": "Supabase" },
    { "id": 32, "text": "TypeScript" },
    { "id": 33, "text": "Vue.JS" },
    { "id": 34, "text": "WebStorm" },
]
</script>

<template>
  <div class="grid place-items-center w-full h-[400px]">
    <InfiniteScroll :items="items" client:only />
  </div>
</template>