import type { H3Event } from 'h3'
import type { AuthSession, AuthUser, RequireSessionOptions } from '../../types'
import { createError } from 'h3'
import { matchesUser } from '../../utils/match-user'
import { serverAuth } from './auth'

interface FullSession { user: AuthUser, session: AuthSession }

export async function getUserSession(event: H3Event): Promise<FullSession | null> {
  const auth = serverAuth()
  const session = await auth.api.getSession({ headers: event.headers })
  return session as FullSession | null
}

export async function requireUserSession(event: H3Event, options?: RequireSessionOptions): Promise<FullSession> {
  const session = await getUserSession(event)

  if (!session)
    throw createError({ statusCode: 401, statusMessage: 'Authentication required' })

  if (options?.user) {
    if (!matchesUser(session.user, options.user))
      throw createError({ statusCode: 403, statusMessage: 'Access denied' })
  }

  if (options?.rule) {
    const allowed = await options.rule({ user: session.user, session: session.session })
    if (!allowed)
      throw createError({ statusCode: 403, statusMessage: 'Access denied' })
  }

  return session
}
