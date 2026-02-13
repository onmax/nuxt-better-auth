export default defineNuxtConfig({
  modules: ['@nuxthub/core', '../../../src/module'],

  hub: { db: 'sqlite' },

  runtimeConfig: {
    betterAuthSecret: 'test-secret-for-testing-only-32chars!',
    public: { siteUrl: 'http://localhost:3000' },
  },

  auth: {
    redirects: {
      login: '/login',
      guest: '/',
    },
  },

  routeRules: {
    '/protected': { auth: 'user' },
    '/admin': { auth: { user: { role: 'admin' } } },
    '/login': { auth: 'guest' },
    '/custom-protected': { auth: { only: 'user', redirectTo: '/custom-login' } },
    '/dynamic/protected': { auth: 'user' },
    '/dynamic/guest': { auth: 'guest' },
  },
})
