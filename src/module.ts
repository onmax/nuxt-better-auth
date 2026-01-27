import type { Nuxt, NuxtPage } from '@nuxt/schema'
import type { BetterAuthPlugin } from 'better-auth'
import type { BetterAuthModuleOptions } from './runtime/config'
import type { AuthRouteRules } from './runtime/types'
import type { CasingOption } from './schema-generator'
import type { ClientExtendConfig } from './types/hooks'
import { randomBytes } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { addComponentsDir, addImportsDir, addPlugin, addServerHandler, addServerImports, addServerImportsDir, addServerScanDir, addTemplate, addTypeTemplate, createResolver, defineNuxtModule, extendPages, hasNuxtModule, installModule, updateTemplates } from '@nuxt/kit'
import { consola as _consola } from 'consola'
import { defu } from 'defu'
import { dirname, join } from 'pathe'
import { createRouter, toRouteMatcher } from 'radix3'
import { isCI, isTest } from 'std-env'
import { version } from '../package.json'
import { setupDevTools } from './devtools'
import { generateConvexSchema, generateDrizzleSchema, loadUserAuthConfig } from './schema-generator'

import './types/hooks'

// NuxtHub module options type
type DbDialect = 'sqlite' | 'postgresql' | 'mysql'
interface NuxtHubOptions {
  db?: boolean | DbDialect | { dialect?: DbDialect, casing?: CasingOption }
  kv?: boolean
}

function getHubDialect(hub?: NuxtHubOptions): DbDialect | undefined {
  if (!hub?.db)
    return undefined
  if (typeof hub.db === 'string')
    return hub.db
  if (typeof hub.db === 'object' && hub.db !== null)
    return hub.db.dialect
  return undefined
}

function getHubCasing(hub?: NuxtHubOptions): CasingOption | undefined {
  if (!hub?.db || typeof hub.db !== 'object' || hub.db === null)
    return undefined
  return hub.db.casing
}

const consola = _consola.withTag('nuxt-better-auth')

function resolveConvexUrl(nuxt: Nuxt): string {
  // 1. From nuxt-convex module config
  const convexConfig = (nuxt.options as { convex?: { url?: string } }).convex
  if (convexConfig?.url)
    return convexConfig.url

  // 2. From runtimeConfig (set by nuxt-convex or user)
  const runtimeUrl = (nuxt.options.runtimeConfig.public as { convex?: { url?: string } })?.convex?.url
  if (runtimeUrl)
    return runtimeUrl

  // 3. Standard Convex env var
  if (process.env.CONVEX_URL)
    return process.env.CONVEX_URL

  // 4. Nuxt-mapped env var
  if (process.env.NUXT_PUBLIC_CONVEX_URL)
    return process.env.NUXT_PUBLIC_CONVEX_URL

  return ''
}

const generateSecret = () => randomBytes(32).toString('hex')

function readEnvFile(rootDir: string): string {
  const envPath = join(rootDir, '.env')
  return existsSync(envPath) ? readFileSync(envPath, 'utf-8') : ''
}

function hasEnvSecret(rootDir: string): boolean {
  const match = readEnvFile(rootDir).match(/^BETTER_AUTH_SECRET=(.+)$/m)
  return !!match && !!match[1] && match[1].trim().length > 0
}

function appendSecretToEnv(rootDir: string, secret: string): void {
  const envPath = join(rootDir, '.env')
  let content = readEnvFile(rootDir)
  if (content.length > 0 && !content.endsWith('\n'))
    content += '\n'
  content += `BETTER_AUTH_SECRET=${secret}\n`
  writeFileSync(envPath, content, 'utf-8')
}

