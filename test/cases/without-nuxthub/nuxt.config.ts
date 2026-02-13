export default defineNuxtConfig({
  modules: ['../../../src/module'], // No @nuxthub/core

  runtimeConfig: {
    betterAuthSecret: 'test-secret-for-testing-only-32chars!',
    public: { siteUrl: 'http://localhost:3000' },
  },

  auth: {
    redirects: { login: '/login', guest: '/' },
  },
})
