import { createDatabase, db } from '#auth/database'
import { createSecondaryStorage } from '#auth/secondary-storage'
import createServerAuth from '#auth/server'
import { betterAuth } from 'better-auth'
import { getRequestURL } from 'h3'
import { useEvent, useRuntimeConfig } from 'nitropack/runtime'

type AuthInstance = ReturnType<typeof betterAuth>
let _auth: AuthInstance | undefined

function getBaseURL(siteUrl?: string): string {
  if (siteUrl)
    return siteUrl
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
  const database = createDatabase()
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
