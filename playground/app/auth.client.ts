import { navigateTo } from '#imports'
import { passkeyClient } from '@better-auth/passkey/client'
import { adminClient, multiSessionClient, twoFactorClient } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/vue'

export function createAppAuthClient(baseURL: string) {
  return createAuthClient({
    baseURL,
    plugins: [
      adminClient(),
      passkeyClient(),
      multiSessionClient(),
      twoFactorClient({
        onTwoFactorRedirect() {
          navigateTo('/two-factor')
        },
      }),
    ],
  })
}
