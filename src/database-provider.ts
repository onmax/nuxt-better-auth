export type DatabaseProvider = 'none' | 'nuxthub' | 'convex'

export interface ResolveDatabaseProviderInput {
  clientOnly: boolean
  hasHubDb: boolean
  selectedProvider?: DatabaseProvider
}

export interface ResolvedDatabaseProvider {
  provider: DatabaseProvider
}

export function resolveDatabaseProvider(input: ResolveDatabaseProviderInput): ResolvedDatabaseProvider {
  const provider = input.selectedProvider

  if (provider === 'nuxthub') {
    if (!input.hasHubDb) {
      throw new Error('[nuxt-better-auth] auth.database.provider is set to "nuxthub", but @nuxthub/core with hub.db is not configured.')
    }
    return { provider: 'nuxthub' }
  }

  if (provider === 'convex') {
    if (input.clientOnly) {
      throw new Error('[nuxt-better-auth] auth.database.provider "convex" is not available in clientOnly mode.')
    }
    return { provider: 'convex' }
  }

  if (provider === 'none') {
    return { provider: 'none' }
  }

  if (input.hasHubDb) {
    return { provider: 'nuxthub' }
  }

  return { provider: 'none' }
}
