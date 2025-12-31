import type { BetterAuthOptions } from 'better-auth'
import { consola } from 'consola'

interface FieldAttribute { type: string | string[], required?: boolean, unique?: boolean, defaultValue?: any, references?: { model: string, field: string, onDelete?: string }, index?: boolean }
interface TableSchema { fields: Record<string, FieldAttribute>, modelName?: string }

export function generateDrizzleSchema(tables: Record<string, TableSchema>, dialect: 'sqlite' | 'postgresql' | 'mysql'): string {
  const imports = getImports(dialect)
  const tableDefinitions = Object.entries(tables).map(([tableName, table]) => generateTable(tableName, table, dialect, tables)).join('\n\n')

  return `${imports}\n\n${tableDefinitions}\n`
}

function getImports(dialect: 'sqlite' | 'postgresql' | 'mysql'): string {
  switch (dialect) {
    case 'sqlite':
      return `import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'`
    case 'postgresql':
      return `import { boolean, pgTable, text, timestamp, integer } from 'drizzle-orm/pg-core'`
    case 'mysql':
      return `import { boolean, int, mysqlTable, text, timestamp, varchar } from 'drizzle-orm/mysql-core'`
  }
}

function generateTable(tableName: string, table: TableSchema, dialect: 'sqlite' | 'postgresql' | 'mysql', allTables: Record<string, TableSchema>): string {
  const tableFunc = dialect === 'sqlite' ? 'sqliteTable' : dialect === 'postgresql' ? 'pgTable' : 'mysqlTable'
  const dbTableName = table.modelName || tableName
  const fields = Object.entries(table.fields).map(([fieldName, field]) => generateField(fieldName, field, dialect, allTables)).join(',\n    ')

  // Add id field (better-auth expects string ids)
  const idField = generateIdField(dialect)

  return `export const ${tableName} = ${tableFunc}('${dbTableName}', {
    ${idField},
    ${fields}
  })`
}

function generateIdField(dialect: 'sqlite' | 'postgresql' | 'mysql'): string {
  switch (dialect) {
    case 'sqlite':
    case 'postgresql':
      return `id: text('id').primaryKey()`
    case 'mysql':
      return `id: varchar('id', { length: 36 }).primaryKey()`
  }
}

function generateField(fieldName: string, field: FieldAttribute, dialect: 'sqlite' | 'postgresql' | 'mysql', allTables: Record<string, TableSchema>): string {
  const dbFieldName = fieldName
  let fieldDef = getFieldType(field.type, dialect, dbFieldName)

  if (field.required && field.defaultValue === undefined)
    fieldDef += '.notNull()'

  if (field.unique)
    fieldDef += '.unique()'

  if (field.defaultValue !== undefined) {
    if (typeof field.defaultValue === 'boolean')
      fieldDef += `.default(${field.defaultValue})`
    else if (typeof field.defaultValue === 'string')
      fieldDef += `.default('${field.defaultValue}')`
    else if (typeof field.defaultValue === 'function')
      fieldDef += `.$defaultFn('${field.defaultValue}')`
    else
      fieldDef += `.default(${field.defaultValue})`

    if (field.required)
      fieldDef += '.notNull()'
  }

  if (field.references) {
    const refTable = field.references.model
    if (allTables[refTable])
      fieldDef += `.references(() => ${refTable}.${field.references.field})`
  }

  return `${fieldName}: ${fieldDef}`
}

function getFieldType(type: string | string[], dialect: 'sqlite' | 'postgresql' | 'mysql', fieldName: string): string {
  // Handle enum types (string[]) - treat as text
  const normalizedType = Array.isArray(type) ? 'string' : type
  switch (dialect) {
    case 'sqlite':
      return getSqliteType(normalizedType, fieldName)
    case 'postgresql':
      return getPostgresType(normalizedType, fieldName)
    case 'mysql':
      return getMysqlType(normalizedType, fieldName)
  }
}

function getSqliteType(type: string, fieldName: string): string {
  switch (type) {
    case 'string':
      return `text('${fieldName}')`
    case 'boolean':
      return `integer('${fieldName}', { mode: 'boolean' })`
    case 'date':
      return `integer('${fieldName}', { mode: 'timestamp' })`
    case 'number':
      return `integer('${fieldName}')`
    default:
      return `text('${fieldName}')`
  }
}

function getPostgresType(type: string, fieldName: string): string {
  switch (type) {
    case 'string':
      return `text('${fieldName}')`
    case 'boolean':
      return `boolean('${fieldName}')`
    case 'date':
      return `timestamp('${fieldName}')`
    case 'number':
      return `integer('${fieldName}')`
    default:
      return `text('${fieldName}')`
  }
}

function getMysqlType(type: string, fieldName: string): string {
  switch (type) {
    case 'string':
      return `text('${fieldName}')`
    case 'boolean':
      return `boolean('${fieldName}')`
    case 'date':
      return `timestamp('${fieldName}')`
    case 'number':
      return `int('${fieldName}')`
    default:
      return `text('${fieldName}')`
  }
}

export async function loadUserAuthConfig(configPath: string, throwOnError = false): Promise<Partial<BetterAuthOptions>> {
  const { createJiti } = await import('jiti')
  const jiti = createJiti(import.meta.url, { interopDefault: true })

  try {
    const mod = await jiti.import(configPath) as any
    const configFn = mod.default || mod
    if (typeof configFn === 'function') {
      // Call with empty context - we only need plugins, not db
      return configFn({ runtimeConfig: {}, db: null })
    }
    if (throwOnError) {
      throw new Error('auth.config.ts must export default defineServerAuth(...)')
    }
    return {}
  }
  catch (error) {
    if (throwOnError) {
      throw new Error(`Failed to load auth config: ${error instanceof Error ? error.message : error}`)
    }
    consola.error('[@onmax/nuxt-better-auth] Failed to load auth config for schema generation. Schema may be incomplete:', error)
    return {}
  }
}
