import { describe, expect, it } from 'vitest'
import { generateDrizzleSchema } from '../src/schema-generator'

const mockTables = {
  user: { fields: { name: { type: 'string', required: true } } },
  session: { fields: { token: { type: 'string', required: true } } },
}

describe('generateDrizzleSchema', () => {
  it('singular table names by default', () => {
    const schema = generateDrizzleSchema(mockTables, 'sqlite')
    expect(schema).toContain('sqliteTable(\'user\'')
    expect(schema).toContain('sqliteTable(\'session\'')
  })

  it('plural table names with usePlural', () => {
    const schema = generateDrizzleSchema(mockTables, 'sqlite', { usePlural: true })
    expect(schema).toContain('sqliteTable(\'users\'')
    expect(schema).toContain('sqliteTable(\'sessions\'')
  })

  it('custom modelName takes precedence over usePlural', () => {
    // Only a DIFFERENT modelName should skip pluralization
    const tables = { user: { modelName: 'custom_user', fields: {} } }
    const schema = generateDrizzleSchema(tables, 'sqlite', { usePlural: true })
    expect(schema).toContain('sqliteTable(\'custom_user\'')
  })

  it('same modelName as tableName does not skip transformations', () => {
    // better-auth sets modelName=tableName by default, this should NOT skip transforms
    const tables = { user: { modelName: 'user', fields: {} } }
    const schema = generateDrizzleSchema(tables, 'sqlite', { usePlural: true })
    expect(schema).toContain('sqliteTable(\'users\'')
  })

  it('postgresql uses text id by default', () => {
    const schema = generateDrizzleSchema(mockTables, 'postgresql')
    expect(schema).toContain('id: text(\'id\').primaryKey()')
    expect(schema).not.toContain('uuid')
  })

  it('postgresql uses uuid id with useUuid', () => {
    const schema = generateDrizzleSchema(mockTables, 'postgresql', { useUuid: true })
    expect(schema).toContain('id: uuid(\'id\').defaultRandom().primaryKey()')
    expect(schema).toContain('import { boolean, integer, pgTable, text, timestamp, uuid }')
  })

  it('postgresql FK columns use uuid with useUuid', () => {
    const tables = {
      user: { fields: { name: { type: 'string', required: true } } },
      session: { fields: { userId: { type: 'string', required: true, references: { model: 'user', field: 'id' } } } },
    }
    const schema = generateDrizzleSchema(tables, 'postgresql', { useUuid: true })
    expect(schema).toContain('userId: uuid(\'userId\')')
  })

  it('sqlite ignores useUuid (no native uuid support)', () => {
    const schema = generateDrizzleSchema(mockTables, 'sqlite', { useUuid: true })
    expect(schema).toContain('id: text(\'id\').primaryKey()')
    expect(schema).not.toContain('uuid')
  })

  it('mysql FK columns use varchar(36) with useUuid', () => {
    const tables = {
      user: { fields: { name: { type: 'string', required: true } } },
      session: { fields: { userId: { type: 'string', required: true, references: { model: 'user', field: 'id' } } } },
    }
    const schema = generateDrizzleSchema(tables, 'mysql', { useUuid: true })
    expect(schema).toContain('userId: varchar(\'userId\', { length: 36 })')
  })

  it('snake_case field names with casing option', () => {
    const tables = { user: { fields: { emailVerified: { type: 'boolean' }, createdAt: { type: 'date' } } } }
    const schema = generateDrizzleSchema(tables, 'postgresql', { casing: 'snake_case' })
    expect(schema).toContain('emailVerified: boolean(\'email_verified\')')
    expect(schema).toContain('createdAt: timestamp(\'created_at\')')
  })

  it('snake_case table names with casing option', () => {
    const tables = { userAccount: { fields: { name: { type: 'string' } } } }
    const schema = generateDrizzleSchema(tables, 'postgresql', { casing: 'snake_case' })
    expect(schema).toContain('pgTable(\'user_account\'')
  })

  it('usePlural + snake_case combines correctly', () => {
    const tables = { userAccount: { fields: {} } }
    const schema = generateDrizzleSchema(tables, 'postgresql', { usePlural: true, casing: 'snake_case' })
    expect(schema).toContain('pgTable(\'user_accounts\'')
  })

  it('camelCase casing option keeps names unchanged', () => {
    const tables = { user: { fields: { emailVerified: { type: 'boolean' } } } }
    const schema = generateDrizzleSchema(tables, 'postgresql', { casing: 'camelCase' })
    expect(schema).toContain('emailVerified: boolean(\'emailVerified\')')
  })
})
