<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { useDevtoolsClient } from '@nuxt/devtools-kit/iframe-client'
import { refDebounced } from '@vueuse/core'

definePageMeta({ layout: false })

const toast = useToast()
const devtoolsClient = useDevtoolsClient()

// Sync color mode with host app
const isDark = computed(() => devtoolsClient.value?.host?.app?.colorMode?.value === 'dark')

// Apply dark class to html element
watchEffect(() => {
  if (import.meta.client) {
    document.documentElement.classList.toggle('dark', isDark.value)
  }
})

const sessionsPage = ref(1)
const usersPage = ref(1)
const accountsPage = ref(1)
const deleteConfirm = ref<string | null>(null)

// Search with debounce - use v-model on raw refs, query uses debounced versions
const sessionsSearchRaw = ref('')
const usersSearchRaw = ref('')
const accountsSearchRaw = ref('')
const sessionsSearch = refDebounced(sessionsSearchRaw, 300)
const usersSearch = refDebounced(usersSearchRaw, 300)
const accountsSearch = refDebounced(accountsSearchRaw, 300)

// Reset page when search changes
watch(sessionsSearch, () => sessionsPage.value = 1)
watch(usersSearch, () => usersPage.value = 1)
watch(accountsSearch, () => accountsPage.value = 1)

const sessionsQuery = computed(() => ({ page: sessionsPage.value, limit: 20, search: sessionsSearch.value }))
const usersQuery = computed(() => ({ page: usersPage.value, limit: 20, search: usersSearch.value }))
const accountsQuery = computed(() => ({ page: accountsPage.value, limit: 20, search: accountsSearch.value }))

const { data: sessionsData, refresh: refreshSessions } = await useFetch('/api/_better-auth/sessions', { query: sessionsQuery })
const { data: usersData, refresh: refreshUsers } = await useFetch('/api/_better-auth/users', { query: usersQuery })
const { data: accountsData, refresh: refreshAccounts } = await useFetch('/api/_better-auth/accounts', { query: accountsQuery })
const { data: configData } = await useFetch('/api/_better-auth/config')

const tabs = [
  { label: 'Sessions', value: 'sessions', icon: 'i-lucide-key', slot: 'sessions' },
  { label: 'Users', value: 'users', icon: 'i-lucide-users', slot: 'users' },
  { label: 'Accounts', value: 'accounts', icon: 'i-lucide-link', slot: 'accounts' },
  { label: 'Config', value: 'config', icon: 'i-lucide-settings', slot: 'config' },
]

function isExpired(date: string | Date | null | undefined): boolean {
  if (!date)
    return false
  return new Date(date) < new Date()
}

function formatDate(date: string | Date | null | undefined): string {
  if (!date)
    return '-'
  return new Date(date).toLocaleString()
}

function truncate(str: string | null | undefined, len = 12): string {
  if (!str)
    return '-'
  return str.length > len ? `${str.slice(0, len)}…` : str
}

async function copyToClipboard(text: string, label = 'Value') {
  try {
    await navigator.clipboard.writeText(text)
    toast.add({ title: `${label} copied`, icon: 'i-lucide-check', color: 'success' })
  }
  catch {
    toast.add({ title: 'Copy failed', icon: 'i-lucide-x', color: 'error' })
  }
}

async function deleteSession(id: string) {
  try {
    await $fetch('/api/_better-auth/sessions', { method: 'DELETE', body: { id } })
    toast.add({ title: 'Session deleted', icon: 'i-lucide-trash-2', color: 'success' })
    deleteConfirm.value = null
    refreshSessions()
  }
  catch {
    toast.add({ title: 'Failed to delete session', icon: 'i-lucide-x', color: 'error' })
  }
}

interface SessionRow { id: string, userId: string, ipAddress: string | null, userAgent: string | null, expiresAt: string | null, createdAt: string }
interface UserRow { id: string, name: string | null, email: string, emailVerified: boolean, createdAt: string }
interface AccountRow { id: string, providerId: string, accountId: string, userId: string, createdAt: string }

