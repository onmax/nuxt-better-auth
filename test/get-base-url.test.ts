import { withoutProtocol } from 'ufo'
import { describe, expect, it, vi } from 'vitest'

function normalizeLoopbackOrigin(origin: string, isDev: boolean): string {
  if (!isDev)
    return origin

  const parsed = new URL(origin)
  if (parsed.hostname === '127.0.0.1' || parsed.hostname === '::1' || parsed.hostname === '[::1]') {
    parsed.hostname = 'localhost'
    return parsed.origin
  }

  return origin
}

function validateURL(url: string, isDev: boolean): string {
  try {
    return normalizeLoopbackOrigin(new URL(url).origin, isDev)
  }
  catch {
    throw new Error(`Invalid siteUrl: "${url}". Must be a valid URL.`)
  }
}

interface GetNitroOriginOptions {
  isDev: boolean
  isPrerender: boolean
  env: Partial<Record<string, string>>
  requestHost?: string
  requestProtocol?: string
}

/**
 * Mock of getNitroOrigin for unit testing.
 * Adapted from nuxt-site-config by @harlan-zw
 * @see https://github.com/harlan-zw/nuxt-site-config/blob/main/packages/kit/src/util.ts
 */
function getNitroOrigin(options: GetNitroOriginOptions): string | undefined {
  const { isDev, isPrerender, env, requestHost, requestProtocol } = options
  const cert = env.NITRO_SSL_CERT
  const key = env.NITRO_SSL_KEY
  let host: string | undefined = env.NITRO_HOST || env.HOST
  let port: string | undefined
  if (isDev)
    port = env.NITRO_PORT || env.PORT || '3000'
  let protocol = (cert && key) || !isDev ? 'https' : 'http'

  try {
    if ((isDev || isPrerender) && env.__NUXT_DEV__) {
      const origin = JSON.parse(env.__NUXT_DEV__).proxy.url
      host = withoutProtocol(origin)
      protocol = origin.includes('https') ? 'https' : 'http'
    }
    else if ((isDev || isPrerender) && env.NUXT_VITE_NODE_OPTIONS) {
      const origin = JSON.parse(env.NUXT_VITE_NODE_OPTIONS).baseURL.replace('/__nuxt_vite_node__', '')
      host = withoutProtocol(origin)
      protocol = origin.includes('https') ? 'https' : 'http'
    }
    else if (requestHost) {
      host = requestHost || host
      protocol = requestProtocol || protocol
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

// Mock of getBaseURL logic for unit testing
function getBaseURL(config: { public: { siteUrl?: unknown } }, nitroOriginOptions: GetNitroOriginOptions): string {
  if (config.public.siteUrl && typeof config.public.siteUrl === 'string')
    return validateURL(config.public.siteUrl, nitroOriginOptions.isDev)

  const nitroOrigin = getNitroOrigin(nitroOriginOptions)
  if (nitroOrigin)
    return validateURL(nitroOrigin, nitroOriginOptions.isDev)

  const env = nitroOriginOptions.env
  if (env.VERCEL_URL)
    return validateURL(`https://${env.VERCEL_URL}`, nitroOriginOptions.isDev)
  if (env.CF_PAGES_URL)
    return validateURL(`https://${env.CF_PAGES_URL}`, nitroOriginOptions.isDev)
  if (env.URL)
    return validateURL(env.URL.startsWith('http') ? env.URL : `https://${env.URL}`, nitroOriginOptions.isDev)

  if (nitroOriginOptions.isDev)
    return 'http://localhost:3000'

  throw new Error('siteUrl required. Set NUXT_PUBLIC_SITE_URL.')
}

type TrustedOrigins
  = | string[]
    | ((request?: Request) => (string | undefined | null)[] | Promise<(string | undefined | null)[]>)
    | undefined

function dedupeOrigins(origins: readonly string[]): string[] {
  return [...new Set(origins)]
}

function getDevLocalhostOrigin(options: GetNitroOriginOptions): string {
  const fallbackOrigin = 'http://localhost:3000'
  const nitroOrigin = getNitroOrigin(options)
  if (!nitroOrigin)
    return fallbackOrigin

  try {
    const parsed = new URL(nitroOrigin)
    const protocol = parsed.protocol === 'https:' ? 'https' : 'http'
    const port = parsed.port || '3000'
    return `${protocol}://localhost:${port}`
  }
  catch {
    return fallbackOrigin
  }
}

function withDevLocalhostTrustedOrigin(
  trustedOrigins: TrustedOrigins,
  options: GetNitroOriginOptions & { hasExplicitSiteUrl: boolean },
): TrustedOrigins {
  if (!options.isDev || !options.hasExplicitSiteUrl)
    return trustedOrigins

  const localhostOrigin = getDevLocalhostOrigin(options)

  if (Array.isArray(trustedOrigins))
    return dedupeOrigins([...trustedOrigins, localhostOrigin])

  if (typeof trustedOrigins === 'function') {
    return async (request?: Request) => {
      const resolvedOrigins = await trustedOrigins(request)
      const validOrigins = resolvedOrigins.filter((origin): origin is string => typeof origin === 'string')
      return dedupeOrigins([...validOrigins, localhostOrigin])
    }
  }

  return [localhostOrigin]
}

describe('getBaseURL', () => {
  it('explicit config takes priority', () => {
    expect(getBaseURL({ public: { siteUrl: 'https://explicit.com' } }, { isDev: false, isPrerender: false, env: {}, requestHost: 'request.com', requestProtocol: 'https' })).toBe('https://explicit.com')
  })

  it('requestHost used when no explicit config', () => {
    expect(getBaseURL({ public: {} }, { isDev: false, isPrerender: false, env: {}, requestHost: 'myapp.com', requestProtocol: 'https' })).toBe('https://myapp.com')
  })

  it('uses NITRO_HOST/PORT in dev mode', () => {
    expect(getBaseURL({ public: {} }, { isDev: true, isPrerender: false, env: { NITRO_HOST: 'localhost', NITRO_PORT: '3000' } })).toBe('http://localhost:3000')
  })

  it('dev mode defaults to port 3000', () => {
    expect(getBaseURL({ public: {} }, { isDev: true, isPrerender: false, env: { HOST: 'localhost' } })).toBe('http://localhost:3000')
  })

  it('uses https with SSL certs', () => {
    expect(getBaseURL({ public: {} }, { isDev: true, isPrerender: false, env: { HOST: 'localhost', NITRO_SSL_CERT: 'cert', NITRO_SSL_KEY: 'key' } })).toBe('https://localhost:3000')
  })

  it('parses __NUXT_DEV__ in dev mode', () => {
    const nuxtDev = JSON.stringify({ proxy: { url: 'http://localhost:3000' } })
    expect(getBaseURL({ public: {} }, { isDev: true, isPrerender: false, env: { __NUXT_DEV__: nuxtDev } })).toBe('http://localhost:3000')
  })

  it('handles malformed __NUXT_DEV__ gracefully', () => {
    expect(getBaseURL({ public: {} }, { isDev: true, isPrerender: false, env: { __NUXT_DEV__: 'not-json', HOST: 'localhost' } })).toBe('http://localhost:3000')
  })

  it('falls back to VERCEL_URL when no host detected', () => {
    expect(getBaseURL({ public: {} }, { isDev: false, isPrerender: false, env: { VERCEL_URL: 'my-app.vercel.app' } })).toBe('https://my-app.vercel.app')
  })

  it('falls back to CF_PAGES_URL when no host detected', () => {
    expect(getBaseURL({ public: {} }, { isDev: false, isPrerender: false, env: { CF_PAGES_URL: 'my-app.pages.dev' } })).toBe('https://my-app.pages.dev')
  })

  it('falls back to URL env var', () => {
    expect(getBaseURL({ public: {} }, { isDev: false, isPrerender: false, env: { URL: 'https://my-app.netlify.app' } })).toBe('https://my-app.netlify.app')
  })

  it('dev fallback to localhost when no host', () => {
    expect(getBaseURL({ public: {} }, { isDev: true, isPrerender: false, env: {} })).toBe('http://localhost:3000')
  })

  it('throws in production without config', () => {
    expect(() => getBaseURL({ public: {} }, { isDev: false, isPrerender: false, env: {} })).toThrow('siteUrl required')
  })

  it('ignores non-string siteUrl', () => {
    expect(getBaseURL({ public: { siteUrl: 123 } }, { isDev: true, isPrerender: false, env: { HOST: 'localhost' } })).toBe('http://localhost:3000')
  })

  it('throws on invalid URL format', () => {
    expect(() => getBaseURL({ public: { siteUrl: 'not-a-url' } }, { isDev: false, isPrerender: false, env: {} })).toThrow('Invalid siteUrl')
  })

  it('handles IPv6 addresses', () => {
    expect(getBaseURL({ public: {} }, { isDev: false, isPrerender: false, env: {}, requestHost: '[::1]:3000', requestProtocol: 'http' })).toBe('http://[::1]:3000')
  })

  it('normalizes 127.0.0.1 to localhost in dev', () => {
    expect(getBaseURL({ public: {} }, { isDev: true, isPrerender: false, env: {}, requestHost: '127.0.0.1:3000', requestProtocol: 'http' })).toBe('http://localhost:3000')
  })

  it('normalizes ::1 to localhost in dev', () => {
    expect(getBaseURL({ public: {} }, { isDev: true, isPrerender: false, env: {}, requestHost: '[::1]:3000', requestProtocol: 'http' })).toBe('http://localhost:3000')
  })

  it('normalizes explicit loopback siteUrl in dev', () => {
    expect(getBaseURL({ public: { siteUrl: 'http://127.0.0.1:3000' } }, { isDev: true, isPrerender: false, env: {} })).toBe('http://localhost:3000')
  })

  it('does not normalize loopback hosts in production', () => {
    expect(getBaseURL({ public: {} }, { isDev: false, isPrerender: false, env: {}, requestHost: '127.0.0.1:3000', requestProtocol: 'http' })).toBe('http://127.0.0.1:3000')
  })

  it('does not alter non-loopback hosts in dev', () => {
    expect(getBaseURL({ public: {} }, { isDev: true, isPrerender: false, env: {}, requestHost: 'myapp.local:3000', requestProtocol: 'http' })).toBe('http://myapp.local:3000')
  })
})

describe('withDevLocalhostTrustedOrigin', () => {
  it('appends detected localhost origin with detected port', () => {
    const trustedOrigins = withDevLocalhostTrustedOrigin(undefined, {
      isDev: true,
      isPrerender: false,
      hasExplicitSiteUrl: true,
      env: {
        __NUXT_DEV__: JSON.stringify({ proxy: { url: 'http://127.0.0.1:4123' } }),
      },
    })

    expect(trustedOrigins).toEqual(['http://localhost:4123'])
  })

  it('preserves and deduplicates configured trustedOrigins arrays', () => {
    const trustedOrigins = withDevLocalhostTrustedOrigin(['https://foo.workers.dev', 'http://localhost:3001'], {
      isDev: true,
      isPrerender: false,
      hasExplicitSiteUrl: true,
      env: {
        NITRO_HOST: 'localhost',
        NITRO_PORT: '3001',
      },
    })

    expect(trustedOrigins).toEqual(['https://foo.workers.dev', 'http://localhost:3001'])
  })

  it('wraps trustedOrigins functions and appends localhost origin', async () => {
    const trustedOriginsFn = vi.fn(async () => ['https://foo.workers.dev', undefined, null, 'http://localhost:3002'])
    const trustedOrigins = withDevLocalhostTrustedOrigin(trustedOriginsFn, {
      isDev: true,
      isPrerender: false,
      hasExplicitSiteUrl: true,
      env: {
        NITRO_HOST: 'localhost',
        NITRO_PORT: '3002',
      },
    })

    expect(typeof trustedOrigins).toBe('function')
    if (typeof trustedOrigins !== 'function')
      throw new Error('trustedOrigins should be a function')
    const resolvedOrigins = await trustedOrigins()

    expect(trustedOriginsFn).toHaveBeenCalledTimes(1)
    expect(resolvedOrigins).toEqual(['https://foo.workers.dev', 'http://localhost:3002'])
  })

  it('does not augment in production mode', () => {
    const trustedOrigins = withDevLocalhostTrustedOrigin(undefined, {
      isDev: false,
      isPrerender: false,
      hasExplicitSiteUrl: true,
      env: {
        NITRO_HOST: 'localhost',
        NITRO_PORT: '3000',
      },
    })

    expect(trustedOrigins).toBeUndefined()
  })

  it('does not augment when siteUrl is not explicit', () => {
    const configuredTrustedOrigins = ['https://foo.workers.dev']
    const trustedOrigins = withDevLocalhostTrustedOrigin(configuredTrustedOrigins, {
      isDev: true,
      isPrerender: false,
      hasExplicitSiteUrl: false,
      env: {
        NITRO_HOST: 'localhost',
        NITRO_PORT: '3000',
      },
    })

    expect(trustedOrigins).toBe(configuredTrustedOrigins)
  })
})
