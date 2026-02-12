import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { x } from 'tinyexec'

describe('convex provider', () => {
  it('throws when provider is selected but not registered', async () => {
    const fixtureDir = fileURLToPath(new URL('./fixtures/convex-missing', import.meta.url))
    const nuxiBin = fileURLToPath(new URL('../node_modules/.bin/nuxi', import.meta.url))

    const res = await x(nuxiBin, ['prepare'], {
      nodeOptions: {
        cwd: fixtureDir,
        env: {
          ...process.env,
          CI: '1',
        },
      },
      throwOnError: false,
    })

    expect(res.exitCode).not.toBe(0)
    expect(`${res.stdout}\n${res.stderr}`).toContain('no Convex provider was registered')
  }, 60_000)
})
