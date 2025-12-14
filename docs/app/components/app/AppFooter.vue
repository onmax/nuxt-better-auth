<script setup lang="ts">
const appConfig = useAppConfig()
const route = useRoute()

const isLandingPage = computed(() => route.path === '/')

const links = [
  { label: 'Documentation', to: '/getting-started' },
  { label: 'GitHub', to: appConfig.github?.url, external: true },
  { label: 'Better Auth', to: 'https://www.better-auth.com', external: true },
  { label: 'NuxtHub', to: 'https://hub.nuxt.com', external: true },
]
</script>

<template>
  <footer class="relative border-t border-[var(--ui-border)] bg-[var(--ui-bg)]">
    <!-- Vertical lines on sides (only on landing page) -->
    <template v-if="isLandingPage">
      <div class="hidden absolute top-0 left-5 w-px h-full bg-stone-200 dark:bg-[#26242C] pointer-events-none lg:block lg:left-16 xl:left-16" />
      <div class="hidden absolute top-0 right-5 w-px h-full bg-stone-200 dark:bg-[#26242C] pointer-events-none lg:block lg:right-14 xl:right-14" />
    </template>

    <div class="relative md:w-10/12 mx-auto px-6 py-12 lg:px-8">
      <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-8">
        <!-- Left: Logo and description -->
        <div class="flex flex-col gap-4">
          <div class="flex items-center gap-2">
            <!-- Nuxt logo -->
            <svg width="48" height="32" viewBox="0 0 48 32" fill="none" class="h-4 w-auto" xmlns="http://www.w3.org/2000/svg">
              <path d="M26.88 32H44.64C45.2068 32.0001 45.7492 31.8009 46.24 31.52C46.7308 31.2391 47.2367 30.8865 47.52 30.4C47.8033 29.9135 48.0002 29.3615 48 28.7998C47.9998 28.2381 47.8037 27.6864 47.52 27.2001L35.52 6.56C35.2368 6.0736 34.8907 5.72084 34.4 5.44C33.9093 5.15916 33.2066 4.96 32.64 4.96C32.0734 4.96 31.5307 5.15916 31.04 5.44C30.5493 5.72084 30.2032 6.0736 29.92 6.56L26.88 11.84L20.8 1.59962C20.5165 1.11326 20.1708 0.600786 19.68 0.32C19.1892 0.0392139 18.6467 0 18.08 0C17.5133 0 16.9708 0.0392139 16.48 0.32C15.9892 0.600786 15.4835 1.11326 15.2 1.59962L0.32 27.2001C0.0363166 27.6864 0.000246899 28.2381 3.05588e-07 28.7998C-0.000246288 29.3615 0.0367437 29.9134 0.32 30.3999C0.603256 30.8864 1.10919 31.2391 1.6 31.52C2.09081 31.8009 2.63324 32.0001 3.2 32H14.4C18.8379 32 22.068 30.0092 24.32 26.24L29.76 16.8L32.64 11.84L41.44 26.88H29.76L26.88 32ZM14.24 26.88H6.4L18.08 6.72L24 16.8L20.0786 23.636C18.5831 26.0816 16.878 26.88 14.24 26.88Z" class="fill-current" />
            </svg>
            <span class="text-xs text-[var(--ui-text-muted)]">×</span>
            <!-- Better Auth logo -->
            <svg width="60" height="45" viewBox="0 0 60 45" fill="none" class="h-4 w-auto" xmlns="http://www.w3.org/2000/svg">
              <path fill-rule="evenodd" clip-rule="evenodd" d="M0 0H15V15H30V30H15V45H0V30V15V0ZM45 30V15H30V0H45H60V15V30V45H45H30V30H45Z" class="fill-current" />
            </svg>
          </div>
          <p class="text-sm text-[var(--ui-text-muted)] max-w-xs">
            Nuxt module for Better Auth. The most comprehensive authentication framework for TypeScript.
          </p>
        </div>

        <!-- Right: Links -->
        <nav class="flex flex-wrap gap-x-8 gap-y-4">
          <NuxtLink
            v-for="link in links"
            :key="link.label"
            :to="link.to"
            :target="link.external ? '_blank' : undefined"
            class="text-sm text-[var(--ui-text-muted)] hover:text-[var(--ui-text)] transition-colors"
          >
            {{ link.label }}
          </NuxtLink>
        </nav>
      </div>

      <!-- Bottom: Copyright and credits -->
      <div class="mt-12 pt-8 border-t border-[var(--ui-border)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <p class="text-xs text-[var(--ui-text-dimmed)]">
          © {{ new Date().getFullYear() }} nuxt-better-auth. MIT License.
        </p>
        <p class="text-xs text-[var(--ui-text-dimmed)]">
          Design inspired by
          <NuxtLink to="https://www.better-auth.com" target="_blank" class="underline hover:text-[var(--ui-text-muted)] transition-colors">
            Better Auth
          </NuxtLink>
        </p>
      </div>
    </div>
  </footer>
</template>