const sessionColumns: TableColumn<SessionRow>[] = [
  { accessorKey: 'id', header: 'ID', cell: ({ row }) => h('span', { class: 'font-mono text-xs' }, truncate(row.original.id)) },
  { accessorKey: 'userId', header: 'User ID', cell: ({ row }) => h('span', { class: 'font-mono text-xs' }, truncate(row.original.userId)) },
  { accessorKey: 'ipAddress', header: 'IP', cell: ({ row }) => h('span', { class: 'font-mono text-xs text-muted-foreground' }, row.original.ipAddress || '-') },
  { accessorKey: 'userAgent', header: 'User Agent', cell: ({ row }) => h('span', { class: 'text-xs text-muted-foreground max-w-48 truncate block' }, truncate(row.original.userAgent, 30)) },
  {
    accessorKey: 'expiresAt',
    header: 'Status',
    cell: ({ row }) => {
      const expired = isExpired(row.original.expiresAt)
      return h(resolveComponent('UBadge'), { color: expired ? 'error' : 'success', variant: 'subtle', size: 'xs' }, () => expired ? 'Expired' : 'Active')
    },
  },
  { accessorKey: 'createdAt', header: 'Created', cell: ({ row }) => h('span', { class: 'text-xs text-muted-foreground' }, formatDate(row.original.createdAt)) },
]

const userColumns: TableColumn<UserRow>[] = [
  { accessorKey: 'id', header: 'ID', cell: ({ row }) => h('span', { class: 'font-mono text-xs' }, truncate(row.original.id)) },
  { accessorKey: 'name', header: 'Name', cell: ({ row }) => h('span', {}, row.original.name || '-') },
  { accessorKey: 'email', header: 'Email', cell: ({ row }) => h('span', { class: 'font-mono text-xs' }, row.original.email) },
  {
    accessorKey: 'emailVerified',
    header: 'Verified',
    cell: ({ row }) => h(resolveComponent('UBadge'), { color: row.original.emailVerified ? 'success' : 'neutral', variant: 'subtle', size: 'xs' }, () => row.original.emailVerified ? 'Yes' : 'No'),
  },
  { accessorKey: 'createdAt', header: 'Created', cell: ({ row }) => h('span', { class: 'text-xs text-muted-foreground' }, formatDate(row.original.createdAt)) },
]

const accountColumns: TableColumn<AccountRow>[] = [
  { accessorKey: 'id', header: 'ID', cell: ({ row }) => h('span', { class: 'font-mono text-xs' }, truncate(row.original.id)) },
  {
    accessorKey: 'providerId',
    header: 'Provider',
    cell: ({ row }) => {
      const provider = row.original.providerId
      const iconMap: Record<string, string> = { github: 'i-simple-icons-github', google: 'i-simple-icons-google', discord: 'i-simple-icons-discord', twitter: 'i-simple-icons-x', facebook: 'i-simple-icons-facebook' }
      return h('div', { class: 'flex items-center gap-2' }, [
        h(resolveComponent('UIcon'), { name: iconMap[provider] || 'i-lucide-key', class: 'size-4' }),
        h('span', { class: 'capitalize' }, provider),
      ])
    },
  },
  { accessorKey: 'accountId', header: 'Account ID', cell: ({ row }) => h('span', { class: 'font-mono text-xs' }, truncate(row.original.accountId)) },
  { accessorKey: 'userId', header: 'User ID', cell: ({ row }) => h('span', { class: 'font-mono text-xs' }, truncate(row.original.userId)) },
  { accessorKey: 'createdAt', header: 'Created', cell: ({ row }) => h('span', { class: 'text-xs text-muted-foreground' }, formatDate(row.original.createdAt)) },
]

function getSessionActions(row: SessionRow) {
  return [
    [{ label: 'Copy ID', icon: 'i-lucide-copy', click: () => copyToClipboard(row.id, 'Session ID') }],
    [{ label: 'Delete', icon: 'i-lucide-trash-2', color: 'error' as const, click: () => { deleteConfirm.value = row.id } }],
  ]
}

function getUserActions(row: UserRow) {
  return [
    [{ label: 'Copy ID', icon: 'i-lucide-copy', click: () => copyToClipboard(row.id, 'User ID') }],
    [{ label: 'Copy Email', icon: 'i-lucide-mail', click: () => copyToClipboard(row.email, 'Email') }],
  ]
}

function getAccountActions(row: AccountRow) {
  return [[{ label: 'Copy ID', icon: 'i-lucide-copy', click: () => copyToClipboard(row.id, 'Account ID') }]]
}
</script>

