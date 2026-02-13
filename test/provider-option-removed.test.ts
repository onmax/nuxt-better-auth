import { fileURLToPath } from 'node:url'
import { x } from 'tinyexec'
import { describe, expect, it } from 'vitest'

const cases = [
  {
    name: 'provider',
    fixture: './fixtures/provider-option-removed',
    expectedKeys: ['auth.database.provider'],
    expectedRemoveList: 'Remove: auth.database.provider',
  },
  {
    name: 'convexUrl',
    fixture: './fixtures/convex-url-option-removed',
    expectedKeys: ['auth.database.convexUrl'],
    expectedRemoveList: 'Remove: auth.database.convexUrl',
  },
  {
    name: 'mixed database options',
    fixture: './fixtures/mixed-database-options-removed',
    expectedKeys: ['auth.database.convexUrl', 'auth.database.provider'],
    expectedRemoveList: 'Remove: auth.database.convexUrl, auth.database.provider',
  },
] as const

describe('removed auth.database.* options', () => {
  it.each(cases)('throws a migration error when $name is configured', async ({ fixture, expectedKeys, expectedRemoveList }) => {
    const fixtureDir = fileURLToPath(new URL(fixture, import.meta.url))
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
    const output = `${res.stdout}\n${res.stderr}`
    expect(output).toContain('auth.database options have been removed')
    expect(output).toContain(expectedRemoveList)
    for (const key of expectedKeys)
      expect(output).toContain(key)
  }, 60_000)
})
