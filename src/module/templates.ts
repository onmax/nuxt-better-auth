import type { Nuxt } from '@nuxt/schema'
import type { DatabaseProvider } from '../database-provider'
import type { DbDialect } from './hub'
import { defu } from 'defu'

export function buildSecondaryStorageCode(enabled: boolean): string {
  if (!enabled)
    return 'export function createSecondaryStorage() { return undefined }'

  return `import { kv } from '@nuxthub/kv'
export function createSecondaryStorage() {
  return {
    get: async (key) => kv.get(\`_auth:\${key}\`),
    set: async (key, value, ttl) => kv.set(\`_auth:\${key}\`, value, { ttl }),
    delete: async (key) => kv.del(\`_auth:\${key}\`),
  }
}`
}

interface BuildDatabaseCodeInput {
  provider: DatabaseProvider
  hubDialect: DbDialect
  usePlural: boolean
  camelCase: boolean
}

export function buildDatabaseCode(input: BuildDatabaseCodeInput): string {
  if (input.provider === 'nuxthub') {
    return `import { db, schema } from '@nuxthub/db'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
const rawDialect = '${input.hubDialect}'
const dialect = rawDialect === 'postgresql' ? 'pg' : rawDialect
export function createDatabase() { return drizzleAdapter(db, { provider: dialect, schema, usePlural: ${input.usePlural}, camelCase: ${input.camelCase} }) }
export { db }`
  }

  if (input.provider === 'convex') {
    return `import { useRuntimeConfig } from '#imports'
import { createConvexHttpAdapter } from '@onmax/nuxt-better-auth/adapters/convex'
import { api } from '#convex/api'

export function createDatabase() {
  const config = useRuntimeConfig()
  const convexUrl = config.betterAuth?.convexUrl || config.public?.convex?.url
  if (!convexUrl) throw new Error('[nuxt-better-auth] CONVEX_URL not configured')
  return createConvexHttpAdapter({ url: convexUrl, api: api.auth })
}
export const db = undefined`
  }

  return `export function createDatabase() { return undefined }
export const db = undefined`
}

export function applyConvexRuntimeConfig(nuxt: Nuxt, convexUrl: string): void {
  nuxt.options.runtimeConfig.betterAuth = defu(
    nuxt.options.runtimeConfig.betterAuth as Record<string, unknown> || {},
    { convexUrl },
  )
}