async function promptForSecret(rootDir: string): Promise<string | undefined> {
  if (process.env.BETTER_AUTH_SECRET || hasEnvSecret(rootDir))
    return undefined

  // Only auto-generate in CI or test - otherwise always prompt
  if (isCI || isTest) {
    const secret = generateSecret()
    appendSecretToEnv(rootDir, secret)
    consola.info('Generated BETTER_AUTH_SECRET and added to .env (CI mode)')
    return secret
  }

  // Interactive prompt
  consola.box('BETTER_AUTH_SECRET is required for authentication.\nThis will be appended to your .env file.')
  const choice = await consola.prompt('How do you want to set it?', {
    type: 'select',
    options: [
      { label: 'Generate for me', value: 'generate', hint: 'uses crypto.randomBytes(32)' },
      { label: 'Enter manually', value: 'paste' },
      { label: 'Skip', value: 'skip', hint: 'will fail in production' },
    ],
    cancel: 'null',
  }) as 'generate' | 'paste' | 'skip' | symbol

  if (typeof choice === 'symbol' || choice === 'skip') {
    consola.warn('Skipping BETTER_AUTH_SECRET. Auth will fail without it in production.')
    return undefined
  }

  let secret: string
  if (choice === 'generate') {
    secret = generateSecret()
  }
  else {
    const input = await consola.prompt('Paste your secret (min 32 chars):', { type: 'text', cancel: 'null' }) as string | symbol
    if (typeof input === 'symbol' || !input || input.length < 32) {
      consola.warn('Invalid secret. Skipping.')
      return undefined
    }
    secret = input
  }

  // Preview
  const preview = `${secret.slice(0, 8)}...${secret.slice(-4)}`
  const confirm = await consola.prompt(`Add to .env:\nBETTER_AUTH_SECRET=${preview}\nProceed?`, { type: 'confirm', initial: true, cancel: 'null' }) as boolean | symbol
  if (typeof confirm === 'symbol' || !confirm) {
    consola.info('Cancelled. Secret not written.')
    return undefined
  }

  appendSecretToEnv(rootDir, secret)
  consola.success('Added BETTER_AUTH_SECRET to .env')
  return secret
}

export type { BetterAuthModuleOptions } from './runtime/config'

