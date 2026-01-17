<script setup lang="ts">
const { user, session, client, signOut } = useUserSession()
const { t } = useI18n()
const toast = useToast()
const emailWarning = useEmailWarning()

type AsyncFn = (...args: unknown[]) => Promise<unknown>
const authClient = client as typeof client & {
  twoFactor: { enable: AsyncFn, disable: AsyncFn, verifyTotp: AsyncFn }
  passkey: { addPasskey: AsyncFn, deletePasskey: AsyncFn }
  getLastUsedLoginMethod: () => string | null
}

const lastLoginMethod = ref<string | null>(null)

// Profile editing
const editOpen = ref(false)
const editForm = reactive({ name: '' })
const editLoading = ref(false)

function openEdit() {
  editForm.name = user.value?.name || ''
  editOpen.value = true
}

async function saveProfile() {
  editLoading.value = true
  try {
    await client?.updateUser({ name: editForm.name })
    toast.add({ title: t('app.profileUpdated'), color: 'success' })
    editOpen.value = false
  }
  catch (e: any) {
    toast.add({ title: 'Error', description: e.message, color: 'error' })
  }
  editLoading.value = false
}

// Email verification
const verifyLoading = ref(false)
async function resendVerification() {
  verifyLoading.value = true
  try {
    await client?.sendVerificationEmail({ email: user.value?.email || '' })
    toast.add({ title: t('app.verificationSent'), color: 'success' })
    emailWarning()
  }
  catch (e: any) {
    toast.add({ title: 'Error', description: e.message, color: 'error' })
  }
  verifyLoading.value = false
}

// Sessions
const sessions = ref<any[]>([])
const sessionsLoading = ref(true)

async function loadSessions() {
  sessionsLoading.value = true
  try {
    const res = await client?.listSessions()
    sessions.value = res?.data || []
  }
  catch { sessions.value = [] }
  sessionsLoading.value = false
}

async function terminateSession(token: string) {
  await client?.revokeSession({ token })
  sessions.value = sessions.value.filter(s => s.token !== token)
  toast.add({ title: t('app.sessionTerminated'), color: 'success' })
}

const sessionColumns = computed(() => [
  { id: 'userAgent', header: t('app.device'), accessorKey: 'userAgent' },
  { id: 'createdAt', header: t('app.created'), accessorKey: 'createdAt' },
  { id: 'actions', header: '', accessorKey: 'actions' },
])

// Two-Factor
const twoFaOpen = ref(false)
const twoFaPassword = ref('')
const twoFaUri = ref('')
const twoFaCode = ref('')
const twoFaLoading = ref(false)

async function enable2FA() {
  twoFaLoading.value = true
  try {
    if (twoFaUri.value) {
      // Verify step
      const res = await authClient?.twoFactor.verifyTotp({ code: twoFaCode.value })
      if (res?.data) {
        toast.add({ title: t('app.twoFactorEnabledSuccess'), color: 'success' })
        twoFaOpen.value = false
        twoFaUri.value = ''
        twoFaCode.value = ''
      }
      else {
        toast.add({ title: t('app.invalidCode'), color: 'error' })
      }
    }
    else {
      // Enable step
      const res = await authClient?.twoFactor.enable({ password: twoFaPassword.value })
      if (res?.data?.totpURI) {
        twoFaUri.value = res.data.totpURI
      }
      else {
        toast.add({ title: 'Error', description: 'Failed to enable 2FA', color: 'error' })
      }
    }
  }
  catch (e: any) {
    toast.add({ title: 'Error', description: e.message, color: 'error' })
  }
  twoFaLoading.value = false
}

async function disable2FA() {
  twoFaLoading.value = true
  try {
    await authClient?.twoFactor.disable({ password: twoFaPassword.value })
    toast.add({ title: t('app.twoFactorDisabledSuccess'), color: 'success' })
    twoFaOpen.value = false
    twoFaPassword.value = ''
  }
  catch (e: any) {
    toast.add({ title: 'Error', description: e.message, color: 'error' })
  }
  twoFaLoading.value = false
}

const passkeysRef = client?.useListPasskeys()
const passkeys = computed(() => passkeysRef?.value?.data || [])
const passkeyOpen = ref(false)
const passkeyName = ref('')
const passkeyLoading = ref(false)

async function addPasskey() {
  passkeyLoading.value = true
  try {
    await authClient?.passkey.addPasskey({ name: passkeyName.value || 'My Passkey' })
    toast.add({ title: t('app.passkeyAdded'), color: 'success' })
    passkeyOpen.value = false
    passkeyName.value = ''
  }
  catch (e: any) {
    toast.add({ title: 'Error', description: e.message, color: 'error' })
  }
  passkeyLoading.value = false
}

async function deletePasskey(id: string) {
  await authClient?.passkey.deletePasskey({ id })
  toast.add({ title: t('app.passkeyDeleted'), color: 'success' })
}

