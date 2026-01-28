import type { BetterAuthOptions } from 'better-auth'
import type { ClientOptions } from 'better-auth/client'
import type { CasingOption } from '../schema-generator'
import type { ServerAuthContext } from './types/augment'
import { createAuthClient } from 'better-auth/vue'

// Re-export for declaration merging with generated types
export type { ServerAuthContext }

export interface ClientAuthContext {
  siteUrl: string
}

export type ServerAuthConfig = Omit<BetterAuthOptions, 'database' | 'secret' | 'baseURL'>
export type ClientAuthConfig = Omit<ClientOptions, 'baseURL'> & { baseURL?: string }

export type ServerAuthConfigFn = (ctx: ServerAuthContext) => ServerAuthConfig
export type ClientAuthConfigFn = (ctx: ClientAuthContext) => ClientAuthConfig

// Module options for nuxt.config.ts
export interface BetterAuthModuleOptions {
  /** Client-only mode - skip server setup for external auth backends */
  clientOnly?: boolean
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
  useDatabase: boolean
  clientOnly: boolean
}

// Private runtime config (server-only)
export interface AuthPrivateRuntimeConfig {
  secondaryStorage: boolean
}

export function defineServerAuth<T extends ServerAuthConfig>(config: T | ((ctx: ServerAuthContext) => T)): (ctx: ServerAuthContext) => T {
  return typeof config === 'function' ? config : () => config
}

export function defineClientAuth<T extends ClientAuthConfig>(config: T | ((ctx: ClientAuthContext) => T)): (baseURL: string) => T & { baseURL: string } {
  return (baseURL: string) => {
    const ctx: ClientAuthContext = { siteUrl: baseURL }
    const resolved = typeof config === 'function' ? config(ctx) : config
    return { ...resolved, baseURL }
  }
}
