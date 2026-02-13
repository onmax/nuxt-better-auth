import { fileURLToPath } from 'node:url'
import { $fetch, setup } from '@nuxt/test-utils/e2e'
import { describe, expect, it } from 'vitest'

describe('no-hub mode (without NuxtHub)', async () => {
  await setup({
    rootDir: fileURLToPath(new URL('./cases/without-nuxthub', import.meta.url)),
  })

  it('renders home page without NuxtHub', async () => {
    const html = await $fetch('/')
    expect(html).toContain('No-Hub Mode')
  })

  it('auth API responds without NuxtHub', async () => {
    const response = await $fetch('/api/auth/ok')
    expect(response).toBeDefined()
  })
})
