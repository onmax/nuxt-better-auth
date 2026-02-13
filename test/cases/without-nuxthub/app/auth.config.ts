import { defineClientAuth } from '../../../../src/runtime/config'

// Function syntax - demonstrates context access
export default defineClientAuth(ctx => ({
  fetchOptions: { headers: { 'x-requested-from': ctx.siteUrl } },
}))
