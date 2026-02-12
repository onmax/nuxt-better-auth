import { defineServerAuth } from '../../../../src/runtime/config'

export default defineServerAuth({
  appName: 'Convex Missing Provider Test App',
  socialProviders: {
    github: { clientId: 'test', clientSecret: 'test' },
  },
})

