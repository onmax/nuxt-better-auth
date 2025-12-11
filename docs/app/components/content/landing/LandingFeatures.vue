<script setup lang="ts">
// @ts-expect-error yaml is not typed
import features from './features.yml'
</script>

<template>
  <UPageSection
    :title="features.title"
    :description="features.description"
    :ui="{
      root: 'border-t border-default bg-gradient-to-b from-muted/30 to-default',
      title: 'text-2xl sm:text-3xl',
      features: 'lg:grid-cols-3 gap-8',
    }"
  >
    <template #features>
      <UPageFeature
        v-for="feature in features.items"
        :key="feature.title"
        v-bind="feature"
        orientation="vertical"
        :ui="{ icon: 'size-8', title: 'text-base', description: 'text-sm' }"
      />
    </template>
  </UPageSection>
</template>
