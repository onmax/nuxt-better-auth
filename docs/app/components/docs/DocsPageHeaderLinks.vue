<script setup lang="ts">
import { useClipboard } from '@vueuse/core'

const route = useRoute()
const appBaseURL = useRuntimeConfig().app?.baseURL || '/'
const { copy, copied } = useClipboard()
const { t } = useDocusI18n()

const markdownLink = computed(() => `${window?.location?.origin}${appBaseURL}raw${route.path}.md`)

const dropdownOpen = ref(false)

const items = [
  { label: t('docs.copy.link'), icon: 'i-lucide-link', action: () => copy(markdownLink.value) },
  { label: t('docs.copy.view'), icon: 'i-simple-icons-markdown', href: markdownLink.value },
  { label: t('docs.copy.gpt'), icon: 'i-simple-icons-openai', href: `https://chatgpt.com/?hints=search&q=${encodeURIComponent(`Read ${markdownLink.value} so I can ask questions about it.`)}` },
  { label: t('docs.copy.claude'), icon: 'i-simple-icons-anthropic', href: `https://claude.ai/new?q=${encodeURIComponent(`Read ${markdownLink.value} so I can ask questions about it.`)}` },
]

async function copyPage() {
  const page = await $fetch<string>(`/raw${route.path}.md`)
  copy(page)
}

function handleItemClick(item: typeof items[0]) {
  if (item.action)
    item.action()
  dropdownOpen.value = false
}
</script>

<template>
  <div class="copy-group">
    <button class="copy-btn" :class="{ copied }" @click="copyPage">
      <UIcon :name="copied ? 'i-lucide-check' : 'i-lucide-copy'" class="size-3.5" />
      <span>{{ t('docs.copy.page') }}</span>
    </button>

    <UPopover v-model:open="dropdownOpen" :content="{ align: 'end', side: 'bottom', sideOffset: 8 }">
      <button class="dropdown-trigger">
        <UIcon name="i-lucide-chevron-down" class="size-3.5" />
      </button>

      <template #content>
        <div class="dropdown-menu">
          <template v-for="item in items" :key="item.label">
            <NuxtLink
              v-if="item.href"
              :to="item.href"
              target="_blank"
              class="dropdown-item"
              @click="dropdownOpen = false"
            >
              <UIcon :name="item.icon" class="size-4" />
              <span>{{ item.label }}</span>
            </NuxtLink>
            <button v-else class="dropdown-item" @click="handleItemClick(item)">
              <UIcon :name="item.icon" class="size-4" />
              <span>{{ item.label }}</span>
            </button>
          </template>
        </div>
      </template>
    </UPopover>
  </div>
</template>

<style scoped>
.copy-group {
  display: flex;
  align-items: stretch;
  border: 1px solid var(--ui-border);
}

.copy-btn {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  font-size: 0.75rem;
  color: var(--ui-text-muted);
  background: var(--ui-bg-muted);
  transition: all 0.15s;
}

.copy-btn:hover {
  color: var(--ui-text);
  background: color-mix(in srgb, var(--ui-primary) 5%, transparent);
}

.copy-btn.copied {
  color: var(--color-green-600);
}

.dark .copy-btn.copied {
  color: var(--color-green-400);
}

.dropdown-trigger {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.375rem 0.5rem;
  color: var(--ui-text-muted);
  background: var(--ui-bg-muted);
  border-left: 1px solid var(--ui-border);
  transition: all 0.15s;
}

.dropdown-trigger:hover {
  color: var(--ui-text);
  background: color-mix(in srgb, var(--ui-primary) 5%, transparent);
}

.dropdown-menu {
  display: flex;
  flex-direction: column;
  min-width: 160px;
  padding: 0.25rem;
  background: var(--ui-bg);
  border: 1px solid var(--ui-border);
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  font-size: 0.8125rem;
  color: var(--ui-text-muted);
  text-decoration: none;
  transition: all 0.15s;
}

.dropdown-item:hover {
  color: var(--ui-text);
  background: color-mix(in srgb, var(--ui-primary) 10%, transparent);
}
</style>
