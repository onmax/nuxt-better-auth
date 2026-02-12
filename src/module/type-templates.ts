import { addTypeTemplate } from '@nuxt/kit'

interface RegisterServerTypeTemplatesInput {
  serverConfigPath: string
  hasHubDb: boolean
  runtimeTypesPath: string
}

export function registerServerTypeTemplates(input: RegisterServerTypeTemplatesInput): void {
  const { serverConfigPath, hasHubDb, runtimeTypesPath } = input

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
import type { BetterAuthOptions, BetterAuthPlugin, InferPluginTypes, UnionToIntersection } from 'better-auth'
import type { InferFieldsOutput } from 'better-auth/db'
import type { RuntimeConfig } from 'nuxt/schema'
import type createServerAuth from '${serverConfigPath}'

type _RawConfig = ReturnType<typeof createServerAuth>
type _RawPlugins = _RawConfig extends { plugins: infer P } ? P : _RawConfig extends { plugins?: infer P } ? P : []
type _NormalizedPlugins = _RawPlugins extends readonly (infer T)[]
  ? Array<T & BetterAuthPlugin>
  : _RawPlugins extends (infer T)[]
      ? Array<T & BetterAuthPlugin>
      : BetterAuthPlugin[]
type _Config = Omit<BetterAuthOptions, 'plugins'> & Omit<_RawConfig, 'plugins'> & {
  plugins?: _NormalizedPlugins
}

type _InferModelFieldsFromPlugins<P, M extends string> = P extends readonly (infer Plugin)[]
  ? UnionToIntersection<Plugin extends { schema: { [K in M]: { fields: infer F } } } ? InferFieldsOutput<F> : {}>
  : P extends (infer Plugin)[]
      ? UnionToIntersection<Plugin extends { schema: { [K in M]: { fields: infer F } } } ? InferFieldsOutput<F> : {}>
      : {}

type _InferModelFieldsFromOptions<C, M extends 'user' | 'session'> = C extends { [K in M]: { additionalFields: infer F } }
  ? InferFieldsOutput<F>
  : {}

type _UserFallback = _InferModelFieldsFromPlugins<_RawPlugins, 'user'> & _InferModelFieldsFromOptions<_RawConfig, 'user'>
type _SessionFallback = _InferModelFieldsFromPlugins<_RawPlugins, 'session'> & _InferModelFieldsFromOptions<_RawConfig, 'session'>

declare module '#nuxt-better-auth' {
  interface AuthUser extends _UserFallback {}
  interface AuthSession extends _SessionFallback {}
  interface ServerAuthContext {
    runtimeConfig: RuntimeConfig
    db: ${hasHubDb ? `typeof import('@nuxthub/db')['db']` : 'unknown'}
  }
  type PluginTypes = InferPluginTypes<_Config>
}

interface _AugmentedServerAuthContext {
  runtimeConfig: RuntimeConfig
  db: ${hasHubDb ? `typeof import('@nuxthub/db')['db']` : 'unknown'}
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
`,
  }, { nuxt: true, nitro: true, node: true })

  addTypeTemplate({
    filename: 'types/nuxt-better-auth-nitro.d.ts',
    getContents: () => `
declare module 'nitropack' {
  interface NitroRouteRules {
    auth?: import('${runtimeTypesPath}').AuthMeta
  }
  interface NitroRouteConfig {
    auth?: import('${runtimeTypesPath}').AuthMeta
  }
}
declare module 'nitropack/types' {
  interface NitroRouteRules {
    auth?: import('${runtimeTypesPath}').AuthMeta
  }
  interface NitroRouteConfig {
    auth?: import('${runtimeTypesPath}').AuthMeta
  }
}
export {}
`,
  }, { nuxt: true, nitro: true, node: true })
}

interface RegisterSharedTypeTemplatesInput {
  runtimeTypesAugmentPath: string
  runtimeTypesPath: string
  clientConfigPath: string
}

export function registerSharedTypeTemplates(input: RegisterSharedTypeTemplatesInput): void {
  addTypeTemplate({
    filename: 'types/nuxt-better-auth.d.ts',
    getContents: () => `
export * from '${input.runtimeTypesAugmentPath}'
export type { AuthMeta, AuthMode, AuthRouteRules, UserMatch, RequireSessionOptions, Auth, InferUser, InferSession } from '${input.runtimeTypesPath}'
`,
  })

  addTypeTemplate({
    filename: 'types/nuxt-better-auth-client.d.ts',
    getContents: () => `
import type createAppAuthClient from '${input.clientConfigPath}'
declare module '#nuxt-better-auth' {
  export type AppAuthClient = ReturnType<typeof createAppAuthClient>
}
`,
  })
}
