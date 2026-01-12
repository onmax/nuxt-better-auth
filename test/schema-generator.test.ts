import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { getAuthTables } from 'better-auth/db'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { generateDrizzleSchema, loadUserAuthConfig } from '../src/schema-generator'

const TEST_DIR = join(import.meta.dirname, '.test-configs')

beforeAll(() => {
  if (!existsSync(TEST_DIR))
    mkdirSync(TEST_DIR, { recursive: true })
})
afterAll(() => {
  if (existsSync(TEST_DIR))
    rmSync(TEST_DIR, { recursive: true })
})

describe('generateDrizzleSchema', () => {
  it('singular table names by default', async () => {
    const schema = await generateDrizzleSchema({}, 'sqlite')
    expect(schema).toContain('export const user = sqliteTable("user"')
    expect(schema).toContain('"session"')
    expect(schema).toContain('export const session = ')
  })

  it('plural table names with usePlural', async () => {
    const schema = await generateDrizzleSchema({}, 'sqlite', { usePlural: true })
    expect(schema).toContain('"users"')
    expect(schema).toContain('"sessions"')
    expect(schema).toContain('export const users = ')
    expect(schema).toContain('export const sessions = ')
  })

  it('postgresql uses text id by default', async () => {
    const schema = await generateDrizzleSchema({}, 'postgresql')
    expect(schema).toContain('text("id").primaryKey()')
    expect(schema).not.toContain('uuid("id")')
  })

  it('postgresql uses uuid id with useUuid', async () => {
    const schema = await generateDrizzleSchema({}, 'postgresql', { useUuid: true })
    expect(schema).toContain('uuid("id")')
  })

  it('postgresql FK columns use uuid with useUuid', async () => {
    const schema = await generateDrizzleSchema({}, 'postgresql', { useUuid: true })
    expect(schema).toContain('uuid("userId")')
  })

  it('sqlite ignores useUuid (no native uuid support)', async () => {
    const schema = await generateDrizzleSchema({}, 'sqlite', { useUuid: true })
    expect(schema).toContain('text("id").primaryKey()')
    expect(schema).not.toContain('uuid')
  })

  it('mysql FK columns use varchar(36) with useUuid', async () => {
    const schema = await generateDrizzleSchema({}, 'mysql', { useUuid: true })
    expect(schema).toContain('varchar("userId", { length: 36 })')
  })

  it('snake_case field names with casing option', async () => {
    const schema = await generateDrizzleSchema({}, 'postgresql', { casing: 'snake_case' })
    expect(schema).toContain('email_verified')
    expect(schema).toContain('created_at')
  })

  it('snake_case table names with casing option', async () => {
    const schema = await generateDrizzleSchema({}, 'postgresql', { casing: 'snake_case' })
    expect(schema).toContain('pgTable("user"')
  })

  it('generates relations', async () => {
    const schema = await generateDrizzleSchema({}, 'postgresql')
    expect(schema).toContain('relations')
  })
})

describe('getAuthTables with secondaryStorage', () => {
  it('excludes session table when secondaryStorage is provided', () => {
    const mockStorage = { get: async () => null, set: async () => {}, delete: async () => {} }
    const tables = getAuthTables({ secondaryStorage: mockStorage })
    expect(tables).not.toHaveProperty('session')
    expect(tables).toHaveProperty('user')
    expect(tables).toHaveProperty('account')
  })

  it('includes session table when secondaryStorage is undefined', () => {
    const tables = getAuthTables({})
    expect(tables).toHaveProperty('session')
    expect(tables).toHaveProperty('user')
  })
})

describe('loadUserAuthConfig', () => {
  it('returns empty object for non-existent file (dev mode)', async () => {
    const result = await loadUserAuthConfig(join(TEST_DIR, 'nonexistent.ts'), false)
    expect(result).toEqual({})
  })

  it('throws for non-existent file when throwOnError=true', async () => {
    await expect(loadUserAuthConfig(join(TEST_DIR, 'nonexistent.ts'), true)).rejects.toThrow('Failed to load auth config')
  })

  it('returns config from valid defineServerAuth export', async () => {
    const configPath = join(TEST_DIR, 'valid-config.ts')
    writeFileSync(configPath, `export default defineServerAuth(() => ({ plugins: [] }))`)
    const result = await loadUserAuthConfig(configPath, false)
    expect(result).toEqual({ plugins: [] })
  })

  it('warns and returns empty for non-function export (dev mode)', async () => {
    const configPath = join(TEST_DIR, 'invalid-config.ts')
    writeFileSync(configPath, `export default { notAFunction: true }`)
    const result = await loadUserAuthConfig(configPath, false)
    expect(result).toEqual({})
  })

  it('throws for non-function export when throwOnError=true', async () => {
    const configPath = join(TEST_DIR, 'invalid-config2.ts')
    writeFileSync(configPath, `export default { notAFunction: true }`)
    await expect(loadUserAuthConfig(configPath, true)).rejects.toThrow('must export default defineServerAuth')
  })
})
