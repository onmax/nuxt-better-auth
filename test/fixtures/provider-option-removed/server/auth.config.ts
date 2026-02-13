import { defineServerAuth } from '../../../../src/runtime/config'

export default defineServerAuth({
  appName: 'Removed Provider Option',
  socialProviders: {
    github: { clientId: 'test', clientSecret: 'test' },
  },
})
