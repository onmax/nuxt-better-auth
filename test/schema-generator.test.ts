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
    const tables = { user: { modelName: 'custom_user', fields: {} } }
    const schema = generateDrizzleSchema(tables, 'sqlite', { usePlural: true })
    expect(schema).toContain('sqliteTable(\'custom_user\'')
  })
})
