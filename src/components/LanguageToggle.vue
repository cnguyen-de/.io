<script setup lang="ts">
import { onMounted } from 'vue';
import { useLocale } from '../i18n/useLocale';

const { locale, init, toggle } = useLocale();

onMounted(() => {
  init();
});
</script>

<template>
  <button
    @click="toggle"
    class="fixed right-4 top-4 z-50 flex items-center gap-1.5 rounded-md border border-gray-500/40 bg-gray-900/80 px-3 py-1.5 text-sm font-medium text-gray-300 backdrop-blur-sm transition hover:border-gray-400/60 hover:text-white"
    :aria-label="locale === 'en' ? 'Switch to German' : 'Zur englischen Version wechseln'"
  >
    <span v-if="locale === 'en'">🇩🇪 DE</span>
    <span v-else>🇬🇧 EN</span>
  </button>
</template>
