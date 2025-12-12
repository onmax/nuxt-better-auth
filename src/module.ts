import type { NuxtPage } from '@nuxt/schema'
import type { AuthRouteRules } from './runtime/types'
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { addComponentsDir, addImportsDir, addPlugin, addServerHandler, addServerImportsDir, addServerScanDir, addTemplate, addTypeTemplate, createResolver, defineNuxtModule } from '@nuxt/kit'
import { defu } from 'defu'
import { join } from 'pathe'
import { createRouter, toRouteMatcher } from 'radix3'
import { generateDrizzleSchema, loadUserAuthConfig } from './schema-generator'

export interface BetterAuthModuleOptions {}

export default defineNuxtModule<BetterAuthModuleOptions>({
  meta: { name: '@onmax/nuxt-better-auth', configKey: 'auth', compatibility: { nuxt: '>=3.0.0' } },
  defaults: {},
  async setup(_options, nuxt) {
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

    // Register #nuxt-better-auth alias for type augmentation
    nuxt.options.alias['#nuxt-better-auth'] = resolver.resolve('./runtime/types/augment')

    // Register aliases for user config files
    nuxt.options.alias['#auth/server'] = serverConfigPath
    nuxt.options.alias['#auth/client'] = clientConfigPath

    // Add type template for #nuxt-better-auth module augmentation
    addTypeTemplate({
      filename: 'types/nuxt-better-auth.d.ts',
      getContents: () => `
// Type augmentation support
export * from '${resolver.resolve('./runtime/types/augment')}'
export type { AuthMeta, AuthMode, AuthRouteRules, RoleName } from '${resolver.resolve('./runtime/types')}'
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
    role?: import('${resolver.resolve('./runtime/types')}').RoleName | import('${resolver.resolve('./runtime/types')}').RoleName[]
  }
}
`,
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

    // Auto-generate better-auth schema and extend NuxtHub db schema
    await setupBetterAuthSchema(nuxt, serverConfigPath)

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

        if (matchedRules.auth !== undefined || matchedRules.role) {
          page.meta = page.meta || {}
          if (matchedRules.auth !== undefined)
            page.meta.auth = matchedRules.auth
          if (matchedRules.role)
            page.meta.role = matchedRules.role
        }

        page.children?.forEach(child => applyMetaFromRules(child))
      }

      pages.forEach(page => applyMetaFromRules(page))
    })
  },
})

async function setupBetterAuthSchema(nuxt: any, serverConfigPath: string) {
  // Check if NuxtHub db is enabled
  const hub = nuxt.options.hub as any
  if (!hub?.db) {
    console.warn('[nuxt-better-auth] NuxtHub database not configured. Set hub.db in nuxt.config.ts')
    return
  }

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
export type { AuthMeta, AuthMode, AuthRouteRules, AuthSession, AuthUser, RoleName } from './runtime/types'
