import type { AuthMeta, AuthMode, AuthRouteRules } from '../../types'
import { createError, defineNuxtRouteMiddleware, getRouteRules, navigateTo, useRequestHeaders, useRuntimeConfig } from '#imports'
import { matchesUser } from '../../utils/match-user'

declare module '#app' {
  interface PageMeta {
    auth?: AuthMeta
  }
}

declare module 'vue-router' {
  interface RouteMeta {
    auth?: AuthMeta
  }
}

export default defineNuxtRouteMiddleware(async (to) => {
  // Runtime fallback: resolve auth from route rules if not set at build-time
  // This handles dynamic catch-all routes where build-time can't match specific paths
  if (to.meta.auth === undefined) {
    const rules = await getRouteRules({ path: to.path }) as AuthRouteRules
    if (rules.auth !== undefined)
      to.meta.auth = rules.auth
  }

  const auth = to.meta.auth as AuthMeta | undefined

  if (auth === undefined || auth === false)
    return

  const config = useRuntimeConfig().public.auth as { redirects: { login: string, guest: string } } | undefined
  const { fetchSession, user, loggedIn } = useUserSession()

  // Always fetch session if not logged in - state may not have synced yet
  if (!loggedIn.value) {
    const headers = import.meta.server ? useRequestHeaders(['cookie']) : undefined
    await fetchSession({ headers })
  }

  const mode: AuthMode = typeof auth === 'string' ? auth : auth?.only ?? 'user'
  const redirectTo = typeof auth === 'object' ? auth.redirectTo : undefined

  if (mode === 'guest') {
    if (loggedIn.value)
      return navigateTo(redirectTo ?? config?.redirects?.guest ?? '/')
    return
  }

  if (!loggedIn.value)
    return navigateTo(redirectTo ?? config?.redirects?.login ?? '/login')

  if (typeof auth === 'object' && auth.user) {
    if (!user.value || !matchesUser(user.value, auth.user))
      throw createError({ statusCode: 403, statusMessage: 'Access denied' })
  }
})
