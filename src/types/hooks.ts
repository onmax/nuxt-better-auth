import type { Nuxt } from '@nuxt/schema'
import type { BetterAuthOptions } from 'better-auth'
import type { DatabaseProvider } from '../database-provider'
import type { DbDialect } from '../module/hub'
import type { BetterAuthModuleOptions } from '../runtime/config'

export interface BetterAuthDatabaseProviderBuildContext {
  hubDialect: DbDialect
  usePlural: boolean
  camelCase: boolean
}

export interface BetterAuthDatabaseProviderSetupContext {
  nuxt: Nuxt
  options: BetterAuthModuleOptions
  clientOnly: boolean
  provider: DatabaseProvider
}

export interface BetterAuthDatabaseProviderDefinition {
  buildDatabaseCode: (ctx: BetterAuthDatabaseProviderBuildContext) => string
  setup?: (ctx: BetterAuthDatabaseProviderSetupContext) => void | Promise<void>
}

declare module '@nuxt/schema' {
  interface NuxtHooks {
    /**
     * Extend better-auth config with additional plugins or options.
     * Called after user's auth.config.ts is loaded.
     * @param config - Partial config to merge into the auth options
     */
    'better-auth:config:extend': (config: Partial<BetterAuthOptions>) => void | Promise<void>

    /**
     * Extend or override supported Better Auth database providers.
     * Providers should be added/updated by mutating the `providers` object.
     */
    'better-auth:database:providers': (providers: Record<string, BetterAuthDatabaseProviderDefinition>) => void | Promise<void>
  }
}
