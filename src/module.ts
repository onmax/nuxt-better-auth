import type { NuxtPage } from '@nuxt/schema'
import type { BetterAuthModuleOptions } from './runtime/config'
import type { AuthRouteRules } from './runtime/types'
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { addComponentsDir, addImportsDir, addPlugin, addServerHandler, addServerImportsDir, addServerScanDir, addTemplate, addTypeTemplate, createResolver, defineNuxtModule, extendPages, hasNuxtModule, updateTemplates } from '@nuxt/kit'
import { consola as _consola } from 'consola'
import { defu } from 'defu'
import { join } from 'pathe'
import { createRouter, toRouteMatcher } from 'radix3'
import { setupDevTools } from './devtools'
import { generateDrizzleSchema, loadUserAuthConfig } from './schema-generator'

import './types/hooks'

const consola = _consola.withTag('nuxt-better-auth')

export type { BetterAuthModuleOptions } from './runtime/config'

export default defineNuxtModule<BetterAuthModuleOptions>({
  meta: { name: '@onmax/nuxt-better-auth', configKey: 'auth', compatibility: { nuxt: '>=3.0.0' } },
  defaults: {
    serverConfig: 'server/auth.config',
    clientConfig: 'app/auth.config',
    redirects: { login: '/login', guest: '/' },
    secondaryStorage: false,
  },
  async setup(options, nuxt) {
    const resolver = createResolver(import.meta.url)

    const serverConfigFile = options.serverConfig!
    const clientConfigFile = options.clientConfig!
    const serverConfigPath = resolver.resolve(nuxt.options.rootDir, serverConfigFile)
    const clientConfigPath = resolver.resolve(nuxt.options.rootDir, clientConfigFile)

    const serverConfigExists = existsSync(`${serverConfigPath}.ts`) || existsSync(`${serverConfigPath}.js`)
    const clientConfigExists = existsSync(`${clientConfigPath}.ts`) || existsSync(`${clientConfigPath}.js`)

    if (!serverConfigExists)
      throw new Error(`[nuxt-better-auth] Missing ${serverConfigFile}.ts - create with defineServerAuth()`)
    if (!clientConfigExists)
      throw new Error(`[nuxt-better-auth] Missing ${clientConfigFile}.ts - export createAppAuthClient()`)

    const hasNuxtHub = hasNuxtModule('@nuxthub/core', nuxt)
    const hub = hasNuxtHub ? (nuxt.options as unknown as Record<string, unknown>).hub as { db?: boolean | string | object, kv?: boolean } | undefined : undefined
    const hasHubDb = hasNuxtHub && !!hub?.db

    let secondaryStorageEnabled = options.secondaryStorage ?? false
    if (secondaryStorageEnabled && (!hasNuxtHub || !hub?.kv)) {
      consola.warn('secondaryStorage requires @nuxthub/core with hub.kv: true. Disabling.')
      secondaryStorageEnabled = false
    }

    nuxt.options.runtimeConfig.public = nuxt.options.runtimeConfig.public || {}
    nuxt.options.runtimeConfig.public.auth = defu(nuxt.options.runtimeConfig.public.auth as Record<string, unknown>, {
      redirects: { login: options.redirects?.login ?? '/login', guest: options.redirects?.guest ?? '/' },
      useDatabase: hasHubDb,
    }) as { redirects: { login: string, guest: string }, useDatabase: boolean }

    const betterAuthSecret = process.env.BETTER_AUTH_SECRET || process.env.NUXT_BETTER_AUTH_SECRET || (nuxt.options.runtimeConfig.betterAuthSecret as string) || ''

    if (!nuxt.options.dev && !betterAuthSecret) {
      throw new Error('[nuxt-better-auth] BETTER_AUTH_SECRET is required in production. Set BETTER_AUTH_SECRET or NUXT_BETTER_AUTH_SECRET environment variable.')
    }
    if (betterAuthSecret && betterAuthSecret.length < 32) {
      consola.warn('[nuxt-better-auth] BETTER_AUTH_SECRET should be at least 32 characters for security')
    }

    nuxt.options.runtimeConfig.betterAuthSecret = betterAuthSecret

    nuxt.options.runtimeConfig.auth = defu(nuxt.options.runtimeConfig.auth as Record<string, unknown>, {
      secondaryStorage: secondaryStorageEnabled,
    }) as { secondaryStorage: boolean }

    nuxt.options.alias['#nuxt-better-auth'] = resolver.resolve('./runtime/types/augment')
    nuxt.options.alias['#auth/server'] = serverConfigPath
    nuxt.options.alias['#auth/client'] = clientConfigPath
    const hubKVPath = nuxt.options.alias["hub:kv"];

    // conditional hub:kv
    const secondaryStorageCode = secondaryStorageEnabled && hubKVPath
      ? `import { kv } from '${hubKVPath}'
export function createSecondaryStorage() {
  return {
    get: async (key) => kv.get(\`_auth:\${key}\`),
    set: async (key, value, ttl) => kv.set(\`_auth:\${key}\`, value, { ttl }),
    delete: async (key) => kv.del(\`_auth:\${key}\`),
  }
}`
      : `export function createSecondaryStorage() { return undefined }`

    const secondaryStorageTemplate = addTemplate({ filename: 'better-auth/secondary-storage.mjs', getContents: () => secondaryStorageCode, write: true })
    nuxt.options.alias['#auth/secondary-storage'] = secondaryStorageTemplate.dst

    // conditional hub:db - use resolved path instead of hub:db alias to avoid ESM loader issues
    const hubDbPath = nuxt.options.alias['hub:db'] as string | undefined
    if (hasHubDb && !hubDbPath) {
      throw new Error('[nuxt-better-auth] hub:db alias not found. Ensure @nuxthub/core is loaded before this module.')
    }
    const databaseCode = hasHubDb && hubDbPath
      ? `import { db, schema } from '${hubDbPath}'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
const rawDialect = '${(hub as any)?.db?.dialect ?? 'sqlite'}'
const dialect = rawDialect === 'postgresql' ? 'pg' : rawDialect
export function createDatabase() { return drizzleAdapter(db, { provider: dialect, schema }) }
export { db }`
      : `export function createDatabase() { return undefined }
export const db = undefined`

    const databaseTemplate = addTemplate({ filename: 'better-auth/database.mjs', getContents: () => databaseCode, write: true })
    nuxt.options.alias['#auth/database'] = databaseTemplate.dst

    addTypeTemplate({
      filename: 'types/auth-secondary-storage.d.ts',
      getContents: () => `
declare module '#auth/secondary-storage' {
  interface SecondaryStorage {
    get: (key: string) => Promise<string | null>
    set: (key: string, value: unknown, ttl?: number) => Promise<void>
    delete: (key: string) => Promise<void>
  }
  export function createSecondaryStorage(): SecondaryStorage | undefined
}
`,
    })

    addTypeTemplate({
      filename: 'types/auth-database.d.ts',
      getContents: () => `
declare module '#auth/database' {
  import type { drizzleAdapter } from 'better-auth/adapters/drizzle'
  export function createDatabase(): ReturnType<typeof drizzleAdapter> | undefined
  export const db: unknown
}
`,
    })

    addTypeTemplate({
      filename: 'types/nuxt-better-auth.d.ts',
      getContents: () => `
export * from '${resolver.resolve('./runtime/types/augment')}'
export type { AuthMeta, AuthMode, AuthRouteRules, UserMatch, RequireSessionOptions, Auth, InferUser, InferSession } from '${resolver.resolve('./runtime/types')}'
`,
    })

    addTypeTemplate({
      filename: 'types/nuxt-better-auth-infer.d.ts',
      getContents: () => `
import type { InferUser, InferSession } from 'better-auth'
import type { RuntimeConfig } from 'nuxt/schema'
import type configFn from '${serverConfigPath}'

type _Config = ReturnType<typeof configFn>

declare module '#nuxt-better-auth' {
  interface AuthUser extends InferUser<_Config> {}
  interface AuthSession { session: InferSession<_Config>['session'], user: InferUser<_Config> }
  interface ServerAuthContext {
    runtimeConfig: RuntimeConfig
    ${hasHubDb ? `db: typeof import('hub:db')['db']` : ''}
  }
}
`,
    })

    addTypeTemplate({
      filename: 'types/nuxt-better-auth-client.d.ts',
      getContents: () => `
import type { createAppAuthClient } from '${clientConfigPath}'
declare module '#nuxt-better-auth' {
  export type AppAuthClient = ReturnType<typeof createAppAuthClient>
}
`,
    })

    addTypeTemplate({
      filename: 'types/nuxt-better-auth-nitro.d.ts',
      getContents: () => `
declare module 'nitropack/types' {
  interface NitroRouteRules {
    auth?: import('${resolver.resolve('./runtime/types')}').AuthMeta
  }
}
`,
    })

    // HMR
    nuxt.hook('builder:watch', async (_event, relativePath) => {
      if (relativePath.includes('auth.config')) {
        await updateTemplates({ filter: t => t.filename.includes('nuxt-better-auth') })
      }
    })

    addServerImportsDir(resolver.resolve('./runtime/server/utils'))
    addServerScanDir(resolver.resolve('./runtime/server/middleware'))
    addServerHandler({ route: '/api/auth/**', handler: resolver.resolve('./runtime/server/api/auth/[...all]') })
    addImportsDir(resolver.resolve('./runtime/app/composables'))
    addImportsDir(resolver.resolve('./runtime/utils'))
    addPlugin({ src: resolver.resolve('./runtime/app/plugins/session.server'), mode: 'server' })
    addPlugin({ src: resolver.resolve('./runtime/app/plugins/session.client'), mode: 'client' })
    addComponentsDir({ path: resolver.resolve('./runtime/app/components') })

    nuxt.hook('app:resolve', (app) => {
      app.middleware.push({ name: 'auth', path: resolver.resolve('./runtime/app/middleware/auth.global'), global: true })
    })

    if (hasHubDb) {
      await setupBetterAuthSchema(nuxt, serverConfigPath)
    }

    if (nuxt.options.dev && process.env.NODE_ENV !== 'production') {
      setupDevTools(nuxt)
      addServerHandler({ route: '/api/_better-auth/config', method: 'get', handler: resolver.resolve('./runtime/server/api/_better-auth/config.get') })
      if (hasHubDb) {
        addServerHandler({ route: '/api/_better-auth/sessions', method: 'get', handler: resolver.resolve('./runtime/server/api/_better-auth/sessions.get') })
        addServerHandler({ route: '/api/_better-auth/sessions', method: 'delete', handler: resolver.resolve('./runtime/server/api/_better-auth/sessions.delete') })
        addServerHandler({ route: '/api/_better-auth/users', method: 'get', handler: resolver.resolve('./runtime/server/api/_better-auth/users.get') })
        addServerHandler({ route: '/api/_better-auth/accounts', method: 'get', handler: resolver.resolve('./runtime/server/api/_better-auth/accounts.get') })
      }
      extendPages((pages) => {
        pages.push({ name: 'better-auth-devtools', path: '/__better-auth-devtools', file: resolver.resolve('./runtime/app/pages/__better-auth-devtools.vue') })
      })
    }

    nuxt.hook('pages:extend', (pages) => {
      const routeRules = (nuxt.options.routeRules || {}) as Record<string, AuthRouteRules>
      if (!Object.keys(routeRules).length)
        return

      const matcher = toRouteMatcher(createRouter({ routes: routeRules }))

      const applyMetaFromRules = (page: NuxtPage) => {
        const matches = matcher.matchAll(page.path) as Partial<AuthRouteRules>[]
        if (!matches.length)
          return

        const matchedRules = defu({}, ...matches.reverse()) as AuthRouteRules

        if (matchedRules.auth !== undefined) {
          page.meta = page.meta || {}
          page.meta.auth = matchedRules.auth
        }

        page.children?.forEach(child => applyMetaFromRules(child))
      }

      pages.forEach(page => applyMetaFromRules(page))
    })
  },
})

