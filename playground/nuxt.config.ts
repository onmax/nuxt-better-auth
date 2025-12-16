export default defineNuxtConfig({
  modules: ['@nuxthub/core', '@nuxt/ui', 'nuxt-qrcode', '../src/module'],

  css: ['~/assets/css/main.css'],

  app: {
    head: {
      link: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
    },
  },

  hub: { db: 'sqlite' },

  devtools: { enabled: true },

  runtimeConfig: {
    betterAuthSecret: 'dev-secret-change-in-production-32+',
  },

  auth: {
    redirects: {
      login: '/login',
      guest: '/',
    },
  },

  routeRules: {
    '/app/**': { auth: 'user' },
    '/admin/**': { auth: { user: { role: 'admin' } } },
    '/login': { auth: 'guest' },
    '/register': { auth: 'guest' },
    '/forget-password': { auth: 'guest' },
    '/two-factor': { auth: false },
    '/two-factor/otp': { auth: false },
  },

  compatibilityDate: '2025-01-01',
})