// Password change
const passwordOpen = ref(false)
const passwordForm = reactive({ current: '', new: '', confirm: '', revokeOthers: false })
const passwordLoading = ref(false)

async function changePassword() {
  if (passwordForm.new !== passwordForm.confirm) {
    toast.add({ title: t('app.passwordsNoMatch'), color: 'error' })
    return
  }
  passwordLoading.value = true
  try {
    await client?.changePassword({
      currentPassword: passwordForm.current,
      newPassword: passwordForm.new,
      revokeOtherSessions: passwordForm.revokeOthers,
    })
    toast.add({ title: t('app.passwordChanged'), color: 'success' })
    passwordOpen.value = false
    passwordForm.current = ''
    passwordForm.new = ''
    passwordForm.confirm = ''
    passwordForm.revokeOthers = false
  }
  catch (e: any) {
    toast.add({ title: 'Error', description: e.message, color: 'error' })
  }
  passwordLoading.value = false
}

// Sign out
const signOutLoading = ref(false)
async function handleSignOut() {
  signOutLoading.value = true
  await signOut()
  navigateTo('/login')
}

onMounted(() => {
  loadSessions()
  lastLoginMethod.value = authClient?.getLastUsedLoginMethod?.() || null
})
</script>

<template>
  <div class="max-w-3xl mx-auto py-8 px-4 space-y-6">
    <!-- Profile Card -->
    <UCard>
      <template #header>
        <div class="flex justify-between items-center">
          <h2 class="text-lg font-semibold">
            {{ t('app.profile') }}
          </h2>
          <UButton size="sm" variant="soft" @click="openEdit">
            <UIcon name="i-lucide-pencil" />
            {{ t('common.edit') }}
          </UButton>
        </div>
      </template>

      <div class="flex items-center gap-4">
        <UAvatar :src="user?.image ?? undefined" :alt="user?.name ?? undefined" size="lg" />
        <div>
          <p class="font-medium">
            {{ user?.name || t('app.noName') }}
          </p>
          <div class="flex items-center gap-2">
            <p class="text-sm text-muted-foreground">
              {{ user?.email }}
            </p>
            <UBadge v-if="lastLoginMethod" size="xs" variant="subtle" color="neutral">
              via {{ lastLoginMethod }}
            </UBadge>
          </div>
        </div>
      </div>

      <UAlert v-if="!user?.emailVerified" :title="t('app.emailNotVerified')" icon="i-lucide-triangle-alert" color="neutral" variant="outline" class="mt-4 border-s-2 border-s-orange-500/50 border-dashed rounded-none [&_svg]:fill-orange-500 [&_svg]:text-transparent">
        <template #description>
          <UButton size="xs" variant="soft" :loading="verifyLoading" @click="resendVerification">
            {{ t('app.resendVerification') }}
          </UButton>
        </template>
      </UAlert>
    </UCard>

    <!-- Active Sessions -->
    <UCard>
      <template #header>
        <div class="flex justify-between items-center">
          <h2 class="text-lg font-semibold">
            {{ t('app.activeSessions') }}
          </h2>
          <UButton size="sm" variant="ghost" @click="loadSessions">
            <UIcon name="i-lucide-refresh-cw" />
          </UButton>
        </div>
      </template>

      <UTable :loading="sessionsLoading" :data="sessions" :columns="sessionColumns">
        <template #userAgent-cell="{ row }">
          <div class="flex items-center gap-2 max-w-xs">
            <UIcon :name="row.original.userAgent?.includes('Mobile') ? 'i-lucide-smartphone' : 'i-lucide-monitor'" />
            <span class="text-sm truncate">{{ row.original.userAgent?.substring(0, 40) }}...</span>
            <UBadge v-if="row.original.id === session?.id" size="xs" color="primary">
              {{ t('app.current') }}
            </UBadge>
          </div>
        </template>
        <template #createdAt-cell="{ row }">
          <span class="text-sm text-muted-foreground">{{ new Date(row.original.createdAt).toLocaleDateString() }}</span>
        </template>
        <template #actions-cell="{ row }">
          <UButton size="xs" :color="row.original.id === session?.id ? 'error' : 'neutral'" variant="soft" @click="terminateSession(row.original.token)">
            {{ row.original.id === session?.id ? t('common.signOut') : t('app.revoke') }}
          </UButton>
        </template>
      </UTable>
    </UCard>

    <!-- Security -->
    <UCard>
      <template #header>
        <h2 class="text-lg font-semibold">
          {{ t('app.security') }}
        </h2>
      </template>

      <div class="space-y-4">
        <!-- 2FA -->
        <div class="flex justify-between items-center">
          <div>
            <p class="font-medium">
              {{ t('app.twoFactor') }}
            </p>
            <p class="text-sm text-muted-foreground">
              {{ user?.twoFactorEnabled ? t('app.twoFactorEnabled') : t('app.twoFactorDisabled') }}
            </p>
          </div>
          <UButton :color="user?.twoFactorEnabled ? 'error' : 'primary'" variant="soft" @click="twoFaOpen = true">
            {{ user?.twoFactorEnabled ? t('app.disable2fa') : t('app.enable2fa') }}
          </UButton>
        </div>

        <UDivider />

        <!-- Passkeys -->
        <div class="flex justify-between items-center">
          <div>
            <p class="font-medium">
              {{ t('app.passkeys') }}
            </p>
            <p class="text-sm text-muted-foreground">
              {{ passkeys.length }} {{ t('app.registered') }}
            </p>
          </div>
          <UButton variant="soft" @click="passkeyOpen = true">
            {{ t('app.addPasskey') }}
          </UButton>
        </div>

        <div v-if="passkeys.length" class="space-y-2">
          <div v-for="pk in passkeys" :key="pk.id" class="flex justify-between items-center p-2 bg-muted rounded">
            <div class="flex items-center gap-2">
              <UIcon name="i-lucide-key-round" />
              <span class="text-sm">{{ pk.name || 'Passkey' }}</span>
            </div>
            <UButton size="xs" color="error" variant="ghost" @click="deletePasskey(pk.id)">
              <UIcon name="i-lucide-trash-2" />
            </UButton>
          </div>
        </div>
      </div>
    </UCard>

    <!-- Actions -->
    <div class="flex justify-between">
      <UButton variant="outline" @click="passwordOpen = true">
        <UIcon name="i-lucide-lock" />
        {{ t('app.changePassword') }}
      </UButton>
      <UButton color="error" variant="soft" :loading="signOutLoading" @click="handleSignOut">
        <UIcon name="i-lucide-log-out" />
        {{ t('common.signOut') }}
      </UButton>
    </div>

    <!-- Edit Profile Modal -->
    <UModal v-model:open="editOpen">
      <template #header>
        {{ t('app.editProfile') }}
      </template>
      <template #body>
        <div class="space-y-4 p-4">
          <UFormField :label="t('app.name')">
            <UInput v-model="editForm.name" />
          </UFormField>
          <UButton block :loading="editLoading" @click="saveProfile">
            {{ t('common.save') }}
          </UButton>
        </div>
      </template>
    </UModal>

    <!-- 2FA Modal -->
    <UModal v-model:open="twoFaOpen">
      <template #header>
        {{ user?.twoFactorEnabled ? t('app.disable2fa') : t('app.enable2fa') }}
      </template>
      <template #body>
        <div class="space-y-4 p-4">
          <template v-if="twoFaUri">
            <div class="flex justify-center">
              <QRCode :value="twoFaUri" :size="200" />
            </div>
            <p class="text-sm text-center text-muted-foreground">
              {{ t('app.scanQr') }}
            </p>
            <UFormField :label="t('app.verificationCode')">
              <UInput v-model="twoFaCode" inputmode="numeric" maxlength="6" :placeholder="t('app.enterCode')" />
            </UFormField>
            <UButton block :loading="twoFaLoading" @click="enable2FA">
              {{ t('app.verifyEnable') }}
            </UButton>
          </template>
          <template v-else>
            <UFormField :label="t('common.password')">
              <UInput v-model="twoFaPassword" type="password" :placeholder="t('common.password')" />
            </UFormField>
            <UButton block :loading="twoFaLoading" @click="user?.twoFactorEnabled ? disable2FA() : enable2FA()">
              {{ user?.twoFactorEnabled ? t('app.disable2fa') : t('app.continue') }}
            </UButton>
          </template>
        </div>
      </template>
    </UModal>

    <!-- Passkey Modal -->
    <UModal v-model:open="passkeyOpen">
      <template #header>
        {{ t('app.addPasskey') }}
      </template>
      <template #body>
        <div class="space-y-4 p-4">
          <UFormField :label="t('app.passkeyName')">
            <UInput v-model="passkeyName" placeholder="My Passkey" />
          </UFormField>
          <UButton block :loading="passkeyLoading" @click="addPasskey">
            {{ t('app.createPasskey') }}
          </UButton>
        </div>
      </template>
    </UModal>

    <!-- Change Password Modal -->
    <UModal v-model:open="passwordOpen">
      <template #header>
        {{ t('app.changePassword') }}
      </template>
      <template #body>
        <div class="space-y-4 p-4">
          <UFormField :label="t('app.currentPassword')">
            <UInput v-model="passwordForm.current" type="password" />
          </UFormField>
          <UFormField :label="t('app.newPassword')">
            <UInput v-model="passwordForm.new" type="password" />
          </UFormField>
          <UFormField :label="t('app.confirmNewPassword')">
            <UInput v-model="passwordForm.confirm" type="password" />
          </UFormField>
          <UCheckbox v-model="passwordForm.revokeOthers" :label="t('app.signOutOthers')" />
          <UButton block :loading="passwordLoading" @click="changePassword">
            {{ t('app.changePassword') }}
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
