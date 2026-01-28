import type { AuthMeta, AuthMode, AuthRouteRules } from '../../types'
import { getRouteRules } from 'nitro/app'
import { defineEventHandler, getRequestURL, HTTPError } from 'nitro/h3'
import { matchesUser } from '../../utils/match-user'
import { getUserSession, requireUserSession } from '../utils/session'

export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname

  if (!path.startsWith('/api/'))
    return

  if (path.startsWith('/api/auth/'))
    return

  const rules = getRouteRules(event.req.method!, path) as AuthRouteRules
  if (!rules.auth)
    return

  const auth: AuthMeta = rules.auth
  const mode: AuthMode = typeof auth === 'string' ? auth : auth?.only ?? 'user'

  if (mode === 'guest') {
    const session = await getUserSession(event)
    if (session)
      throw new HTTPError('Authenticated users not allowed', { status: 403 })
    return
  }

  if (mode === 'user') {
    const session = await requireUserSession(event)

    if (typeof auth === 'object' && auth.user) {
      if (!matchesUser(session.user, auth.user))
        throw new HTTPError('Access denied', { status: 403 })
    }
  }
})
