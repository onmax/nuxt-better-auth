import { fileURLToPath } from 'node:url'
import { $fetch, setup } from '@nuxt/test-utils/e2e'
import { describe, expect, it } from 'vitest'

describe('manual Better Auth database precedence', async () => {
  await setup({
    rootDir: fileURLToPath(new URL('./cases/manual-db', import.meta.url)),
  })

  it('uses user-configured database over module auto provider', async () => {
    const response = await $fetch('/api/test/config') as { useDatabase: boolean, databaseProvider: string, databaseSource: 'module' | 'user' }
    expect(response.useDatabase).toBe(true)
    expect(response.databaseProvider).toBe('user')
    expect(response.databaseSource).toBe('user')
  })
})
