import { defineServerAuth } from '../../../../src/runtime/config'

// Function syntax - demonstrates runtimeConfig access
export default defineServerAuth(({ runtimeConfig }) => ({
  appName: 'No-Hub Test App',
  // OAuth only - email/password needs database
  socialProviders: {
    github: { clientId: runtimeConfig.github?.clientId || 'test', clientSecret: runtimeConfig.github?.clientSecret || 'test' },
  },
}))
