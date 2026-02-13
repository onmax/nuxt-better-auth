import { fileURLToPath } from 'node:url'
import { $fetch, setup } from '@nuxt/test-utils/e2e'
import { describe, expect, it } from 'vitest'

describe('no-db mode (NuxtHub without database)', async () => {
  await setup({
    rootDir: fileURLToPath(new URL('./cases/database-less', import.meta.url)),
  })

  it('renders home page without database', async () => {
    const html = await $fetch('/')
    expect(html).toContain('Database-less Mode')
  })

  it('auth API responds without database', async () => {
    const response = await $fetch('/api/auth/ok')
    expect(response).toBeDefined()
  })

  it('exposes runtime database metadata as none', async () => {
    const response = await $fetch('/api/test/config') as { useDatabase: boolean, databaseProvider: string, databaseSource: 'module' | 'user' }
    expect(response.useDatabase).toBe(false)
    expect(response.databaseProvider).toBe('none')
    expect(response.databaseSource).toBe('module')
  })
})
