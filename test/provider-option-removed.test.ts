import { fileURLToPath } from 'node:url'
import { x } from 'tinyexec'
import { describe, expect, it } from 'vitest'

describe('removed auth.database.provider option', () => {
  it('throws a migration error when provider is configured', async () => {
    const fixtureDir = fileURLToPath(new URL('./fixtures/provider-option-removed', import.meta.url))
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
    expect(`${res.stdout}\n${res.stderr}`).toContain('auth.database.provider has been removed')
  }, 60_000)
})
