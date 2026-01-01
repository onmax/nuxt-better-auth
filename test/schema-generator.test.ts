import { describe, expect, it } from 'vitest'
import { generateDrizzleSchema, generateField } from '../src/schema-generator'

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
    const tables = { user: { modelName: 'custom_user', fields: {} } }
    const schema = generateDrizzleSchema(tables, 'sqlite', { usePlural: true })
    expect(schema).toContain('sqliteTable(\'custom_user\'')
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

  it('generates function defaults with $defaultFn', () => {
    const field = {
      type: 'Date',
      required: true,
      defaultValue: () => /* @__PURE__ */ new Date(),
    }
    const result = generateField('createdAt', field, 'sqlite', {})
    expect(result).toContain('.$defaultFn(')
    expect(result).not.toContain('\'() =>') // no quotes around function
  })

  it('generates $onUpdate for date fields with onUpdate function', () => {
    const field = {
      type: 'date',
      required: true,
      onUpdate: () => new Date(),
    }
    const result = generateField('updatedAt', field, 'sqlite', {})
    expect(result).toContain('.$onUpdate(')
  })
})