async function setupBetterAuthSchema(nuxt: any, serverConfigPath: string) {
  const hub = nuxt.options.hub as any
  const dialect = typeof hub.db === 'string' ? hub.db : hub.db?.dialect
  if (!dialect || !['sqlite', 'postgresql', 'mysql'].includes(dialect)) {
    consola.warn(`Unsupported database dialect: ${dialect}`)
    return
  }

  // Generate schema immediately during module setup (before hub:db:schema:extend is called)
  const isProduction = !nuxt.options.dev
  try {
    const configFile = `${serverConfigPath}.ts`
    const userConfig = await loadUserAuthConfig(configFile, isProduction)

    const extendedConfig: { plugins?: any[] } = {}
    await nuxt.callHook('better-auth:config:extend', extendedConfig)

    const plugins = [...(userConfig.plugins || []), ...(extendedConfig.plugins || [])]

    const { getAuthTables } = await import('better-auth/db')
    const tables = getAuthTables({ plugins })

    const schemaCode = generateDrizzleSchema(tables, dialect as 'sqlite' | 'postgresql' | 'mysql')

    const schemaDir = join(nuxt.options.buildDir, 'better-auth')
    const schemaPath = join(schemaDir, `schema.${dialect}.ts`)

    await mkdir(schemaDir, { recursive: true })
    await writeFile(schemaPath, schemaCode)

    addTemplate({ filename: `better-auth/schema.${dialect}.ts`, getContents: () => schemaCode, write: true })

    consola.info(`Generated ${dialect} schema with ${Object.keys(tables).length} tables`)
  }
  catch (error) {
    if (isProduction) {
      throw error
    }
    consola.error('Failed to generate schema:', error)
  }

  nuxt.hook('hub:db:schema:extend', ({ paths, dialect: hookDialect }: { paths: string[], dialect: string }) => {
    const schemaPath = join(nuxt.options.buildDir, 'better-auth', `schema.${hookDialect}.ts`)
    if (existsSync(schemaPath)) {
      paths.push(schemaPath)
    }
  })
}

export { defineClientAuth, defineServerAuth } from './runtime/config'
export type { Auth, AuthMeta, AuthMode, AuthRouteRules, AuthSession, AuthUser, InferSession, InferUser, RequireSessionOptions, ServerAuthContext, UserMatch } from './runtime/types'
