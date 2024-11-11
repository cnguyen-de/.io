<script setup lang='ts'>
const props = defineProps<{
  items: { id: number, text: string }[]
}>()
</script>

<template>
  <div class="flex items-center justify-center max-h-[400px]">
    <div
      class="relative w-full max-w-screen-lg overflow-hidden " :style="{
        maskComposite: 'intersect',
        maskImage: `
          linear-gradient(to right,  transparent, black 5rem),
          linear-gradient(to left,   transparent, black 5rem),
          linear-gradient(to bottom, transparent, black 5rem),
          linear-gradient(to top,    transparent, black 5rem)
        `,
      }"
    >
      <div class="mx-auto grid animate-skew-scroll grid-cols-2 gap-4 sm:grid-cols-3">
        <div v-for="item in props.items" :key="item.id">
          <div
            :key="item.id"
            class="flex cursor-pointer w-48 xl:w-72 p-6 items-center space-x-2 rounded-md border border-gray-100 dark:border-gray-800 px-5 shadow-md transition-all hover:-translate-y-1 hover:translate-x-1 hover:scale-[1.025] hover:shadow-xl "
          >
            <svg
              xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
              fill="currentColor" stroke="white" strokeWidth="2" strokeLinecap="round"
              strokeLinejoin="round" class="h-6 w-6 flex-none text-red-500"
            >
              <path
                d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"
              />
              <path d="m9 12 2 2 4-4" />
            </svg>
            <p class="text-gray-600 whitespace-nowrap">
              {{ item.text }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>