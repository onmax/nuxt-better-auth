import { fileURLToPath } from 'node:url'
import { setup, url } from '@nuxt/test-utils/e2e'
import { describe, expect, it } from 'vitest'

describe('serverAuth trustedOrigins in dev with explicit siteUrl', async () => {
  await setup({
    rootDir: fileURLToPath(new URL('./cases/dev-trusted-origins', import.meta.url)),
    dev: true,
  })

  it('includes explicit production origin and detected localhost origin', async () => {
    const response = await fetch(url('/api/test/trusted-origins'))
    expect(response.status).toBe(200)
    const body = await response.json() as { trustedOrigins: string[] }

    const testServerUrl = new URL(url('/'))
    const expectedLocalhostOrigin = `${testServerUrl.protocol}//localhost:${testServerUrl.port}`

    expect(body.trustedOrigins).toContain('https://foo.workers.dev')
    expect(body.trustedOrigins).toContain(expectedLocalhostOrigin)
  })
})
