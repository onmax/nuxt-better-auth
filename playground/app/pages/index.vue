<script setup lang="ts">
const features = [
  { name: 'Email & Password', link: 'https://www.better-auth.com/docs/authentication/email-password' },
  { name: 'Social Auth', link: 'https://www.better-auth.com/docs/authentication/social' },
  { name: 'Passkeys', link: 'https://www.better-auth.com/docs/plugins/passkey' },
  { name: 'Two-Factor', link: 'https://www.better-auth.com/docs/plugins/2fa' },
  { name: 'Password Reset', link: 'https://www.better-auth.com/docs/authentication/email-password#request-password-reset' },
  { name: 'Session Management', link: 'https://www.better-auth.com/docs/concepts/session-management' },
  { name: 'Admin Panel', link: 'https://www.better-auth.com/docs/plugins/admin' },
]

const { loggedIn } = useUserSession()
</script>

<template>
  <div class="min-h-[80vh] flex items-center justify-center px-6 md:px-0">
    <main class="flex flex-col gap-4 items-center justify-center">
      <div class="flex flex-col gap-1">
        <h3 class="text-3xl sm:text-4xl text-foreground text-center font-semibold">
          BETTER-AUTH.
        </h3>
        <p class="text-center text-sm md:text-base text-muted-foreground">
          Official demo to showcase
          <a href="https://better-auth.com" target="_blank" class="italic underline">better-auth.</a>
          features using
          <a href="https://nuxt-better-auth.onmax.me" target="_blank" class="italic underline">nuxt-better-auth.</a>
        </p>
      </div>
      <div class="md:w-10/12 w-full flex flex-col gap-4">
        <div class="flex flex-col gap-3 pt-2">
          <div class="border-y p-2 border-dashed bg-secondary/70">
            <p class="text-xs text-center text-muted-foreground">
              All features on this demo are implemented with Better Auth without any custom backend code
            </p>
          </div>
          <div class="flex gap-2 justify-center flex-wrap">
            <a
              v-for="feature in features"
              :key="feature.name"
              :href="feature.link"
              target="_blank"
              class="border-b pb-1 text-muted-foreground text-xs cursor-pointer hover:text-foreground transition-colors hover:border-foreground"
            >
              {{ feature.name }}
            </a>
          </div>
        </div>
        <div class="flex justify-center">
          <UButton :to="loggedIn ? '/app' : '/login'" size="lg">
            <template #leading>
              <svg v-if="!loggedIn" xmlns="http://www.w3.org/2000/svg" width="1.2em" height="1.2em" viewBox="0 0 24 24">
                <path fill="currentColor" d="M5 3H3v4h2V5h14v14H5v-2H3v4h18V3zm12 8h-2V9h-2V7h-2v2h2v2H3v2h10v2h-2v2h2v-2h2v-2h2z" />
              </svg>
              <svg v-else xmlns="http://www.w3.org/2000/svg" width="1.2em" height="1.2em" viewBox="0 0 24 24">
                <path fill="currentColor" d="M2 3h20v18H2zm18 16V7H4v12z" />
              </svg>
            </template>
            {{ loggedIn ? 'Dashboard' : 'Sign In' }}
          </UButton>
        </div>
      </div>
    </main>
  </div>
</template>
