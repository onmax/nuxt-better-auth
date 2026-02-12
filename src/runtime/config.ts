import type { BetterAuthOptions } from 'better-auth'
import type { BetterAuthClientOptions } from 'better-auth/client'
import type { DatabaseProvider } from '../database-provider'
import type { CasingOption } from '../schema-generator'
import type { ServerAuthContext } from './types/augment'
import { createAuthClient } from 'better-auth/vue'

// Re-export for declaration merging with generated types
export type { ServerAuthContext }

export interface ClientAuthContext {
  siteUrl: string
}

export type ServerAuthConfigBase = Omit<BetterAuthOptions, 'database' | 'secret' | 'baseURL' | 'plugins'>
export type ServerAuthConfig = ServerAuthConfigBase
export type ClientAuthConfig = Omit<BetterAuthClientOptions, 'baseURL'> & { baseURL?: string }
type ServerAuthConfigWithPlugins = ServerAuthConfigBase & { plugins: readonly unknown[] }

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
  session?: {
    /**
     * When enabled, and session/user are already hydrated from SSR, skip the initial
     * client `/api/auth/get-session` bootstrap request. This also skips Better Auth's
     * session refresh manager on those pages.
     *
     * Default: false
     */
    skipHydratedSsrGetSession?: boolean
  }
  /** Enable KV secondary storage for sessions. Requires hub.kv: true */
  secondaryStorage?: boolean
  /** Database backend selection and provider-specific options */
  database?: {
    /** Explicit database provider. Default: auto (nuxthub when available, otherwise none) */
    provider?: DatabaseProvider
    /** Convex deployment URL override (highest priority for Convex provider) */
    convexUrl?: string
  }
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
  databaseProvider: DatabaseProvider
  clientOnly: boolean
  session: { skipHydratedSsrGetSession: boolean }
}

// Private runtime config (server-only)
export interface AuthPrivateRuntimeConfig {
  secondaryStorage: boolean
}

export function defineServerAuth<const R extends ServerAuthConfigWithPlugins>(config: R): (ctx: ServerAuthContext) => R
export function defineServerAuth<const R extends ServerAuthConfigWithPlugins>(config: (ctx: ServerAuthContext) => R): (ctx: ServerAuthContext) => R
export function defineServerAuth<const R extends ServerAuthConfigBase>(config: R): (ctx: ServerAuthContext) => R
export function defineServerAuth<const R extends ServerAuthConfigBase>(config: (ctx: ServerAuthContext) => R): (ctx: ServerAuthContext) => R
export function defineServerAuth<T extends ServerAuthConfigBase>(config: T | ((ctx: ServerAuthContext) => T)): (ctx: ServerAuthContext) => T {
  return typeof config === 'function' ? config : () => config
}

export function defineClientAuth<T extends ClientAuthConfig>(config: T | ((ctx: ClientAuthContext) => T)): (baseURL: string) => ReturnType<typeof createAuthClient<T>> {
  return (baseURL: string) => {
    const ctx: ClientAuthContext = { siteUrl: baseURL }
    const resolved = typeof config === 'function' ? config(ctx) : config
    return createAuthClient({ ...resolved, baseURL })
  }
}
