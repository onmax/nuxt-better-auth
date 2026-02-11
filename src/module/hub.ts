import type { Nuxt } from '@nuxt/schema'
import type { CasingOption } from '../schema-generator'

export type DbDialect = 'sqlite' | 'postgresql' | 'mysql'

export interface NuxtHubOptions {
  db?: boolean | DbDialect | { dialect?: DbDialect, casing?: CasingOption }
  kv?: boolean
}

export function getHubDialect(hub?: NuxtHubOptions): DbDialect | undefined {
  if (!hub?.db)
    return undefined
  if (typeof hub.db === 'string')
    return hub.db
  if (typeof hub.db === 'object' && hub.db !== null)
    return hub.db.dialect
  return undefined
}

export function getHubCasing(hub?: NuxtHubOptions): CasingOption | undefined {
  if (!hub?.db || typeof hub.db !== 'object' || hub.db === null)
    return undefined
  return hub.db.casing
}

export function resolveConvexUrl(nuxt: Nuxt, explicitConvexUrl?: string): string {
  if (explicitConvexUrl)
    return explicitConvexUrl

  const convexConfig = (nuxt.options as { convex?: { url?: string } }).convex
  if (convexConfig?.url)
    return convexConfig.url

  const runtimeUrl = (nuxt.options.runtimeConfig.public as { convex?: { url?: string } })?.convex?.url
  if (runtimeUrl)
    return runtimeUrl

  if (process.env.CONVEX_URL)
    return process.env.CONVEX_URL

  if (process.env.NUXT_PUBLIC_CONVEX_URL)
    return process.env.NUXT_PUBLIC_CONVEX_URL

  return ''
}
