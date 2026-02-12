import { describe, expect, it } from 'vitest'
import { resolveDatabaseProvider } from '../src/database-provider'

describe('resolveDatabaseProvider', () => {
  it('returns nuxthub when explicitly selected and available', () => {
    expect(resolveDatabaseProvider({
      clientOnly: false,
      hasHubDb: true,
      selectedProvider: 'nuxthub',
    })).toEqual({ provider: 'nuxthub' })
  })

  it('throws when nuxthub is explicitly selected but hub db is unavailable', () => {
    expect(() => resolveDatabaseProvider({
      clientOnly: false,
      hasHubDb: false,
      selectedProvider: 'nuxthub',
    })).toThrow('@nuxthub/core with hub.db is not configured')
  })

  it('returns convex when explicitly selected in server mode', () => {
    expect(resolveDatabaseProvider({
      clientOnly: false,
      hasHubDb: false,
      selectedProvider: 'convex',
    })).toEqual({ provider: 'convex' })
  })

  it('throws when convex is selected in clientOnly mode', () => {
    expect(() => resolveDatabaseProvider({
      clientOnly: true,
      hasHubDb: false,
      selectedProvider: 'convex',
    })).toThrow('"convex" is not available in clientOnly mode')
  })

  it('returns none when explicitly selected', () => {
    expect(resolveDatabaseProvider({
      clientOnly: false,
      hasHubDb: true,
      selectedProvider: 'none',
    })).toEqual({ provider: 'none' })
  })

  it('auto-selects nuxthub when hub db is available', () => {
    expect(resolveDatabaseProvider({
      clientOnly: false,
      hasHubDb: true,
    })).toEqual({ provider: 'nuxthub' })
  })

  it('auto-selects none when hub db is unavailable', () => {
    expect(resolveDatabaseProvider({
      clientOnly: false,
      hasHubDb: false,
    })).toEqual({ provider: 'none' })
  })
})
