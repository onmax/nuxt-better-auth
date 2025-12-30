import { createAuthClient } from 'better-auth/vue'

export function createAppAuthClient(baseURL: string) {
  return createAuthClient({ baseURL })
}
