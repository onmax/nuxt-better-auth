export type DatabaseProvider = 'none' | 'nuxthub' | 'convex'

export interface ResolveDatabaseProviderInput {
  clientOnly: boolean
  hasHubDb: boolean
  hasConvexModule: boolean
  convexUrl: string
  selectedProvider?: DatabaseProvider
}

export interface ResolvedDatabaseProvider {
  provider: DatabaseProvider
  convexUrl: string
}

export function resolveDatabaseProvider(input: ResolveDatabaseProviderInput): ResolvedDatabaseProvider {
  const provider = input.selectedProvider

  if (provider === 'nuxthub') {
    if (!input.hasHubDb) {
      throw new Error('[nuxt-better-auth] auth.database.provider is set to "nuxthub", but @nuxthub/core with hub.db is not configured.')
    }
    return { provider: 'nuxthub', convexUrl: '' }
  }

  if (provider === 'convex') {
    if (input.clientOnly) {
      throw new Error('[nuxt-better-auth] auth.database.provider "convex" is not available in clientOnly mode.')
    }
    if (!input.hasConvexModule) {
      throw new Error('[nuxt-better-auth] auth.database.provider is set to "convex", but nuxt-convex is not installed.')
    }
    if (!input.convexUrl) {
      throw new Error('[nuxt-better-auth] auth.database.provider is set to "convex", but no Convex URL was found. Set auth.database.convexUrl, convex.url, runtimeConfig.public.convex.url, CONVEX_URL, or NUXT_PUBLIC_CONVEX_URL.')
    }
    return { provider: 'convex', convexUrl: input.convexUrl }
  }

  if (provider === 'none') {
    return { provider: 'none', convexUrl: '' }
  }

  if (input.hasHubDb) {
    return { provider: 'nuxthub', convexUrl: '' }
  }

  return { provider: 'none', convexUrl: '' }
}