<template>
  <div class="min-h-screen bg-background text-foreground">
    <!-- Header -->
    <header class="flex items-center justify-between border-b border-border px-4 py-3">
      <div class="flex items-center gap-3">
        <svg width="60" height="45" viewBox="0 0 60 45" fill="none" class="h-4 w-auto" xmlns="http://www.w3.org/2000/svg">
          <path fill-rule="evenodd" clip-rule="evenodd" d="M0 0H15V15H30V30H15V45H0V30V15V0ZM45 30V15H30V0H45H60V15V30V45H45H30V30H45Z" class="fill-current" />
        </svg>
        <span class="font-medium text-sm">Better Auth DevTools</span>
      </div>
    </header>

    <!-- Tabs -->
    <UTabs :items="tabs" class="w-full" :ui="{ list: 'border-b border-border rounded-none bg-transparent', trigger: 'rounded-none data-[state=active]:shadow-none' }">
      <!-- Sessions Tab -->
      <template #sessions>
        <div class="p-4 space-y-4">
          <div class="flex items-center justify-between gap-4">
            <UInput v-model="sessionsSearchRaw" placeholder="Search by user ID or IP..." icon="i-lucide-search" class="max-w-xs" />
            <div class="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{{ sessionsData?.total ?? 0 }} sessions</span>
              <UButton variant="ghost" size="xs" icon="i-lucide-refresh-cw" @click="refreshSessions" />
            </div>
          </div>

          <UAlert v-if="deleteConfirm" title="Delete session?" description="This will invalidate the session immediately." color="error" variant="soft" icon="i-lucide-alert-triangle" :actions="[{ label: 'Cancel', color: 'neutral', variant: 'outline', click: () => deleteConfirm = null }, { label: 'Delete', color: 'error', click: () => deleteSession(deleteConfirm!) }]" />

          <p v-if="sessionsData?.error" class="text-destructive text-sm">
            {{ sessionsData.error }}
          </p>

          <UTable v-else-if="sessionsData?.sessions?.length" :data="(sessionsData.sessions as SessionRow[])" :columns="sessionColumns" class="rounded-none border border-border">
            <template #actions="{ row }">
              <UDropdownMenu :items="getSessionActions(row.original)">
                <UButton variant="ghost" size="xs" icon="i-lucide-more-horizontal" />
              </UDropdownMenu>
            </template>
          </UTable>

          <p v-else class="text-muted-foreground text-sm py-8 text-center">
            No sessions found
          </p>

          <UPagination v-if="(sessionsData?.total ?? 0) > 20" v-model:page="sessionsPage" :total="sessionsData?.total ?? 0" :items-per-page="20" />
        </div>
      </template>

      <!-- Users Tab -->
      <template #users>
        <div class="p-4 space-y-4">
          <div class="flex items-center justify-between gap-4">
            <UInput v-model="usersSearchRaw" placeholder="Search by name or email..." icon="i-lucide-search" class="max-w-xs" />
            <div class="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{{ usersData?.total ?? 0 }} users</span>
              <UButton variant="ghost" size="xs" icon="i-lucide-refresh-cw" @click="refreshUsers" />
            </div>
          </div>

          <p v-if="usersData?.error" class="text-destructive text-sm">
            {{ usersData.error }}
          </p>

          <UTable v-else-if="usersData?.users?.length" :data="(usersData.users as UserRow[])" :columns="userColumns" class="rounded-none border border-border">
            <template #actions="{ row }">
              <UDropdownMenu :items="getUserActions(row.original)">
                <UButton variant="ghost" size="xs" icon="i-lucide-more-horizontal" />
              </UDropdownMenu>
            </template>
          </UTable>

          <p v-else class="text-muted-foreground text-sm py-8 text-center">
            No users found
          </p>

          <UPagination v-if="(usersData?.total ?? 0) > 20" v-model:page="usersPage" :total="usersData?.total ?? 0" :items-per-page="20" />
        </div>
      </template>

      <!-- Accounts Tab -->
      <template #accounts>
        <div class="p-4 space-y-4">
          <div class="flex items-center justify-between gap-4">
            <UInput v-model="accountsSearchRaw" placeholder="Search by provider..." icon="i-lucide-search" class="max-w-xs" />
            <div class="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{{ accountsData?.total ?? 0 }} accounts</span>
              <UButton variant="ghost" size="xs" icon="i-lucide-refresh-cw" @click="refreshAccounts" />
            </div>
          </div>

          <p v-if="accountsData?.error" class="text-destructive text-sm">
            {{ accountsData.error }}
          </p>

          <UTable v-else-if="accountsData?.accounts?.length" :data="(accountsData.accounts as AccountRow[])" :columns="accountColumns" class="rounded-none border border-border">
            <template #actions="{ row }">
              <UDropdownMenu :items="getAccountActions(row.original)">
                <UButton variant="ghost" size="xs" icon="i-lucide-more-horizontal" />
              </UDropdownMenu>
            </template>
          </UTable>

          <p v-else class="text-muted-foreground text-sm py-8 text-center">
            No accounts found
          </p>

          <UPagination v-if="(accountsData?.total ?? 0) > 20" v-model:page="accountsPage" :total="accountsData?.total ?? 0" :items-per-page="20" />
        </div>
      </template>

      <!-- Config Tab -->
      <template #config>
        <div class="p-4 space-y-4">
          <p v-if="configData?.error" class="text-destructive text-sm">
            {{ configData.error }}
          </p>

          <template v-else-if="configData?.config">
            <div class="grid gap-4 md:grid-cols-2">
              <UCard :ui="{ root: 'rounded-none border border-border shadow-none', header: 'p-4 border-b border-border', body: 'p-4' }">
                <template #header>
                  <div class="flex items-center gap-2">
                    <UIcon name="i-lucide-globe" class="size-4 text-muted-foreground" />
                    <span class="font-medium text-sm">Endpoints</span>
                  </div>
                </template>
                <dl class="space-y-3 text-sm">
                  <div class="flex justify-between">
                    <dt class="text-muted-foreground">
                      Base URL
                    </dt>
                    <dd class="font-mono text-xs">
                      {{ configData.config.baseURL || 'auto-detect' }}
                    </dd>
                  </div>
                  <div class="flex justify-between">
                    <dt class="text-muted-foreground">
                      Base Path
                    </dt>
                    <dd class="font-mono text-xs">
                      {{ configData.config.basePath }}
                    </dd>
                  </div>
                </dl>
              </UCard>

              <UCard :ui="{ root: 'rounded-none border border-border shadow-none', header: 'p-4 border-b border-border', body: 'p-4' }">
                <template #header>
                  <div class="flex items-center gap-2">
                    <UIcon name="i-lucide-share-2" class="size-4 text-muted-foreground" />
                    <span class="font-medium text-sm">Social Providers</span>
                  </div>
                </template>
                <div class="flex flex-wrap gap-2">
                  <UBadge v-for="provider in configData.config.socialProviders" :key="provider" variant="subtle" color="neutral" class="capitalize">
                    {{ provider }}
                  </UBadge>
                  <span v-if="!configData.config.socialProviders?.length" class="text-muted-foreground text-sm">None configured</span>
                </div>
              </UCard>

              <UCard :ui="{ root: 'rounded-none border border-border shadow-none', header: 'p-4 border-b border-border', body: 'p-4' }">
                <template #header>
                  <div class="flex items-center gap-2">
                    <UIcon name="i-lucide-puzzle" class="size-4 text-muted-foreground" />
                    <span class="font-medium text-sm">Plugins</span>
                  </div>
                </template>
                <div class="flex flex-wrap gap-2">
                  <UBadge v-for="plugin in configData.config.plugins" :key="plugin" variant="subtle" color="neutral">
                    {{ plugin }}
                  </UBadge>
                  <span v-if="!configData.config.plugins?.length" class="text-muted-foreground text-sm">None configured</span>
                </div>
              </UCard>

              <UCard :ui="{ root: 'rounded-none border border-border shadow-none', header: 'p-4 border-b border-border', body: 'p-4' }">
                <template #header>
                  <div class="flex items-center gap-2">
                    <UIcon name="i-lucide-shield-check" class="size-4 text-muted-foreground" />
                    <span class="font-medium text-sm">Trusted Origins</span>
                  </div>
                </template>
                <div class="flex flex-wrap gap-2">
                  <UBadge v-for="origin in configData.config.trustedOrigins" :key="origin" variant="subtle" color="neutral" class="font-mono text-xs">
                    {{ origin }}
                  </UBadge>
                  <span v-if="!configData.config.trustedOrigins?.length" class="text-muted-foreground text-sm">None configured</span>
                </div>
              </UCard>
            </div>
          </template>
        </div>
      </template>
    </UTabs>
  </div>
</template>

<style>
:root {
  --background: hsl(0 0% 100%);
  --foreground: hsl(20 14.3% 4.1%);
  --card: hsl(0 0% 100%);
  --card-foreground: hsl(20 14.3% 4.1%);
  --muted-foreground: hsl(25 5.3% 44.7%);
  --border: hsl(20 5.9% 90%);
  --destructive: hsl(0 84.2% 60.2%);
}

.dark {
  --background: hsl(20 14.3% 4.1%);
  --foreground: hsl(60 9.1% 97.8%);
  --card: hsl(20 14.3% 4.1%);
  --card-foreground: hsl(60 9.1% 97.8%);
  --muted-foreground: hsl(24 5.4% 63.9%);
  --border: hsl(12 6.5% 15.1%);
  --destructive: hsl(0 62.8% 30.6%);
}

.bg-background { background-color: var(--background); }
.text-foreground { color: var(--foreground); }
.text-muted-foreground { color: var(--muted-foreground); }
.text-destructive { color: var(--destructive); }
.border-border { border-color: var(--border); }
</style>
