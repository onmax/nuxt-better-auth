import type { BetterAuthOptions } from 'better-auth'
import type { ClientOptions } from 'better-auth/client'
import type { CasingOption } from '../schema-generator'
import type { ServerAuthContext } from './types/augment'

// Re-export for declaration merging with generated types
export type { ServerAuthContext }

export interface ClientAuthContext {
  siteUrl: string
}

type ServerAuthConfig = Omit<BetterAuthOptions, 'database' | 'secret' | 'baseURL'>
type ClientAuthConfig = Omit<ClientOptions, 'baseURL'> & { baseURL?: string }

export type ServerAuthConfigFn = (ctx: ServerAuthContext) => ServerAuthConfig
export type ClientAuthConfigFn = (ctx: ClientAuthContext) => ClientAuthConfig

// Module options for nuxt.config.ts
export interface BetterAuthModuleOptions {
  /** Server config path relative to rootDir. Default: 'server/auth.config' */
  serverConfig?: string
  /** Client config path relative to rootDir. Default: 'app/auth.config' */
  clientConfig?: string
  redirects?: {
    login?: string // default: '/login'
    guest?: string // default: '/'
  }
  /** Enable KV secondary storage for sessions. Requires hub.kv: true */
  secondaryStorage?: boolean
  /** Schema generation options. Must match drizzleAdapter config. */
  schema?: {
    /** Plural table names: user → users. Default: false */
    usePlural?: boolean
    /** Column/table name casing. Explicit value takes precedence over hub.db.casing. */
    casing?: CasingOption
  }
}

// Runtime config type for public.auth
export interface AuthRuntimeConfig {
  redirects: { login: string, guest: string }
}

// Private runtime config (server-only)
export interface AuthPrivateRuntimeConfig {
  secondaryStorage: boolean
}

export function defineServerAuth<T extends ServerAuthConfig>(config: (ctx: ServerAuthContext) => T): (ctx: ServerAuthContext) => T {
  return config
}

export function defineClientAuth(config: ClientAuthConfigFn): ClientAuthConfigFn {
  return config
}