export default defineNuxtModule<BetterAuthModuleOptions>({
  meta: { name: 'better-auth-nuxt', version, configKey: 'auth', compatibility: { nuxt: '>=3.0.0' } },
  defaults: {
    clientOnly: false,
    serverConfig: 'server/auth.config',
    clientConfig: 'app/auth.config',
    redirects: { login: '/login', guest: '/' },
    secondaryStorage: false,
  },
  async onInstall(nuxt) {
    // Prompt for BETTER_AUTH_SECRET if missing
    const generatedSecret = await promptForSecret(nuxt.options.rootDir)
    if (generatedSecret)
      process.env.BETTER_AUTH_SECRET = generatedSecret

    const serverPath = join(nuxt.options.rootDir, 'server/auth.config.ts')
    const clientPath = join(nuxt.options.srcDir, 'auth.config.ts')

    const serverTemplate = `import { defineServerAuth } from 'better-auth-nuxt/config'

export default defineServerAuth({
  emailAndPassword: { enabled: true },
})
`

    const clientTemplate = `import { defineClientAuth } from 'better-auth-nuxt/config'

export default defineClientAuth({})
`

    if (!existsSync(serverPath)) {
      await mkdir(dirname(serverPath), { recursive: true })
      await writeFile(serverPath, serverTemplate)
      consola.success('Created server/auth.config.ts')
    }

    if (!existsSync(clientPath)) {
      await mkdir(dirname(clientPath), { recursive: true })
      await writeFile(clientPath, clientTemplate)
      const relativePath = clientPath.replace(`${nuxt.options.rootDir}/`, '')
      consola.success(`Created ${relativePath}`)
    }
  },
  async setup(options, nuxt) {
    const resolver = createResolver(import.meta.url)

    // Auto-detect clientConfig path based on srcDir
    if (options.clientConfig === 'app/auth.config') {
      const srcDirRelative = nuxt.options.srcDir.replace(`${nuxt.options.rootDir}/`, '')
      options.clientConfig = srcDirRelative === nuxt.options.srcDir
        ? 'auth.config' // srcDir is rootDir
        : `${srcDirRelative}/auth.config`
    }

    const clientOnly = options.clientOnly!

    const serverConfigFile = options.serverConfig!
    const clientConfigFile = options.clientConfig!
    const serverConfigPath = resolver.resolve(nuxt.options.rootDir, serverConfigFile)
    const clientConfigPath = resolver.resolve(nuxt.options.rootDir, clientConfigFile)

    const serverConfigExists = existsSync(`${serverConfigPath}.ts`) || existsSync(`${serverConfigPath}.js`)
    const clientConfigExists = existsSync(`${clientConfigPath}.ts`) || existsSync(`${clientConfigPath}.js`)

    if (!clientOnly && !serverConfigExists)
      throw new Error(`[nuxt-better-auth] Missing ${serverConfigFile}.ts - export default defineServerAuth(...)`)
    if (!clientConfigExists)
      throw new Error(`[nuxt-better-auth] Missing ${clientConfigFile}.ts - export default defineClientAuth(...)`)

    const hasNuxtHub = hasNuxtModule('@nuxthub/core', nuxt)
    const hub = hasNuxtHub ? (nuxt.options as { hub?: NuxtHubOptions }).hub : undefined
    const hasHubDb = !clientOnly && hasNuxtHub && !!hub?.db

    // Convex detection
    const hasConvex = hasNuxtModule('nuxt-convex', nuxt)
    const convexUrl = resolveConvexUrl(nuxt)
    const hasConvexDb = !clientOnly && hasConvex && !!convexUrl && !hasHubDb

    if (hasConvexDb) {
      consola.info('Detected Convex - using Convex HTTP adapter for Better Auth database')
    }

    let secondaryStorageEnabled = options.secondaryStorage ?? false
    if (secondaryStorageEnabled && clientOnly) {
      consola.warn('secondaryStorage is not available in clientOnly mode. Disabling.')
      secondaryStorageEnabled = false
    }
    else if (secondaryStorageEnabled && (!hasNuxtHub || !hub?.kv)) {
      consola.warn('secondaryStorage requires @nuxthub/core with hub.kv: true. Disabling.')
      secondaryStorageEnabled = false
    }

    nuxt.options.runtimeConfig.public = nuxt.options.runtimeConfig.public || {}
    nuxt.options.runtimeConfig.public.auth = defu(nuxt.options.runtimeConfig.public.auth as Record<string, unknown>, {
      redirects: { login: options.redirects?.login ?? '/login', guest: options.redirects?.guest ?? '/' },
      useDatabase: hasHubDb || hasConvexDb,
      clientOnly,
    }) as { redirects: { login: string, guest: string }, useDatabase: boolean, clientOnly: boolean }

    // Client-only mode: warn about limitations
    if (clientOnly) {
      const siteUrl = process.env.NUXT_PUBLIC_SITE_URL || (nuxt.options.runtimeConfig.public.siteUrl as string)
      if (!siteUrl) {
        consola.warn('clientOnly mode: NUXT_PUBLIC_SITE_URL should be set to your frontend URL')
      }
      consola.info('clientOnly mode enabled - server utilities (serverAuth, getUserSession, requireUserSession) are not available')
    }

    // Server-only: secret validation
    if (!clientOnly) {
      // Map BETTER_AUTH_SECRET to runtimeConfig for runtime support
      // Priority: runtimeConfig (nuxt.config or NUXT_BETTER_AUTH_SECRET) > BETTER_AUTH_SECRET
      const currentSecret = nuxt.options.runtimeConfig.betterAuthSecret as string | undefined
      nuxt.options.runtimeConfig.betterAuthSecret = currentSecret || process.env.BETTER_AUTH_SECRET || ''

      const betterAuthSecret = nuxt.options.runtimeConfig.betterAuthSecret as string

      if (!nuxt.options.dev && !nuxt.options._prepare && !betterAuthSecret) {
        throw new Error('[nuxt-better-auth] BETTER_AUTH_SECRET is required in production. Set BETTER_AUTH_SECRET or NUXT_BETTER_AUTH_SECRET environment variable.')
      }
      if (betterAuthSecret && betterAuthSecret.length < 32) {
        throw new Error('[nuxt-better-auth] BETTER_AUTH_SECRET must be at least 32 characters for security')
      }

      nuxt.options.runtimeConfig.auth = defu(nuxt.options.runtimeConfig.auth as Record<string, unknown>, {
        secondaryStorage: secondaryStorageEnabled,
      }) as { secondaryStorage: boolean }
    }

    nuxt.options.alias['#nuxt-better-auth'] = resolver.resolve('./runtime/types/augment')
    if (!clientOnly)
      nuxt.options.alias['#auth/server'] = serverConfigPath
    nuxt.options.alias['#auth/client'] = clientConfigPath

    // Server-only: secondary storage and database templates
    if (!clientOnly) {
      // Validate hub:kv alias exists when secondaryStorage is enabled
      if (secondaryStorageEnabled && !nuxt.options.alias['hub:kv']) {
        throw new Error('[nuxt-better-auth] hub:kv not found. Ensure @nuxthub/core is loaded before this module and hub.kv is enabled.')
      }

      const secondaryStorageCode = secondaryStorageEnabled
        ? `import { kv } from '@nuxthub/kv'
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

      // Validate hub:db alias exists when using NuxtHub database
      if (hasHubDb && !nuxt.options.alias['hub:db']) {
        throw new Error('[nuxt-better-auth] hub:db not found. Ensure @nuxthub/core is loaded before this module and hub.db is configured.')
      }

      const hubDialect = getHubDialect(hub) ?? 'sqlite'
      const usePlural = options.schema?.usePlural ?? false
      const camelCase = (options.schema?.casing ?? getHubCasing(hub)) !== 'snake_case'

      // Generate database code based on detected backend
      let databaseCode: string
      if (hasHubDb) {
        databaseCode = `import { db, schema } from '@nuxthub/db'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
const rawDialect = '${hubDialect}'
const dialect = rawDialect === 'postgresql' ? 'pg' : rawDialect
export function createDatabase() { return drizzleAdapter(db, { provider: dialect, schema, usePlural: ${usePlural}, camelCase: ${camelCase} }) }
export { db }`
      }
      else if (hasConvexDb) {
        // Store Convex URL in runtimeConfig for runtime access
        nuxt.options.runtimeConfig.betterAuth = defu(
          nuxt.options.runtimeConfig.betterAuth as Record<string, unknown> || {},
          { convexUrl },
        )
        databaseCode = `import { useRuntimeConfig } from '#imports'
import { createConvexHttpAdapter } from 'better-auth-nuxt/adapters/convex'
import { api } from '#convex/api'

export function createDatabase() {
  const config = useRuntimeConfig()
  const convexUrl = config.betterAuth?.convexUrl || config.public?.convex?.url
  if (!convexUrl) throw new Error('[nuxt-better-auth] CONVEX_URL not configured')
  return createConvexHttpAdapter({ url: convexUrl, api: api.auth })
}
export const db = undefined`
      }
      else {
        databaseCode = `export function createDatabase() { return undefined }
export const db = undefined`
      }

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
      }, { nitro: true, node: true })

      addTypeTemplate({
        filename: 'types/auth-database.d.ts',
        getContents: () => `
declare module '#auth/database' {
  import type { drizzleAdapter } from 'better-auth/adapters/drizzle'
  export function createDatabase(): ReturnType<typeof drizzleAdapter> | undefined
  export const db: unknown
}
`,
      }, { nitro: true, node: true })

      addTypeTemplate({
        filename: 'types/nuxt-better-auth-infer.d.ts',
        getContents: () => `
import type { InferUser, InferSession, InferPluginTypes } from 'better-auth'
import type { RuntimeConfig } from 'nuxt/schema'
import type createServerAuth from '${serverConfigPath}'

type _Config = ReturnType<typeof createServerAuth>

declare module '#nuxt-better-auth' {
  interface AuthUser extends InferUser<_Config> {}
  interface AuthSession extends InferSession<_Config> {}
  interface ServerAuthContext {
    runtimeConfig: RuntimeConfig
    ${hasHubDb ? `db: typeof import('@nuxthub/db')['db']` : ''}
  }
  type PluginTypes = InferPluginTypes<_Config>
}

// Augment the config module to use the extended ServerAuthContext
interface _AugmentedServerAuthContext {
  runtimeConfig: RuntimeConfig
  ${hasHubDb ? `db: typeof import('@nuxthub/db')['db']` : 'db: unknown'}
}

declare module 'better-auth-nuxt/config' {
  import type { BetterAuthOptions } from 'better-auth'
  type ServerAuthConfig = Omit<BetterAuthOptions, 'database' | 'secret' | 'baseURL'>
  export function defineServerAuth<T extends ServerAuthConfig>(config: T | ((ctx: _AugmentedServerAuthContext) => T)): (ctx: _AugmentedServerAuthContext) => T
}
`,
      }, { nuxt: true, nitro: true, node: true })

      addTypeTemplate({
        filename: 'types/nuxt-better-auth-nitro.d.ts',
        getContents: () => `
declare module 'nitro' {
  interface NitroRouteRules {
    auth?: import('${resolver.resolve('./runtime/types')}').AuthMeta
  }
  interface NitroRouteConfig {
    auth?: import('${resolver.resolve('./runtime/types')}').AuthMeta
  }
}
declare module 'nitro/types' {
  interface NitroRouteRules {
    auth?: import('${resolver.resolve('./runtime/types')}').AuthMeta
  }
  interface NitroRouteConfig {
    auth?: import('${resolver.resolve('./runtime/types')}').AuthMeta
  }
}
export {}
`,
      }, { nuxt: true, nitro: true, node: true })
    }

    addTypeTemplate({
      filename: 'types/nuxt-better-auth.d.ts',
      getContents: () => `
export * from '${resolver.resolve('./runtime/types/augment')}'
export type { AuthMeta, AuthMode, AuthRouteRules, UserMatch, RequireSessionOptions, Auth, InferUser, InferSession } from '${resolver.resolve('./runtime/types')}'
`,
    })

    addTypeTemplate({
      filename: 'types/nuxt-better-auth-client.d.ts',
      getContents: () => `
import type createAppAuthClient from '${clientConfigPath}'
declare module '#nuxt-better-auth' {
  export type AppAuthClient = ReturnType<typeof createAppAuthClient>
}
`,
    })

    // Client config extension via hook
    const extendedClientConfig: ClientExtendConfig = {}
    await nuxt.callHook('better-auth:client:extend', extendedClientConfig)

    const hasClientExtensions = extendedClientConfig.plugins && extendedClientConfig.plugins.length > 0

    if (hasClientExtensions) {
      // Generate import statements for each plugin
      const pluginImports = extendedClientConfig.plugins!.map((plugin, index) => {
        const importName = plugin.name || `plugin${index}`
        return plugin.name
          ? `import { ${plugin.name} as ${importName} } from '${plugin.from}'`
          : `import ${importName} from '${plugin.from}'`
      }).join('\n')

      const pluginNames = extendedClientConfig.plugins!.map((plugin, index) => {
        return plugin.name || `plugin${index}`
      }).join(', ')

      // Generate a wrapper that merges user config with extended plugins
      const clientExtensionsCode = `
import createUserAuthClient from '${clientConfigPath}'
import { createAuthClient } from 'better-auth/vue'
${pluginImports}

// Extended plugins from better-auth:client:extend hook
const extendedPlugins = [${pluginNames}]

export default function createAppAuthClient(baseURL) {
  const ctx = { siteUrl: baseURL }
  const userConfig = typeof createUserAuthClient === 'function'
    ? (() => {
        // Call the user's defineClientAuth result to get the client
        const result = createUserAuthClient(baseURL)
        // If it returns a client directly, we need to recreate with merged plugins
        return result
      })()
    : createUserAuthClient

  // Merge extended plugins with user plugins
  return createAuthClient({
    baseURL,
    ...userConfig,
    plugins: [...extendedPlugins, ...(userConfig.plugins || [])],
  })
}
`
      const clientExtTemplate = addTemplate({
        filename: 'better-auth/client-extended.mjs',
        getContents: () => clientExtensionsCode,
        write: true,
      })
      nuxt.options.alias['#auth/client'] = clientExtTemplate.dst
      consola.info('Client config extended via better-auth:client:extend hook')
    }

    // HMR
    nuxt.hook('builder:watch', async (_event, relativePath) => {
      if (relativePath.includes('auth.config')) {
        await updateTemplates({ filter: t => t.filename.includes('nuxt-better-auth') })
      }
    })

    // Server-only handlers and imports
    if (!clientOnly) {
      addServerImportsDir(resolver.resolve('./runtime/server/utils'))
      addServerImports([{ name: 'defineServerAuth', from: resolver.resolve('./runtime/config') }])
      addServerScanDir(resolver.resolve('./runtime/server/middleware'))
      addServerHandler({ route: '/api/auth/**', handler: resolver.resolve('./runtime/server/api/auth/[...all]') })
    }

    addImportsDir(resolver.resolve('./runtime/app/composables'))
    addImportsDir(resolver.resolve('./runtime/utils'))
    if (!clientOnly)
      addPlugin({ src: resolver.resolve('./runtime/app/plugins/session.server'), mode: 'server' })
    addPlugin({ src: resolver.resolve('./runtime/app/plugins/session.client'), mode: 'client' })
    addComponentsDir({ path: resolver.resolve('./runtime/app/components') })

    nuxt.hook('app:resolve', (app) => {
      app.middleware.push({ name: 'auth', path: resolver.resolve('./runtime/app/middleware/auth.global'), global: true })
    })

    if (hasHubDb) {
      await setupBetterAuthSchema(nuxt, serverConfigPath, options)
    }

    if (hasConvexDb) {
      await setupConvexAuthSchema(nuxt, serverConfigPath)
    }

    // Only enable devtools in development - explicit production check
    const isProduction = process.env.NODE_ENV === 'production' || !nuxt.options.dev
    if (!isProduction && !clientOnly) {
      // Devtools UI requires Nuxt UI components (UTable, UTabs, etc.)
      // if (!hasNuxtModule('@nuxt/ui'))
      //   await installModule('@nuxt/ui')
      // setupDevTools(nuxt)
      addServerHandler({ route: '/api/_better-auth/config', method: 'GET', handler: resolver.resolve('./runtime/server/api/_better-auth/config.get') })
      if (hasHubDb) {
        addServerHandler({ route: '/api/_better-auth/sessions', method: 'GET', handler: resolver.resolve('./runtime/server/api/_better-auth/sessions.get') })
        addServerHandler({ route: '/api/_better-auth/sessions', method: 'DELETE', handler: resolver.resolve('./runtime/server/api/_better-auth/sessions.delete') })
        addServerHandler({ route: '/api/_better-auth/users', method: 'GET', handler: resolver.resolve('./runtime/server/api/_better-auth/users.get') })
        addServerHandler({ route: '/api/_better-auth/accounts', method: 'GET', handler: resolver.resolve('./runtime/server/api/_better-auth/accounts.get') })
      }
      // extendPages((pages) => {
      //   pages.push({ name: 'better-auth-devtools', path: '/__better-auth-devtools', file: resolver.resolve('./runtime/app/pages/__better-auth-devtools.vue') })
      // })
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

async function setupBetterAuthSchema(nuxt: Nuxt, serverConfigPath: string, options: BetterAuthModuleOptions) {
  const hub = (nuxt.options as { hub?: NuxtHubOptions }).hub
  const dialect = getHubDialect(hub)
  if (!dialect || !['sqlite', 'postgresql', 'mysql'].includes(dialect)) {
    consola.warn(`Unsupported database dialect: ${dialect}`)
    return
  }

  // Generate schema immediately during module setup (before hub:db:schema:extend is called)
  const isProduction = !nuxt.options.dev
  try {
    const configFile = `${serverConfigPath}.ts`
    const userConfig = await loadUserAuthConfig(configFile, isProduction)

    const extendedConfig: { plugins?: BetterAuthPlugin[] } = {}
    await nuxt.callHook('better-auth:config:extend', extendedConfig)

    const plugins = [...(userConfig.plugins || []), ...(extendedConfig.plugins || [])]

    const authOptions = {
      ...userConfig,
      plugins,
      secondaryStorage: options.secondaryStorage
        ? { get: async (_key: string) => null, set: async (_key: string, _value: string, _ttl?: number) => {}, delete: async (_key: string) => {} }
        : undefined,
    }

    const hubCasing = getHubCasing(hub)
    const schemaOptions = { ...options.schema, useUuid: userConfig.advanced?.database?.generateId === 'uuid', casing: options.schema?.casing ?? hubCasing }
    const schemaCode = await generateDrizzleSchema(authOptions, dialect as 'sqlite' | 'postgresql' | 'mysql', schemaOptions)

    const schemaDir = join(nuxt.options.buildDir, 'better-auth')
    const schemaPath = join(schemaDir, `schema.${dialect}.ts`)

    await mkdir(schemaDir, { recursive: true })
    await writeFile(schemaPath, schemaCode)

    addTemplate({ filename: `better-auth/schema.${dialect}.ts`, getContents: () => schemaCode, write: true })

    consola.info(`Generated ${dialect} schema`)
  }
  catch (error) {
    if (isProduction) {
      throw error
    }
    consola.error('Failed to generate schema:', error)
  }

  // NuxtHub-specific hook for schema extension (not in standard Nuxt types)
  const nuxtWithHubHooks = nuxt as Nuxt & { hook: (name: string, cb: (arg: { paths: string[], dialect: string }) => void) => void }
  nuxtWithHubHooks.hook('hub:db:schema:extend', ({ paths, dialect: hookDialect }) => {
    const schemaPath = join(nuxt.options.buildDir, 'better-auth', `schema.${hookDialect}.ts`)
    if (existsSync(schemaPath)) {
      paths.unshift(schemaPath)
    }
  })
}

async function setupConvexAuthSchema(nuxt: Nuxt, serverConfigPath: string) {
  const isProduction = !nuxt.options.dev
  try {
    const configFile = `${serverConfigPath}.ts`
    const userConfig = await loadUserAuthConfig(configFile, isProduction)

    const authOptions = { ...userConfig }
    const schemaCode = await generateConvexSchema(authOptions)

    const schemaDir = join(nuxt.options.buildDir, 'better-auth')
    const schemaPath = join(schemaDir, 'auth-tables.convex.ts')

    await mkdir(schemaDir, { recursive: true })
    await writeFile(schemaPath, schemaCode)

    addTemplate({ filename: 'better-auth/auth-tables.convex.ts', getContents: () => schemaCode, write: true })
    nuxt.options.alias['#auth/convex-schema'] = schemaPath

    consola.info('Generated Convex auth schema at .nuxt/better-auth/auth-tables.convex.ts')
  }
  catch (error) {
    if (isProduction) {
      throw error
    }
    consola.error('Failed to generate Convex schema:', error)
  }
}

export { defineClientAuth, defineServerAuth } from './runtime/config'
export type { Auth, AuthMeta, AuthMode, AuthRouteRules, AuthSession, AuthUser, InferSession, InferUser, RequireSessionOptions, ServerAuthContext, UserMatch } from './runtime/types'
