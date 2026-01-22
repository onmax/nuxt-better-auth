import type { DBAdapter } from '@better-auth/cli/api'
import type { BetterAuthOptions } from 'better-auth'
import type { BetterAuthDBSchema, DBFieldAttribute } from 'better-auth/db'
import { generateDrizzleSchema as _generateDrizzleSchema } from '@better-auth/cli/api'
import { getAuthTables } from 'better-auth/db'
import { consola } from 'consola'

export type CasingOption = 'camelCase' | 'snake_case'
export interface SchemaOptions { usePlural?: boolean, useUuid?: boolean, casing?: CasingOption }

type Dialect = 'sqlite' | 'postgresql' | 'mysql'
type Provider = 'sqlite' | 'pg' | 'mysql'

// Minimal interface matching what _generateDrizzleSchema actually uses from adapter
interface SchemaGeneratorAdapter {
  id: 'drizzle'
  options: { provider: Provider, camelCase: boolean, adapterConfig: { usePlural: boolean } }
}

function dialectToProvider(dialect: Dialect): Provider {
  return dialect === 'postgresql' ? 'pg' : dialect
}

export async function generateDrizzleSchema(authOptions: BetterAuthOptions, dialect: Dialect, schemaOptions?: SchemaOptions): Promise<string> {
  const provider = dialectToProvider(dialect)

  const options: BetterAuthOptions = {
    ...authOptions,
    advanced: {
      ...authOptions.advanced,
      database: {
        ...authOptions.advanced?.database,
        ...(schemaOptions?.useUuid && { generateId: 'uuid' }),
      },
    },
  }

  const adapter: SchemaGeneratorAdapter = {
    id: 'drizzle',
    options: {
      provider,
      camelCase: schemaOptions?.casing !== 'snake_case',
      adapterConfig: { usePlural: schemaOptions?.usePlural ?? false },
    },
  }

  const result = await _generateDrizzleSchema({ adapter: adapter as unknown as DBAdapter, options })
  if (!result.code) {
    throw new Error(`Schema generation returned empty result for ${dialect}`)
  }
  return result.code
}

// Type for defineServerAuth with reference counting
interface DefineServerAuthFn { (...args: unknown[]): unknown, _count: number }

declare global {
  // eslint-disable-next-line vars-on-top
  var defineServerAuth: DefineServerAuthFn | undefined
}

// Index fields for Convex schema
// Source: @convex-dev/better-auth (https://labs.convex.dev/better-auth)
// Keep in sync with upstream when updating convex-dev/better-auth dependency
const convexIndexFields: Record<string, (string | string[])[]> = {
  account: ['accountId', ['accountId', 'providerId'], ['providerId', 'userId']],
  rateLimit: ['key'],
  session: ['expiresAt', ['expiresAt', 'userId']],
  verification: ['expiresAt', 'identifier'],
  user: [['email', 'name'], 'name', 'userId'],
  passkey: ['credentialID'],
  oauthConsent: [['clientId', 'userId']],
}

function getConvexSpecialFields(tables: BetterAuthDBSchema) {
  return Object.fromEntries(
    Object.entries(tables)
      .map(([key, table]) => {
        const fields = Object.fromEntries(
          Object.entries(table.fields)
            .map(([fieldKey, field]) => [
              field.fieldName ?? fieldKey,
              {
                ...(field.sortable ? { sortable: true } : {}),
                ...(field.unique ? { unique: true } : {}),
                ...(field.references ? { references: field.references } : {}),
              },
            ])
            .filter(([_key, value]) => typeof value === 'object' ? Object.keys(value).length > 0 : true),
        )
        return [key, fields]
      })
      .filter(([_key, value]) => typeof value === 'object' ? Object.keys(value).length > 0 : true),
  )
}

