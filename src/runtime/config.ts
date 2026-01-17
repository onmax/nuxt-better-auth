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

/** i18n integration options */
export interface AuthI18nOptions {
  /** Override cookie name for locale detection. Default: uses nuxt-i18n's cookie */
  cookie?: string
  /** Namespace in locale files for error translations. Default: 'auth.errors' */
  translationPrefix?: string
}

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
  /** i18n integration with @nuxtjs/i18n. Auto-enabled when module detected. Set false to disable. */
  i18n?: boolean | AuthI18nOptions
}

// Runtime config type for public.auth
export interface AuthRuntimeConfig {
  redirects: { login: string, guest: string }
  useDatabase: boolean
  clientOnly: boolean
  i18n?: { enabled: boolean, translationPrefix: string }
}

// Private runtime config (server-only)
export interface AuthPrivateRuntimeConfig {
  secondaryStorage: boolean
  i18n?: { enabled: boolean, cookie: string, translationPrefix: string }
}

export function defineServerAuth<T extends ServerAuthConfig>(config: (ctx: ServerAuthContext) => T): (ctx: ServerAuthContext) => T {
  return config
}

export function defineClientAuth(config: ClientAuthConfigFn): ClientAuthConfigFn {
  return config
}
