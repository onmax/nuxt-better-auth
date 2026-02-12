export default defineNuxtConfig({
  modules: ['../../../src/module'],
  runtimeConfig: {
    betterAuthSecret: 'test-secret-for-testing-only-32chars!',
    public: { siteUrl: 'http://localhost:3000' },
  },
  routeRules: {
    '/admin/**': { auth: { user: { role: 'admin', internalCode: 'x' } } },
  },
})
