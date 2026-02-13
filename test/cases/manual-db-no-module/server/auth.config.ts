import { memoryAdapter } from 'better-auth/adapters/memory'
import { defineServerAuth } from '../../../../src/runtime/config'

const memoryDb = {
  user: [],
  session: [],
  account: [],
  verification: [],
  rateLimit: [],
}

export default defineServerAuth({
  appName: 'Manual DB No Module Provider',
  database: memoryAdapter(memoryDb),
  socialProviders: {
    github: { clientId: 'test', clientSecret: 'test' },
  },
})
