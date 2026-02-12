import { addTypeTemplate } from '@nuxt/kit'
import { nuxtBetterAuthInferTemplate } from './templates/nuxt-better-auth-infer-template'

interface RegisterServerTypeTemplatesInput {
  hasHubDb: boolean
  runtimeTypesPath: string
}

export function registerServerTypeTemplates(input: RegisterServerTypeTemplatesInput): void {
  const { hasHubDb, runtimeTypesPath } = input

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
    getContents: () => nuxtBetterAuthInferTemplate
      .replaceAll('__RUNTIME_TYPES_PATH__', runtimeTypesPath)
      .replaceAll('__DB_TYPE__', hasHubDb ? `typeof import('@nuxthub/db')['db']` : 'unknown'),
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
