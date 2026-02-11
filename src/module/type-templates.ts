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

interface _AugmentedServerAuthContext {
  runtimeConfig: RuntimeConfig
  ${hasHubDb ? `db: typeof import('@nuxthub/db')['db']` : 'db: unknown'}
}

declare module '@onmax/nuxt-better-auth/config' {
  import type { BetterAuthOptions } from 'better-auth'
  type ServerAuthConfig = Omit<BetterAuthOptions, 'database' | 'secret' | 'baseURL'>
  export function defineServerAuth<T extends ServerAuthConfig>(config: T | ((ctx: _AugmentedServerAuthContext) => T)): (ctx: _AugmentedServerAuthContext) => T
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
