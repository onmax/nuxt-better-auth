import { defineServerAuth } from '../../../../src/runtime/config'

export default defineServerAuth({
  appName: 'Removed Mixed Database Options',
  socialProviders: {
    github: { clientId: 'test', clientSecret: 'test' },
  },
})
