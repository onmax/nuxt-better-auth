import { defineServerAuth } from '../../../../src/runtime/config'

export default defineServerAuth(({ runtimeConfig }) => ({
  appName: 'Base URL inference test app',
  socialProviders: {
    github: {
      clientId: runtimeConfig.github?.clientId || 'test',
      clientSecret: runtimeConfig.github?.clientSecret || 'test',
    },
  },
}))
