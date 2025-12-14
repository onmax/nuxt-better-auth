<script setup lang="ts">
interface SurroundLink {
  path: string
  title: string
  description?: string
}

defineProps<{
  surround?: [SurroundLink | undefined, SurroundLink | undefined]
  editLink?: string
}>()
</script>

<template>
  <div class="docs-page-footer">
    <!-- Edit on GitHub link -->
    <div v-if="editLink" class="edit-section">
      <NuxtLink :to="editLink" target="_blank" class="edit-link">
        <UIcon name="i-lucide-pencil" class="size-3.5" />
        <span>Edit on GitHub</span>
      </NuxtLink>
    </div>

    <!-- Navigation cards -->
    <div v-if="surround" class="nav-grid">
      <NuxtLink v-if="surround[0]" :to="surround[0].path" class="nav-card">
        <div class="nav-label">
          <UIcon name="i-lucide-chevron-left" class="size-4 -ms-1" />
          <span>Previous</span>
        </div>
        <p class="nav-title">
          {{ surround[0].title }}
        </p>
      </NuxtLink>

      <NuxtLink v-if="surround[1]" :to="surround[1].path" class="nav-card nav-card-right">
        <div class="nav-label nav-label-right">
          <span>Next</span>
          <UIcon name="i-lucide-chevron-right" class="size-4 -me-1" />
        </div>
        <p class="nav-title">
          {{ surround[1].title }}
        </p>
      </NuxtLink>
    </div>
  </div>
</template>

<style scoped>
.docs-page-footer {
  margin-top: 3rem;
}

.edit-section {
  display: flex;
  margin-bottom: 1.5rem;
}

.edit-link {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--ui-text-muted);
  background: var(--ui-bg-elevated);
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius);
  transition: all 0.1s;
}

.edit-link:hover {
  color: var(--ui-text);
  background: var(--ui-bg-accented);
}

.nav-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
  padding-bottom: 1.5rem;
}

.nav-card {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 1rem;
  font-size: 0.875rem;
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius);
  transition: background-color 0.1s;
}

.nav-card:hover {
  background: color-mix(in srgb, var(--ui-bg-accented) 80%, transparent);
}

.nav-card-right {
  grid-column-start: 2;
  text-align: end;
}

.nav-label {
  display: inline-flex;
  align-items: center;
  gap: 0.125rem;
  color: var(--ui-text-muted);
}

.nav-label-right {
  justify-content: flex-end;
}

.nav-title {
  font-weight: 500;
  color: var(--ui-text);
}

@media (max-width: 640px) {
  .nav-grid {
    grid-template-columns: 1fr;
  }

  .nav-card-right {
    text-align: start;
  }

  .nav-label-right {
    flex-direction: row;
    justify-content: flex-start;
  }
}
</style>
