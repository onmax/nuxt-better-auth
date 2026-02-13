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

const _authCache = new Map<string, AuthInstance>()
let _baseURLInferenceLogged = false

function normalizeLoopbackOrigin(origin: string): string {
  if (!import.meta.dev)
    return origin

  try {
    const url = new URL(origin)
    if (url.hostname === '127.0.0.1' || url.hostname === '::1' || url.hostname === '[::1]') {
      url.hostname = 'localhost'
      return url.origin
    }
  }
  catch {
    // Invalid URL is handled by validateURL.
  }

  return origin
}

function logInferredBaseURL(baseURL: string, source: string): void {
  if (!import.meta.dev || _baseURLInferenceLogged)
    return

  _baseURLInferenceLogged = true
  console.warn(`[nuxt-better-auth] Using inferred baseURL "${baseURL}" from ${source}. Set runtimeConfig.public.siteUrl for deterministic OAuth callbacks.`)
}

function validateURL(url: string): string {
  try {
    return normalizeLoopbackOrigin(new URL(url).origin)
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

  if (host.startsWith('[') && host.includes(']:')) {
    const lastBracketColon = host.lastIndexOf(']:')
    const extractedPort = host.slice(lastBracketColon + 2)
    host = host.slice(0, lastBracketColon + 1)
    if (extractedPort)
      port = extractedPort
  }
  else if (host.includes(':') && !host.startsWith('[')) {
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
  if (nitroOrigin) {
    const inferredBaseURL = validateURL(nitroOrigin)
    logInferredBaseURL(inferredBaseURL, 'Nitro/request origin detection')
    return inferredBaseURL
  }

  // 3. Platform env vars (fallback for non-request contexts)
  if (process.env.VERCEL_URL) {
    const inferredBaseURL = validateURL(`https://${process.env.VERCEL_URL}`)
    logInferredBaseURL(inferredBaseURL, 'VERCEL_URL')
    return inferredBaseURL
  }
  if (process.env.CF_PAGES_URL) {
    const inferredBaseURL = validateURL(`https://${process.env.CF_PAGES_URL}`)
    logInferredBaseURL(inferredBaseURL, 'CF_PAGES_URL')
    return inferredBaseURL
  }
  if (process.env.URL) {
    const inferredBaseURL = validateURL(process.env.URL.startsWith('http') ? process.env.URL : `https://${process.env.URL}`)
    logInferredBaseURL(inferredBaseURL, 'URL')
    return inferredBaseURL
  }

  // 4. Dev fallback
  if (import.meta.dev) {
    const inferredBaseURL = 'http://localhost:3000'
    logInferredBaseURL(inferredBaseURL, 'development fallback')
    return inferredBaseURL
  }

  throw new Error('siteUrl required. Set NUXT_PUBLIC_SITE_URL.')
}

/** Returns Better Auth instance. Caches per resolved host (or single instance when siteUrl is explicit). */
export function serverAuth(event?: H3Event): AuthInstance {
  const runtimeConfig = useRuntimeConfig()
  const siteUrl = getBaseURL(event)
  const hasExplicitSiteUrl = runtimeConfig.public.siteUrl && typeof runtimeConfig.public.siteUrl === 'string'
  const cacheKey = hasExplicitSiteUrl ? '__explicit__' : siteUrl

  const cached = _authCache.get(cacheKey)
  if (cached)
    return cached

  const database = createDatabase()
  const userConfig = createServerAuth({ runtimeConfig, db })

  const auth = betterAuth({
    ...userConfig,
    ...(database && { database }),
    secondaryStorage: createSecondaryStorage(),
    secret: runtimeConfig.betterAuthSecret,
    baseURL: siteUrl,
  })

  _authCache.set(cacheKey, auth)
  return auth
}
