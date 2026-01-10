import type { Auth } from 'better-auth'
import type { H3Event } from 'h3'
import { createDatabase, db } from '#auth/database'
import { createSecondaryStorage } from '#auth/secondary-storage'
import createServerAuth from '#auth/server'
import { betterAuth } from 'better-auth'
import { getRequestHost, getRequestProtocol } from 'h3'
import { useRuntimeConfig } from 'nitropack/runtime'
import { withoutProtocol } from 'ufo'

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

/**
 * Get the Nitro origin URL.
 * Adapted from nuxt-site-config by @harlan-zw
 * @see https://github.com/harlan-zw/nuxt-site-config/blob/main/packages/kit/src/util.ts
 */
function getNitroOrigin(e?: H3Event): string | undefined {
  const cert = process.env.NITRO_SSL_CERT
  const key = process.env.NITRO_SSL_KEY
  let host: string | undefined = process.env.NITRO_HOST || process.env.HOST
  let port: string | undefined
  if (import.meta.dev)
    port = process.env.NITRO_PORT || process.env.PORT || '3000'
  let protocol = (cert && key) || !import.meta.dev ? 'https' : 'http'

  try {
    if ((import.meta.dev || import.meta.prerender) && process.env.__NUXT_DEV__) {
      const origin = JSON.parse(process.env.__NUXT_DEV__).proxy.url
      host = withoutProtocol(origin)
      protocol = origin.includes('https') ? 'https' : 'http'
    }
    else if ((import.meta.dev || import.meta.prerender) && process.env.NUXT_VITE_NODE_OPTIONS) {
      const origin = JSON.parse(process.env.NUXT_VITE_NODE_OPTIONS).baseURL.replace('/__nuxt_vite_node__', '')
      host = withoutProtocol(origin)
      protocol = origin.includes('https') ? 'https' : 'http'
    }
    else if (e) {
      host = getRequestHost(e, { xForwardedHost: true }) || host
      protocol = getRequestProtocol(e, { xForwardedProto: true }) || protocol
    }
  }
  catch {
    // JSON parse failed, continue with env fallbacks
  }

  if (!host)
    return undefined

  if (host.includes(':') && !host.startsWith('[')) {
    const hostParts = host.split(':')
    port = hostParts.pop()
    host = hostParts.join(':')
  }

  const portSuffix = port ? `:${port}` : ''
  return `${protocol}://${host}${portSuffix}`
}

function getBaseURL(event?: H3Event): string {
  const config = useRuntimeConfig()

  // 1. Explicit config (highest priority)
  if (config.public.siteUrl && typeof config.public.siteUrl === 'string')
    return validateURL(config.public.siteUrl)

  // 2. Nitro origin detection (handles dev proxy, request headers)
  const nitroOrigin = getNitroOrigin(event)
  if (nitroOrigin)
    return validateURL(nitroOrigin)

  // 3. Platform env vars (fallback for non-request contexts)
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
