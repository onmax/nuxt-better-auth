import { createSecondaryStorage } from '#auth/secondary-storage'
import createServerAuth from '#auth/server'
import { useEvent, useRuntimeConfig } from '#imports'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { getRequestURL } from 'h3'

type AuthInstance = ReturnType<typeof betterAuth>
let _auth: AuthInstance | undefined

function getBaseURL(siteUrl?: string): string {
  if (siteUrl)
    return siteUrl

  // Fallback: detect from current request
  try {
    const event = useEvent()
    return getRequestURL(event).origin
  }
  catch {
    return ''
  }
}

export async function serverAuth(): Promise<AuthInstance> {
  if (_auth)
    return _auth

  const runtimeConfig = useRuntimeConfig()
  const authConfig = runtimeConfig.auth as { secondaryStorage?: boolean, useDatabase?: boolean } | undefined
  const hubConfig = runtimeConfig.hub as { db?: { dialect: 'sqlite' | 'postgresql' | 'mysql' } } | undefined

  const useDatabase = authConfig?.useDatabase ?? !!hubConfig?.db
  const dialect = hubConfig?.db?.dialect ?? 'sqlite'

  // Dynamic import hub:db only when using database
  let database: ReturnType<typeof drizzleAdapter> | undefined
  let db: any
  if (useDatabase) {
    const hubDb = await import('hub:db')
    db = hubDb.db
    database = drizzleAdapter(hubDb.db, { provider: dialect, schema: hubDb.schema })
  }

  const userConfig = createServerAuth({ runtimeConfig, db })

  _auth = betterAuth({
    ...userConfig,
    ...(database && { database }),
    secondaryStorage: createSecondaryStorage(),
    secret: runtimeConfig.betterAuthSecret,
    baseURL: getBaseURL(runtimeConfig.public.siteUrl as string | undefined),
  })

  return _auth
}
