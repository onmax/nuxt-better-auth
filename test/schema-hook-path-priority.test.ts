import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'pathe'
import { afterEach, describe, expect, it } from 'vitest'
import { resolveHubSchemaPath } from '../src/module/schema'

const tempDirs: string[] = []

function createBuildDir() {
  const dir = mkdtempSync(join(tmpdir(), 'nuxt-better-auth-schema-'))
  tempDirs.push(dir)
  return dir
}

afterEach(() => {
  for (const dir of tempDirs.splice(0, tempDirs.length))
    rmSync(dir, { recursive: true, force: true })
})

describe('resolveHubSchemaPath', () => {
  it('prefers .mjs when both .mjs and .ts exist', () => {
    const buildDir = createBuildDir()
    const rootDir = createBuildDir()
    const schemaDir = join(buildDir, 'better-auth')
    const tsPath = join(schemaDir, 'schema.sqlite.ts')
    const mjsPath = join(schemaDir, 'schema.sqlite.mjs')

    mkdirSync(schemaDir, { recursive: true })
    writeFileSync(tsPath, 'export {}', { flag: 'w' })
    writeFileSync(mjsPath, 'export {}', { flag: 'w' })

    const selected = resolveHubSchemaPath(buildDir, rootDir, 'sqlite')
    expect(selected).toBe(mjsPath)
  })

  it('prefers mirrored root .nuxt schema.ts when buildDir is under node_modules', () => {
    const rootDir = createBuildDir()
    const buildDir = join(rootDir, 'node_modules', '.cache', 'nuxt', '.nuxt')
    const buildSchemaDir = join(buildDir, 'better-auth')
    const rootSchemaDir = join(rootDir, '.nuxt', 'better-auth')
    const rootTsPath = join(rootSchemaDir, 'schema.sqlite.ts')
    const buildMjsPath = join(buildSchemaDir, 'schema.sqlite.mjs')

    mkdirSync(buildSchemaDir, { recursive: true })
    mkdirSync(rootSchemaDir, { recursive: true })
    writeFileSync(buildMjsPath, 'export {}', { flag: 'w' })
    writeFileSync(rootTsPath, 'export {}', { flag: 'w' })

    const selected = resolveHubSchemaPath(buildDir, rootDir, 'sqlite')
    expect(selected).toBe(rootTsPath)
  })

  it('falls back to .ts when .mjs does not exist', () => {
    const buildDir = createBuildDir()
    const rootDir = createBuildDir()
    const schemaDir = join(buildDir, 'better-auth')
    const tsPath = join(schemaDir, 'schema.sqlite.ts')

    mkdirSync(schemaDir, { recursive: true })
    writeFileSync(tsPath, 'export {}', { flag: 'w' })

    const selected = resolveHubSchemaPath(buildDir, rootDir, 'sqlite')
    expect(selected).toBe(tsPath)
  })

  it('returns null when no schema files exist', () => {
    const buildDir = createBuildDir()
    const rootDir = createBuildDir()
    const selected = resolveHubSchemaPath(buildDir, rootDir, 'sqlite')
    expect(selected).toBeNull()
  })
})
