import { describe, expect, it } from 'vitest'

function validateURL(url: string): string {
  try {
    return new URL(url).origin
  }
  catch {
    throw new Error(`Invalid siteUrl: "${url}". Must be a valid URL.`)
  }
}

// Recreate getBaseURL logic for unit testing (not exported from module)
function getBaseURL(config: { public: { siteUrl?: unknown } }, requestURL: string | undefined, env: NodeJS.ProcessEnv, isDev: boolean): string {
  if (config.public.siteUrl && typeof config.public.siteUrl === 'string')
    return validateURL(config.public.siteUrl)

  if (requestURL)
    return requestURL

  if (env.VERCEL_URL)
    return validateURL(`https://${env.VERCEL_URL}`)
  if (env.CF_PAGES_URL)
    return validateURL(`https://${env.CF_PAGES_URL}`)
  if (env.URL)
    return validateURL(env.URL.startsWith('http') ? env.URL : `https://${env.URL}`)

  if (isDev)
    return 'http://localhost:3000'

  throw new Error('siteUrl required. Set NUXT_PUBLIC_SITE_URL.')
}

describe('getBaseURL', () => {
  it('explicit config takes priority', () => {
    expect(getBaseURL({ public: { siteUrl: 'https://explicit.com' } }, 'https://request.com', { VERCEL_URL: 'x.vercel.app' } as NodeJS.ProcessEnv, false)).toBe('https://explicit.com')
  })

  it('requestURL takes priority over platform vars', () => {
    expect(getBaseURL({ public: {} }, 'https://myapp.com', { VERCEL_URL: 'x.vercel.app' } as NodeJS.ProcessEnv, false)).toBe('https://myapp.com')
  })

  it('platform env vars used when no requestURL', () => {
    expect(getBaseURL({ public: {} }, undefined, { VERCEL_URL: 'x.vercel.app' } as NodeJS.ProcessEnv, false)).toBe('https://x.vercel.app')
  })

  it('normalizes URL without protocol', () => {
    expect(getBaseURL({ public: {} }, undefined, { URL: 'my-app.netlify.app' } as NodeJS.ProcessEnv, false)).toBe('https://my-app.netlify.app')
    expect(getBaseURL({ public: {} }, undefined, { URL: 'http://localhost:8888' } as NodeJS.ProcessEnv, false)).toBe('http://localhost:8888')
  })

  it('dev fallback to localhost', () => {
    expect(getBaseURL({ public: {} }, undefined, {} as NodeJS.ProcessEnv, true)).toBe('http://localhost:3000')
  })

  it('throws in production without config', () => {
    expect(() => getBaseURL({ public: {} }, undefined, {} as NodeJS.ProcessEnv, false)).toThrow('siteUrl required')
  })

  it('ignores non-string siteUrl', () => {
    expect(getBaseURL({ public: { siteUrl: 123 } }, undefined, { VERCEL_URL: 'x.vercel.app' } as NodeJS.ProcessEnv, false)).toBe('https://x.vercel.app')
  })

  it('throws on invalid URL format', () => {
    expect(() => getBaseURL({ public: { siteUrl: 'not-a-url' } }, undefined, {} as NodeJS.ProcessEnv, false)).toThrow('Invalid siteUrl')
  })
})
