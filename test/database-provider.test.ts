import { describe, expect, it } from 'vitest'
import { resolveDatabaseProvider } from '../src/database-provider'

describe('resolveDatabaseProvider', () => {
  it('returns nuxthub when explicitly selected and available', () => {
    expect(resolveDatabaseProvider({
      clientOnly: false,
      hasHubDb: true,
      hasConvexModule: false,
      convexUrl: '',
      selectedProvider: 'nuxthub',
    })).toEqual({ provider: 'nuxthub', convexUrl: '' })
  })

  it('throws when nuxthub is explicitly selected but hub db is unavailable', () => {
    expect(() => resolveDatabaseProvider({
      clientOnly: false,
      hasHubDb: false,
      hasConvexModule: false,
      convexUrl: '',
      selectedProvider: 'nuxthub',
    })).toThrow('@nuxthub/core with hub.db is not configured')
  })

  it('returns convex when explicitly selected with valid context', () => {
    expect(resolveDatabaseProvider({
      clientOnly: false,
      hasHubDb: false,
      hasConvexModule: true,
      convexUrl: 'https://example.convex.cloud',
      selectedProvider: 'convex',
    })).toEqual({ provider: 'convex', convexUrl: 'https://example.convex.cloud' })
  })

  it('throws when convex is selected in clientOnly mode', () => {
    expect(() => resolveDatabaseProvider({
      clientOnly: true,
      hasHubDb: false,
      hasConvexModule: true,
      convexUrl: 'https://example.convex.cloud',
      selectedProvider: 'convex',
    })).toThrow('"convex" is not available in clientOnly mode')
  })

  it('throws when convex is selected but module is missing', () => {
    expect(() => resolveDatabaseProvider({
      clientOnly: false,
      hasHubDb: false,
      hasConvexModule: false,
      convexUrl: 'https://example.convex.cloud',
      selectedProvider: 'convex',
    })).toThrow('nuxt-convex is not installed')
  })

  it('throws when convex is selected and URL is missing', () => {
    expect(() => resolveDatabaseProvider({
      clientOnly: false,
      hasHubDb: false,
      hasConvexModule: true,
      convexUrl: '',
      selectedProvider: 'convex',
    })).toThrow('no Convex URL was found')
  })

  it('returns none when explicitly selected', () => {
    expect(resolveDatabaseProvider({
      clientOnly: false,
      hasHubDb: true,
      hasConvexModule: true,
      convexUrl: 'https://example.convex.cloud',
      selectedProvider: 'none',
    })).toEqual({ provider: 'none', convexUrl: '' })
  })

  it('auto-selects nuxthub when hub db is available', () => {
    expect(resolveDatabaseProvider({
      clientOnly: false,
      hasHubDb: true,
      hasConvexModule: false,
      convexUrl: '',
    })).toEqual({ provider: 'nuxthub', convexUrl: '' })
  })

  it('auto-selects none when hub db is unavailable', () => {
    expect(resolveDatabaseProvider({
      clientOnly: false,
      hasHubDb: false,
      hasConvexModule: true,
      convexUrl: 'https://example.convex.cloud',
    })).toEqual({ provider: 'none', convexUrl: '' })
  })
})
