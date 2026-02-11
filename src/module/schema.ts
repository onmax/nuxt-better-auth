import type { Nuxt } from '@nuxt/schema'
import type { BetterAuthPlugin } from 'better-auth'
import type { ConsolaInstance } from 'consola'
import type { BetterAuthModuleOptions } from '../runtime/config'
import type { NuxtHubOptions } from './hub'
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { addTemplate } from '@nuxt/kit'
import { join } from 'pathe'
import { generateConvexSchema, generateDrizzleSchema, loadUserAuthConfig } from '../schema-generator'
import { getHubCasing, getHubDialect } from './hub'

interface SchemaContext {
  nuxt: Nuxt
  serverConfigPath: string
}

async function loadAuthOptions(context: SchemaContext) {
  const isProduction = !context.nuxt.options.dev
  const configFile = `${context.serverConfigPath}.ts`
  const userConfig = await loadUserAuthConfig(configFile, isProduction)

  const extendedConfig: { plugins?: BetterAuthPlugin[] } = {}
  await context.nuxt.callHook('better-auth:config:extend', extendedConfig)

  const plugins = [...(userConfig.plugins || []), ...(extendedConfig.plugins || [])]
  return { userConfig, plugins }
}

export async function setupBetterAuthSchema(
  nuxt: Nuxt,
  serverConfigPath: string,
  options: BetterAuthModuleOptions,
  consola: ConsolaInstance,
): Promise<void> {
  const hub = (nuxt.options as { hub?: NuxtHubOptions }).hub
  const dialect = getHubDialect(hub)
  if (!dialect || !['sqlite', 'postgresql', 'mysql'].includes(dialect)) {
    consola.warn(`Unsupported database dialect: ${dialect}`)
    return
  }

  const context: SchemaContext = { nuxt, serverConfigPath }

  try {
    const { userConfig, plugins } = await loadAuthOptions(context)
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
    const schemaPathTs = join(schemaDir, `schema.${dialect}.ts`)
    const schemaPathMjs = join(schemaDir, `schema.${dialect}.mjs`)

    await mkdir(schemaDir, { recursive: true })
    await writeFile(schemaPathTs, schemaCode)
    await writeFile(schemaPathMjs, schemaCode)

    addTemplate({ filename: `better-auth/schema.${dialect}.ts`, getContents: () => schemaCode, write: true })
    addTemplate({ filename: `better-auth/schema.${dialect}.mjs`, getContents: () => schemaCode, write: true })

    consola.info(`Generated ${dialect} schema (.ts + .mjs)`)

    const nuxtWithHubHooks = nuxt as Nuxt & { hook: (name: string, cb: (arg: { paths: string[], dialect: string }) => void) => void }
    nuxtWithHubHooks.hook('hub:db:schema:extend', ({ paths, dialect: hookDialect }) => {
      const preferTs = nuxt.options.dev
      const primaryPath = join(nuxt.options.buildDir, 'better-auth', `schema.${hookDialect}.${preferTs ? 'ts' : 'mjs'}`)
      const fallbackPath = join(nuxt.options.buildDir, 'better-auth', `schema.${hookDialect}.${preferTs ? 'mjs' : 'ts'}`)

      if (existsSync(primaryPath)) {
        paths.unshift(primaryPath)
        return
      }

      if (existsSync(fallbackPath))
        paths.unshift(fallbackPath)
    })
  }
  catch (error) {
    const isProduction = !nuxt.options.dev
    if (isProduction)
      throw error
    consola.error('Failed to generate schema:', error)
  }
}

export async function setupConvexAuthSchema(nuxt: Nuxt, serverConfigPath: string, consola: ConsolaInstance): Promise<void> {
  const context: SchemaContext = { nuxt, serverConfigPath }

  try {
    const { userConfig, plugins } = await loadAuthOptions(context)
    const authOptions = { ...userConfig, plugins }
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
    const isProduction = !nuxt.options.dev
    if (isProduction)
      throw error
    consola.error('Failed to generate Convex schema:', error)
  }
}
