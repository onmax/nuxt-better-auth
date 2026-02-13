import { defineServerAuth } from '../../../../src/runtime/config'

export default defineServerAuth({
  appName: 'Removed Convex URL Option',
  socialProviders: {
    github: { clientId: 'test', clientSecret: 'test' },
  },
})
