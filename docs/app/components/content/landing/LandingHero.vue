<script setup lang="ts">
// @ts-expect-error yaml is not typed
import hero from './hero.yml'
</script>

<template>
  <UPageHero
    v-if="hero"
    orientation="horizontal"
    :title="hero.title"
    :description="hero.description"
    :links="hero.links"
    :ui="{
      root: 'relative overflow-hidden',
      container: 'py-16 sm:py-24 lg:py-32',
      wrapper: 'lg:max-w-lg',
      title: 'text-left text-pretty font-semibold text-3xl sm:text-4xl lg:text-5xl',
      description: 'text-left mt-4 text-md max-w-xl text-pretty sm:text-lg text-muted',
      links: 'mt-6 justify-start gap-3',
    }"
  >
    <template #default>
      <ClientOnly>
        <UTabs
          :items="hero.tabs"
          :unmount-on-hide="false"
          :ui="{ root: 'w-full', list: 'bg-muted/50', trigger: 'text-xs data-[state=active]:text-highlighted', indicator: 'bg-elevated' }"
        >
          <template #content="{ item, index }">
            <div class="h-64">
              <LazyMDC :value="item.code" :cache-key="`hero-tab-${index}`" class="*:my-0 text-sm font-mono" />
            </div>
          </template>
        </UTabs>
        <template #fallback>
          <div class="w-full h-64 bg-muted/30 animate-pulse rounded" />
        </template>
      </ClientOnly>
    </template>
  </UPageHero>
</template>
