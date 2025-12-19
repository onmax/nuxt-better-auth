<script setup lang="ts">
definePageMeta({ layout: 'auth' })

const { signIn } = useUserSession()
const toast = useToast()

const email = ref('')
const password = ref('')
const rememberMe = ref(false)
const loading = ref(false)
const passkeyLoading = ref(false)

async function handleSignIn() {
  loading.value = true
  await signIn.email(
    { email: email.value, password: password.value, rememberMe: rememberMe.value },
    {
      onSuccess: () => {
        toast.add({ title: 'Success', description: 'Successfully signed in', color: 'success' })
        navigateTo('/app')
      },
      onError: (ctx) => {
        toast.add({ title: 'Error', description: ctx.error.message || 'Sign in failed', color: 'error' })
      },
    },
  )
  loading.value = false
}

async function handleSocialSignIn(provider: string) {
  try {
    await signIn.social({ provider, callbackURL: '/app' })
  }
  catch (e: any) {
    toast.add({ title: 'Error', description: e.message || `${provider} sign in failed`, color: 'error' })
  }
}

async function handlePasskeySignIn() {
  passkeyLoading.value = true
  await signIn.passkey({
    fetchOptions: {
      onSuccess: async () => {
        toast.add({ title: 'Success', description: 'Successfully signed in', color: 'success' })
        await navigateTo('/app')
      },
      onError: (ctx) => {
        toast.add({ title: 'Error', description: ctx.error.message || 'Passkey sign in failed', color: 'error' })
      },
    },
  })
  passkeyLoading.value = false
}
</script>

<template>
  <UCard class="max-w-md">
    <template #header>
      <h3 class="text-lg md:text-xl font-semibold leading-none tracking-tight">
        Sign In
      </h3>
      <p class="text-xs md:text-sm text-muted-foreground">
        Enter your email below to login to your account
      </p>
    </template>

    <div class="grid gap-4">
      <div class="grid gap-2">
        <label for="email" class="text-sm font-medium leading-none">Email</label>
        <UInput id="email" v-model="email" type="email" placeholder="m@example.com" />
      </div>

      <div class="grid gap-2">
        <div class="flex items-center">
          <label for="password" class="text-sm font-medium leading-none">Password</label>
          <NuxtLink to="/forget-password" class="ml-auto inline-block text-sm underline">
            Forgot your password?
          </NuxtLink>
        </div>
        <UInput id="password" v-model="password" type="password" placeholder="password" autocomplete="password" />
      </div>

      <UCheckbox id="remember" v-model="rememberMe" label="Remember me" />

      <UButton block :loading="loading" @click="handleSignIn">
        Login
      </UButton>

      <div class="w-full gap-2 flex items-center justify-between flex-col">
        <UButton variant="outline" block @click="handleSocialSignIn('github')">
          <UIcon name="i-simple-icons-github" />
          <span>Sign in with GitHub</span>
        </UButton>

        <UButton variant="outline" block :loading="passkeyLoading" @click="handlePasskeySignIn">
          <UIcon name="i-lucide-key-round" />
          <span>Sign in with Passkey</span>
        </UButton>
      </div>
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
