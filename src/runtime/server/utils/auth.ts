import type { Auth } from 'better-auth'
import { createDatabase, db } from '#auth/database'
import { createSecondaryStorage } from '#auth/secondary-storage'
import createServerAuth from '#auth/server'
import { betterAuth } from 'better-auth'
import { useRuntimeConfig } from 'nitropack/runtime'

type AuthInstance = Auth<ReturnType<typeof createServerAuth>>

let _auth: AuthInstance | null = null

export function serverAuth(): AuthInstance {
  if (_auth)
    return _auth

  const runtimeConfig = useRuntimeConfig()
  const siteUrl = runtimeConfig.public.siteUrl as string
  if (!siteUrl)
    throw new Error('siteUrl must be configured. Set NUXT_PUBLIC_SITE_URL or configure in nuxt.config.')

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