function getMergedConvexIndexFields(tables: BetterAuthDBSchema) {
  return Object.fromEntries(
    Object.entries(tables).map(([key, table]) => {
      const manualIndexes = convexIndexFields[key]?.map((index) => {
        return typeof index === 'string'
          ? (table.fields[index]?.fieldName ?? index)
          : index.map(i => table.fields[i]?.fieldName ?? i)
      }) || []
      const specialFieldsObj = getConvexSpecialFields(tables)
      const specialFieldIndexes = Object.keys(specialFieldsObj[key] || {}).filter(
        index => !manualIndexes.some(m => Array.isArray(m) ? m[0] === index : m === index),
      )
      return [key, manualIndexes.concat(specialFieldIndexes)]
    }),
  )
}

export async function generateConvexSchema(authOptions: BetterAuthOptions): Promise<string> {
  const tables = getAuthTables(authOptions)

  let code = `/**
 * Auto-generated Better Auth tables for Convex.
 * Import these tables in your convex/schema.ts:
 *
 * import { defineSchema } from 'convex/server'
 * import { authTables } from './_generated/auth-tables'
 *
 * export default defineSchema({ ...authTables, ...yourTables })
 */

import { defineTable } from 'convex/server'
import { v } from 'convex/values'

export const authTables = {
`

  const getType = (_name: string, field: DBFieldAttribute): string => {
    const type = field.type as 'string' | 'number' | 'boolean' | 'date' | 'json' | 'string[]' | 'number[]'
    const typeMap: Record<typeof type, string> = {
      'string': 'v.string()',
      'boolean': 'v.boolean()',
      'number': 'v.number()',
      'date': 'v.number()',
      'json': 'v.string()',
      'number[]': 'v.array(v.number())',
      'string[]': 'v.array(v.string())',
    }
    return typeMap[type]
  }

  for (const tableKey in tables) {
    const table = tables[tableKey]!
    const modelName = table.modelName

    // No id fields in Convex schema
    const fields = Object.fromEntries(Object.entries(table.fields).filter(([key]) => key !== 'id'))

    const indexes = getMergedConvexIndexFields(tables)[tableKey]?.map((index) => {
      const indexArray = Array.isArray(index) ? index.sort() : [index]
      const indexName = indexArray.join('_')
      return `.index('${indexName}', ${JSON.stringify(indexArray)})`
    }) || []

    const schema = `${modelName}: defineTable({
${Object.keys(fields)
  .map((field) => {
    const attr = fields[field]!
    const type = getType(field, attr as DBFieldAttribute)
    const optional = (fieldSchema: string) =>
      attr.required ? fieldSchema : `v.optional(v.union(v.null(), ${fieldSchema}))`
    return `    ${attr.fieldName ?? field}: ${optional(type)},`
  })
  .join('\n')}
  })${indexes.length > 0 ? `\n    ${indexes.join('\n    ')}` : ''},\n`
    code += `  ${schema}`
  }

  code += `}
`

  return code
}

export async function loadUserAuthConfig(configPath: string, throwOnError = false): Promise<Partial<BetterAuthOptions>> {
  const { createJiti } = await import('jiti')
  const { defineServerAuth } = await import('./runtime/config')
  const jiti = createJiti(import.meta.url, { interopDefault: true, moduleCache: false })

  if (!globalThis.defineServerAuth) {
    (defineServerAuth as unknown as DefineServerAuthFn)._count = 0
    globalThis.defineServerAuth = defineServerAuth as unknown as DefineServerAuthFn
  }
  globalThis.defineServerAuth._count++

  try {
    const mod = await jiti.import(configPath) as { default?: unknown }
    const configFn = mod.default
    if (typeof configFn === 'function') {
      return configFn({ runtimeConfig: {}, db: null })
    }
    consola.warn('[@onmax/nuxt-better-auth] auth.config.ts does not export default. Expected: export default defineServerAuth(...)')
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
  finally {
    globalThis.defineServerAuth!._count--
    if (!globalThis.defineServerAuth!._count) {
      globalThis.defineServerAuth = undefined
    }
  }
}
