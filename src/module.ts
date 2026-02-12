import type { NuxtHubOptions } from './module/hub'
import type { BetterAuthModuleOptions } from './runtime/config'
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { addTemplate, createResolver, defineNuxtModule, hasNuxtModule } from '@nuxt/kit'
import { consola as _consola } from 'consola'
import { dirname, join } from 'pathe'
import { version } from '../package.json'
import { resolveDatabaseProvider } from './database-provider'
import { resolveConvexUrl } from './module/convex'
import { registerAuthMiddlewareHook, registerDevtools, registerRouteRulesMetaHook, registerServerRuntime, registerTemplateHmrHook } from './module/hooks'
import { getHubCasing, getHubDialect } from './module/hub'
import { setupRuntimeConfig } from './module/runtime'
import { setupBetterAuthSchema, setupConvexAuthSchema } from './module/schema'
import { promptForSecret } from './module/secret'
import { applyConvexRuntimeConfig, buildDatabaseCode, buildSecondaryStorageCode } from './module/templates'
import { registerServerTypeTemplates, registerSharedTypeTemplates } from './module/type-templates'

import './types/hooks'

const consola = _consola.withTag('nuxt-better-auth')

function resolveDefaultClientConfig(options: BetterAuthModuleOptions, rootDir: string, srcDir: string): void {
  if (options.clientConfig !== 'app/auth.config')
    return

  const srcDirRelative = srcDir.replace(`${rootDir}/`, '')
  options.clientConfig = srcDirRelative === srcDir
    ? 'auth.config'
    : `${srcDirRelative}/auth.config`
}

async function createDefaultAuthConfigFiles(rootDir: string, srcDir: string): Promise<void> {
  const serverPath = join(rootDir, 'server/auth.config.ts')
  const clientPath = join(srcDir, 'auth.config.ts')

  const serverTemplate = `import { defineServerAuth } from '@onmax/nuxt-better-auth/config'

export default defineServerAuth({
  emailAndPassword: { enabled: true },
})
`

  const clientTemplate = `import { defineClientAuth } from '@onmax/nuxt-better-auth/config'

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
    const relativePath = clientPath.replace(`${rootDir}/`, '')
    consola.success(`Created ${relativePath}`)
  }
}

export type { BetterAuthModuleOptions } from './runtime/config'

export default defineNuxtModule<BetterAuthModuleOptions>({
  meta: { name: '@onmax/nuxt-better-auth', version, configKey: 'auth', compatibility: { nuxt: '>=3.0.0' } },
  defaults: {
    clientOnly: false,
    serverConfig: 'server/auth.config',
    clientConfig: 'app/auth.config',
    redirects: { login: '/login', guest: '/' },
    secondaryStorage: false,
  },
  async onInstall(nuxt) {
    const generatedSecret = await promptForSecret(nuxt.options.rootDir, consola)
    if (generatedSecret)
      process.env.BETTER_AUTH_SECRET = generatedSecret

    await createDefaultAuthConfigFiles(nuxt.options.rootDir, nuxt.options.srcDir)
  },
  async setup(options, nuxt) {
    const resolver = createResolver(import.meta.url)

    resolveDefaultClientConfig(options, nuxt.options.rootDir, nuxt.options.srcDir)

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
    const hasHubDbAvailable = !clientOnly && hasNuxtHub && !!hub?.db
    const hasConvexModule = hasNuxtModule('nuxt-convex', nuxt)
    const detectedConvexUrl = resolveConvexUrl(nuxt, options.database?.convexUrl)

    const resolvedDatabase = resolveDatabaseProvider({
      clientOnly,
      hasHubDb: hasHubDbAvailable,
      hasConvexModule,
      convexUrl: detectedConvexUrl,
      selectedProvider: options.database?.provider,
    })

    const databaseProvider = resolvedDatabase.provider
    const hasHubDb = databaseProvider === 'nuxthub'
    const hasConvexDb = databaseProvider === 'convex'

    if (hasConvexDb)
      consola.info('Using Convex HTTP adapter for Better Auth database')

    const { secondaryStorageEnabled } = setupRuntimeConfig({
      nuxt,
      options,
      clientOnly,
      databaseProvider,
      hasNuxtHub,
      hub,
      consola,
    })

    nuxt.options.alias['#nuxt-better-auth'] = resolver.resolve('./runtime/types/augment')
    if (!clientOnly)
      nuxt.options.alias['#auth/server'] = serverConfigPath
    nuxt.options.alias['#auth/client'] = clientConfigPath

    if (!clientOnly) {
      if (secondaryStorageEnabled && !nuxt.options.alias['hub:kv']) {
        throw new Error('[nuxt-better-auth] hub:kv not found. Ensure @nuxthub/core is loaded before this module and hub.kv is enabled.')
      }

      const secondaryStorageTemplate = addTemplate({
        filename: 'better-auth/secondary-storage.mjs',
        getContents: () => buildSecondaryStorageCode(secondaryStorageEnabled),
        write: true,
      })
      nuxt.options.alias['#auth/secondary-storage'] = secondaryStorageTemplate.dst

      if (hasHubDb && !nuxt.options.alias['hub:db']) {
        throw new Error('[nuxt-better-auth] hub:db not found. Ensure @nuxthub/core is loaded before this module and hub.db is configured.')
      }

      const hubDialect = getHubDialect(hub) ?? 'sqlite'
      const usePlural = options.schema?.usePlural ?? false
      const camelCase = (options.schema?.casing ?? getHubCasing(hub)) !== 'snake_case'

      if (hasConvexDb)
        applyConvexRuntimeConfig(nuxt, resolvedDatabase.convexUrl)

      const databaseTemplate = addTemplate({
        filename: 'better-auth/database.mjs',
        getContents: () => buildDatabaseCode({ provider: databaseProvider, hubDialect, usePlural, camelCase }),
        write: true,
      })
      nuxt.options.alias['#auth/database'] = databaseTemplate.dst

      registerServerTypeTemplates({
        hasHubDb,
        runtimeTypesPath: resolver.resolve('./runtime/types'),
      })
    }

    registerSharedTypeTemplates({
      runtimeTypesAugmentPath: resolver.resolve('./runtime/types/augment'),
      runtimeTypesPath: resolver.resolve('./runtime/types'),
      clientConfigPath,
    })

    registerTemplateHmrHook(nuxt)
    registerServerRuntime({ clientOnly, resolve: resolver.resolve })
    registerAuthMiddlewareHook(nuxt, resolver.resolve)

    if (hasHubDb)
      await setupBetterAuthSchema(nuxt, serverConfigPath, options, consola)

    if (hasConvexDb)
      await setupConvexAuthSchema(nuxt, serverConfigPath, consola)

    await registerDevtools({ nuxt, clientOnly, hasHubDb, resolve: resolver.resolve })
    registerRouteRulesMetaHook(nuxt)
  },
})

export { defineClientAuth, defineServerAuth } from './runtime/config'
export type { Auth, AuthMeta, AuthMode, AuthRouteRules, AuthSession, AuthUser, InferSession, InferUser, RequireSessionOptions, ServerAuthContext, UserMatch } from './runtime/types'
