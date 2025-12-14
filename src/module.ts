import type { NuxtPage } from '@nuxt/schema'
import type { BetterAuthModuleOptions } from './runtime/config'
import type { AuthRouteRules } from './runtime/types'
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { addComponentsDir, addImportsDir, addPlugin, addServerHandler, addServerImportsDir, addServerScanDir, addTemplate, addTypeTemplate, createResolver, defineNuxtModule, updateTemplates } from '@nuxt/kit'
import { defu } from 'defu'
import { join } from 'pathe'
import { createRouter, toRouteMatcher } from 'radix3'
import { generateDrizzleSchema, loadUserAuthConfig } from './schema-generator'

export type { BetterAuthModuleOptions } from './runtime/config'

export default defineNuxtModule<BetterAuthModuleOptions>({
  meta: { name: '@onmax/nuxt-better-auth', configKey: 'auth', compatibility: { nuxt: '>=3.0.0' } },
  defaults: { redirects: { login: '/login', guest: '/' }, secondaryStorage: false },
  async setup(options, nuxt) {
    const resolver = createResolver(import.meta.url)

    // Validate user config files exist
    const serverConfigPath = resolver.resolve(nuxt.options.rootDir, 'server/auth.config')
    const clientConfigPath = resolver.resolve(nuxt.options.rootDir, 'app/auth.client')

    const serverConfigExists = existsSync(`${serverConfigPath}.ts`) || existsSync(`${serverConfigPath}.js`)
    const clientConfigExists = existsSync(`${clientConfigPath}.ts`) || existsSync(`${clientConfigPath}.js`)

    if (!serverConfigExists)
      throw new Error('[@onmax/nuxt-better-auth] Missing server/auth.config.ts - create with defineServerAuth()')
    if (!clientConfigExists)
      throw new Error('[@onmax/nuxt-better-auth] Missing app/auth.client.ts - export createAppAuthClient()')

    // Detect NuxtHub config
    const hub = (nuxt.options as unknown as Record<string, unknown>).hub as { db?: boolean | string | object, kv?: boolean } | undefined
    const hasDb = !!hub?.db

    // Validate KV is enabled if secondaryStorage requested
    let secondaryStorageEnabled = options.secondaryStorage ?? false
    if (secondaryStorageEnabled && !hub?.kv) {
      console.warn('[nuxt-better-auth] secondaryStorage requires hub.kv: true in nuxt.config.ts. Disabling.')
      secondaryStorageEnabled = false
    }

    // Expose module options to runtime config
    nuxt.options.runtimeConfig.public = nuxt.options.runtimeConfig.public || {}
    nuxt.options.runtimeConfig.public.auth = defu(nuxt.options.runtimeConfig.public.auth as Record<string, unknown>, {
      redirects: {
        login: options.redirects?.login ?? '/login',
        guest: options.redirects?.guest ?? '/',
      },
    })

    // Private runtime config (server-only)
    nuxt.options.runtimeConfig.auth = defu(nuxt.options.runtimeConfig.auth as Record<string, unknown>, {
      secondaryStorage: secondaryStorageEnabled,
      useDatabase: hasDb,
    })

    // Register #nuxt-better-auth alias for type augmentation
    nuxt.options.alias['#nuxt-better-auth'] = resolver.resolve('./runtime/types/augment')

    // Register aliases for user config files
    nuxt.options.alias['#auth/server'] = serverConfigPath
    nuxt.options.alias['#auth/client'] = clientConfigPath

    // Generate secondary storage virtual module (conditional hub:kv)
    const secondaryStorageCode = secondaryStorageEnabled
      ? `import { kv } from 'hub:kv'
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

    // Add type template for #nuxt-better-auth module augmentation
    addTypeTemplate({
      filename: 'types/nuxt-better-auth.d.ts',
      getContents: () => `
// Type augmentation support
export * from '${resolver.resolve('./runtime/types/augment')}'
export type { AuthMeta, AuthMode, AuthRouteRules, UserMatch, RequireSessionOptions } from '${resolver.resolve('./runtime/types')}'
`,
    })

    // Add type template that infers types from user's auth.config.ts
    addTypeTemplate({
      filename: 'types/nuxt-better-auth-infer.d.ts',
      getContents: () => `
// Auto-generated types from auth.config.ts
import type { InferUser, InferSession } from 'better-auth'
import type configFn from '${serverConfigPath}'

type _Config = ReturnType<typeof configFn>

declare module '#nuxt-better-auth' {
  interface AuthUser extends InferUser<_Config> {}
  interface AuthSession { session: InferSession<_Config>['session'], user: InferUser<_Config> }
}
`,
    })

    // Add separate type template for nitropack augmentation (must be ambient, no exports)
    addTypeTemplate({
      filename: 'types/nuxt-better-auth-nitro.d.ts',
      getContents: () => `
// Extend NitroRouteRules with auth options
declare module 'nitropack/types' {
  interface NitroRouteRules {
    auth?: import('${resolver.resolve('./runtime/types')}').AuthMeta
  }
}
`,
    })

    // HMR: Watch auth.config.ts for changes and regenerate types
    nuxt.hook('builder:watch', async (_event, relativePath) => {
      if (relativePath.includes('auth.config')) {
        await updateTemplates({ filter: t => t.filename.includes('nuxt-better-auth') })
      }
    })

    // Auto-import server utils (serverAuth, getUserSession, requireUserSession)
    addServerImportsDir(resolver.resolve('./runtime/server/utils'))

    // Register server middleware
    addServerScanDir(resolver.resolve('./runtime/server/middleware'))

    // Register auth API handler
    addServerHandler({ route: '/api/auth/**', handler: resolver.resolve('./runtime/server/api/auth/[...all]') })

    // Auto-import client composables
    addImportsDir(resolver.resolve('./runtime/app/composables'))

    // Register session plugins
    addPlugin({ src: resolver.resolve('./runtime/app/plugins/session.server'), mode: 'server' })
    addPlugin({ src: resolver.resolve('./runtime/app/plugins/session.client'), mode: 'client' })

    // Register auth components
    addComponentsDir({ path: resolver.resolve('./runtime/app/components') })

    // Register client middleware
    nuxt.hook('app:resolve', (app) => {
      app.middleware.push({ name: 'auth', path: resolver.resolve('./runtime/app/middleware/auth.global'), global: true })
    })

    // Auto-generate better-auth schema and extend NuxtHub db schema (only if db configured)
    if (hasDb) {
      await setupBetterAuthSchema(nuxt, serverConfigPath)
    }

    // Sync routeRules to page meta
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
    console.warn(`[nuxt-better-auth] Unsupported database dialect: ${dialect}`)
    return
  }

  // Generate schema after modules are done (ensures NuxtHub is set up)
  nuxt.hook('modules:done', async () => {
    try {
      // Load user's auth config to get plugins
      const configFile = `${serverConfigPath}.ts`
      const userConfig = await loadUserAuthConfig(configFile)
      const plugins = userConfig.plugins || []

      // Get schema tables from better-auth
      const { getAuthTables } = await import('better-auth/db')
      const tables = getAuthTables({ plugins })

      // Generate Drizzle schema code
      const schemaCode = generateDrizzleSchema(tables, dialect as 'sqlite' | 'postgresql' | 'mysql')

      // Write schema to build directory
      const schemaDir = join(nuxt.options.buildDir, 'better-auth')
      const schemaPath = join(schemaDir, `schema.${dialect}.ts`)

      await mkdir(schemaDir, { recursive: true })
      await writeFile(schemaPath, schemaCode)

      // Also create a template so it's properly tracked
      addTemplate({
        filename: `better-auth/schema.${dialect}.ts`,
        getContents: () => schemaCode,
        write: true,
      })

      console.warn(`[nuxt-better-auth] Generated ${dialect} schema with ${Object.keys(tables).length} tables`)
    }
    catch (error) {
      console.error('[nuxt-better-auth] Failed to generate schema:', error)
    }
  })

  // Extend NuxtHub schema with our generated schema
  nuxt.hook('hub:db:schema:extend', ({ paths, dialect: hookDialect }: { paths: string[], dialect: string }) => {
    const schemaPath = join(nuxt.options.buildDir, 'better-auth', `schema.${hookDialect}.ts`)
    if (existsSync(schemaPath)) {
      paths.push(schemaPath)
    }
  })
}

// Re-export config helpers
export { defineClientAuth, defineServerAuth } from './runtime/config'
export type { AuthMeta, AuthMode, AuthRouteRules, AuthSession, AuthUser, RequireSessionOptions, UserMatch } from './runtime/types'
