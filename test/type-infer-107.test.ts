import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const fixtureDir = fileURLToPath(new URL('./fixtures/type-infer-107', import.meta.url))
const env = {
  ...process.env,
  BETTER_AUTH_SECRET: 'test-secret-for-testing-only-32chars',
}

describe('type inference regression #107', () => {
  it('typechecks routeRules user fields inferred from plugins/additionalFields', () => {
    const prepare = spawnSync('npx', ['nuxi', 'prepare'], {
      cwd: fixtureDir,
      env,
      encoding: 'utf8',
    })
    expect(prepare.status, `nuxi prepare failed:\n${prepare.stdout}\n${prepare.stderr}`).toBe(0)

    const typecheck = spawnSync('npx', ['vue-tsc', '--noEmit', '--pretty', 'false', '-p', 'tsconfig.type-check.json'], {
      cwd: fixtureDir,
      env,
      encoding: 'utf8',
    })
    expect(typecheck.status, `vue-tsc failed:\n${typecheck.stdout}\n${typecheck.stderr}`).toBe(0)
    const output = `${typecheck.stdout}\n${typecheck.stderr}`

    expect(output).not.toContain(`is not assignable to type 'BetterAuthPlugin'`)
    expect(output).not.toContain(`'role' does not exist in type`)
    expect(output).not.toContain(`'internalCode' does not exist in type`)
  }, 60_000)
})
