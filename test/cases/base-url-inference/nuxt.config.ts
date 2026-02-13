export default defineNuxtConfig({
  modules: ['../../../src/module'],
  runtimeConfig: {
    betterAuthSecret: 'test-secret-for-testing-only-32chars!',
  },
})
