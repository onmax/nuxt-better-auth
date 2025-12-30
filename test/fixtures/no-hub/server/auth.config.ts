import { defineServerAuth } from '../../../../src/runtime/config'

export default defineServerAuth(() => ({
  appName: 'No-Hub Test App',
  // OAuth only - email/password needs database
  socialProviders: {
    github: { clientId: 'test', clientSecret: 'test' },
  },
}))
