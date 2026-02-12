export const nuxtBetterAuthInferTemplate = `
import type { BetterAuthOptions } from 'better-auth'
import type { RuntimeConfig } from 'nuxt/schema'
import type { BetterAuthConfigFromServerConfig, InferPluginTypes, SessionFieldsFromConfig, UserFieldsFromConfig } from '__RUNTIME_TYPES_PATH__'
import type createServerAuth from '#auth/server'

type _RawConfig = ReturnType<typeof createServerAuth>
type _Config = BetterAuthConfigFromServerConfig<_RawConfig>

declare module '#nuxt-better-auth' {
  interface AuthUser extends UserFieldsFromConfig<_RawConfig> {}
  interface AuthSession extends SessionFieldsFromConfig<_RawConfig> {}
  interface ServerAuthContext {
    runtimeConfig: RuntimeConfig
    db: __DB_TYPE__
  }
  type PluginTypes = InferPluginTypes<_Config>
}

interface _AugmentedServerAuthContext {
  runtimeConfig: RuntimeConfig
  db: __DB_TYPE__
}

declare module '@onmax/nuxt-better-auth/config' {
  import type { BetterAuthOptions } from 'better-auth'
  type ServerAuthConfigBase = Omit<BetterAuthOptions, 'database' | 'secret' | 'baseURL' | 'plugins'>
  type ServerAuthConfigWithPlugins = ServerAuthConfigBase & { plugins: readonly unknown[] }
  export function defineServerAuth<const R extends ServerAuthConfigWithPlugins>(config: R): (ctx: _AugmentedServerAuthContext) => R
  export function defineServerAuth<const R extends ServerAuthConfigWithPlugins>(config: (ctx: _AugmentedServerAuthContext) => R): (ctx: _AugmentedServerAuthContext) => R
  export function defineServerAuth<const R extends ServerAuthConfigBase>(config: R): (ctx: _AugmentedServerAuthContext) => R
  export function defineServerAuth<const R extends ServerAuthConfigBase>(config: (ctx: _AugmentedServerAuthContext) => R): (ctx: _AugmentedServerAuthContext) => R
}
`
