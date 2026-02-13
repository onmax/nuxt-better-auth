import { describe, expect, it } from 'vitest'
import { isDevtoolsDatabaseEligible } from '../src/runtime/utils/devtools-database'

describe('isDevtoolsDatabaseEligible', () => {
  it('returns true for nuxthub + module', () => {
    expect(isDevtoolsDatabaseEligible({
      databaseProvider: 'nuxthub',
      databaseSource: 'module',
    })).toBe(true)
  })

  it('returns false for nuxthub + user', () => {
    expect(isDevtoolsDatabaseEligible({
      databaseProvider: 'nuxthub',
      databaseSource: 'user',
    })).toBe(false)
  })

  it('returns false for custom provider + module', () => {
    expect(isDevtoolsDatabaseEligible({
      databaseProvider: 'custom-db',
      databaseSource: 'module',
    })).toBe(false)
  })

  it('returns false for none provider', () => {
    expect(isDevtoolsDatabaseEligible({
      databaseProvider: 'none',
      databaseSource: 'module',
    })).toBe(false)
  })

  it('returns true from fallback nuxthub provider when config is unavailable', () => {
    expect(isDevtoolsDatabaseEligible({
      fallbackModuleProvider: 'nuxthub',
    })).toBe(true)
  })

  it('returns false from fallback none/custom provider', () => {
    expect(isDevtoolsDatabaseEligible({
      fallbackModuleProvider: 'none',
    })).toBe(false)

    expect(isDevtoolsDatabaseEligible({
      fallbackModuleProvider: 'custom-db',
    })).toBe(false)
  })
})
