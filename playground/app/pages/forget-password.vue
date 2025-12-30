<script setup lang="ts">
definePageMeta({ layout: 'auth' })

const { client } = useUserSession()
const toast = useToast()
const emailWarning = useEmailWarning()

const email = ref('')
const loading = ref(false)
const success = ref(false)

async function handleRequestReset() {
  loading.value = true
  const { error } = await client!.requestPasswordReset({ email: email.value, redirectTo: '/reset-password' })
  loading.value = false

  if (error) {
    toast.add({ title: 'Error', description: error.message || 'Failed to send reset email', color: 'error' })
    return
  }

  success.value = true
  toast.add({ title: 'Success', description: 'Check your email for the reset link', color: 'success' })
  emailWarning()
}
</script>

<template>
  <UCard class="max-w-md">
    <template #header>
      <h3 class="text-lg md:text-xl font-semibold leading-none tracking-tight">
        Forgot Password
      </h3>
      <p class="text-xs md:text-sm text-muted-foreground">
        Enter your email to receive a password reset link
      </p>
    </template>

    <div v-if="!success" class="grid gap-4">
      <div class="grid gap-2">
        <label for="email" class="text-sm font-medium leading-none">Email</label>
        <UInput id="email" v-model="email" type="email" placeholder="m@example.com" />
      </div>

      <UButton block :loading="loading" @click="handleRequestReset">
        Send Reset Link
      </UButton>

      <NuxtLink to="/login" class="text-sm text-center underline text-muted-foreground">
        Back to login
      </NuxtLink>
    </div>

    <div v-else class="grid gap-4 text-center">
      <p class="text-sm text-muted-foreground">
        If an account exists for {{ email }}, you will receive a password reset link.
      </p>
      <NuxtLink to="/login">
        <UButton variant="outline" block>
          Back to login
        </UButton>
      </NuxtLink>
    </div>

    <template #footer>
      <div class="flex justify-center w-full border-t pt-4">
        <p class="text-center text-xs text-neutral-500">
          built with
          <a href="https://nuxt-better-auth.onmax.me/" class="underline" target="_blank">
            <span class="dark:text-white/70 cursor-pointer">nuxt-better-auth.</span>
          </a>
        </p>
      </div>
    </template>
  </UCard>
</template>
