import type { Auth } from 'better-auth'
import type { H3Event } from 'h3'
import { createDatabase, db } from '#auth/database'
import { createSecondaryStorage } from '#auth/secondary-storage'
import createServerAuth from '#auth/server'
import { betterAuth } from 'better-auth'
import { getRequestURL } from 'h3'
import { useRuntimeConfig } from 'nitropack/runtime'

type AuthInstance = Auth<ReturnType<typeof createServerAuth>>

let _auth: AuthInstance | null = null

function validateURL(url: string): string {
  try {
    return new URL(url).origin
  }
  catch {
    throw new Error(`Invalid siteUrl: "${url}". Must be a valid URL.`)
  }
}

function getBaseURL(event?: H3Event): string {
  const config = useRuntimeConfig()

  // 1. Explicit config (highest priority)
  if (config.public.siteUrl && typeof config.public.siteUrl === 'string')
    return validateURL(config.public.siteUrl)

  // 2. Request URL (always correct for current request)
  if (event)
    return getRequestURL(event).origin

  // 3. Platform env vars (fallback for non-request contexts like seed scripts)
  if (process.env.VERCEL_URL)
    return validateURL(`https://${process.env.VERCEL_URL}`)
  if (process.env.CF_PAGES_URL)
    return validateURL(`https://${process.env.CF_PAGES_URL}`)
  if (process.env.URL)
    return validateURL(process.env.URL.startsWith('http') ? process.env.URL : `https://${process.env.URL}`)

  // 4. Dev fallback
  if (import.meta.dev)
    return 'http://localhost:3000'

  throw new Error('siteUrl required. Set NUXT_PUBLIC_SITE_URL.')
}

/** Returns Better Auth instance. Pass event for accurate URL detection on first call. */
export function serverAuth(event?: H3Event): AuthInstance {
  if (_auth)
    return _auth

  const runtimeConfig = useRuntimeConfig()
  const siteUrl = getBaseURL(event)

  const database = createDatabase()
  const userConfig = createServerAuth({ runtimeConfig, db })

  _auth = betterAuth({
    ...userConfig,
    ...(database && { database }),
    secondaryStorage: createSecondaryStorage(),
    secret: runtimeConfig.betterAuthSecret,
    baseURL: siteUrl,
  })

  return _auth
}
