import type { AuthSession, AuthUser } from '#nuxt-better-auth'
import type { ComputedRef, Ref } from 'vue'
import getClientConfig from '#auth/client'
import { computed, nextTick, useRequestHeaders, useRequestURL, useRuntimeConfig, useState, watch } from '#imports'
import { createAuthClient } from 'better-auth/vue'

type AuthClient = ReturnType<typeof createAuthClient>

export interface SignOutOptions { onSuccess?: () => void | Promise<void> }

export interface UseUserSessionReturn {
  client: AuthClient | null
  session: Ref<AuthSession | null>
  user: Ref<AuthUser | null>
  loggedIn: ComputedRef<boolean>
  ready: ComputedRef<boolean>
  signIn: NonNullable<AuthClient>['signIn']
  signUp: NonNullable<AuthClient>['signUp']
  signOut: (options?: SignOutOptions) => Promise<void>
  waitForSession: () => Promise<void>
  fetchSession: (options?: { headers?: HeadersInit, force?: boolean }) => Promise<void>
  updateUser: (updates: Partial<AuthUser>) => void
}

// Singleton client instance to ensure consistent state across all useUserSession calls
let _client: AuthClient | null = null
function getClient(baseURL: string): AuthClient {
  if (!_client) {
    const config = getClientConfig(baseURL)
    _client = createAuthClient(config)
  }
  return _client!
}

export function useUserSession(): UseUserSessionReturn {
  const runtimeConfig = useRuntimeConfig()
  const requestURL = useRequestURL()

  // Client only - create better-auth client for client-side operations (singleton)
  const client: AuthClient | null = import.meta.client
    ? getClient((runtimeConfig.public.siteUrl as string) || requestURL.origin)
    : null

  // Shared state via useState for SSR hydration
  const session = useState<AuthSession | null>('auth:session', () => null)
  const user = useState<AuthUser | null>('auth:user', () => null)
  const authReady = useState('auth:ready', () => false)
  const ready = computed(() => authReady.value)
  const loggedIn = computed(() => Boolean(session.value && user.value))

  function clearSession() {
    session.value = null
    user.value = null
  }

  function updateUser(updates: Partial<AuthUser>) {
    if (user.value)
      user.value = { ...user.value, ...updates }
  }

  // On client, subscribe to better-auth's reactive session store
  // This auto-updates when signIn/signUp/signOut triggers the session signal
  if (import.meta.client && client) {
    const clientSession = client.useSession()

    // Sync better-auth's reactive session to our useState
    watch(
      () => clientSession.value,
      (newSession) => {
        if (newSession?.data?.session && newSession?.data?.user) {
          // Filter out sensitive token field
          const { token: _, ...safeSession } = newSession.data.session as AuthSession & { token?: string }
          session.value = safeSession as AuthSession
          user.value = newSession.data.user as AuthUser
        }
        else if (!newSession?.isPending) {
          clearSession()
        }
        if (!authReady.value && !newSession?.isPending)
          authReady.value = true
      },
      { immediate: true, deep: true },
    )
  }

  function waitForSession(): Promise<void> {
    return new Promise((resolve) => {
      if (loggedIn.value) {
        resolve()
        return
      }
      const unwatch = watch(loggedIn, (isLoggedIn) => {
        if (isLoggedIn) {
          unwatch()
          resolve()
        }
      })
      // Timeout fallback to prevent hanging
      setTimeout(() => {
        unwatch()
        resolve()
      }, 5000)
    })
  }

  // Wrap signIn methods to wait for session sync before calling onSuccess
  type SignIn = NonNullable<AuthClient>['signIn']
  type SignUp = NonNullable<AuthClient>['signUp']

  // Wraps onSuccess callback to sync session before executing
  function wrapOnSuccess(cb: (ctx: unknown) => void | Promise<void>) {
    return async (ctx: unknown) => {
      await fetchSession({ force: true })
      if (!loggedIn.value)
        await waitForSession()
      await nextTick()
      await cb(ctx)
    }
  }

  function wrapAuthMethod<T extends (...args: unknown[]) => Promise<unknown>>(method: T): T {
    return (async (...args: unknown[]) => {
      const [data, options] = args as [Record<string, any> | undefined, Record<string, any> | undefined]

      // Passkey pattern: onSuccess in data.fetchOptions
      if (data?.fetchOptions?.onSuccess) {
        return method({ ...data, fetchOptions: { ...data.fetchOptions, onSuccess: wrapOnSuccess(data.fetchOptions.onSuccess) } }, options)
      }
      // Email/social pattern: onSuccess in options
      if (options?.onSuccess) {
        return method(data, { ...options, onSuccess: wrapOnSuccess(options.onSuccess) })
      }
      return method(data, options)
    }) as T
  }

  const signIn: SignIn = client?.signIn
    ? new Proxy(client.signIn, {
        get(target, prop) {
          const targetRecord = target as Record<string | symbol, unknown>
          const method = targetRecord[prop]
          if (typeof method !== 'function')
            return method
          // Don't bind - call through target to preserve better-auth's Proxy context
          return wrapAuthMethod((...args: unknown[]) => (targetRecord[prop] as (...a: unknown[]) => Promise<unknown>)(...args))
        },
      })
    : new Proxy({} as SignIn, {
        get: (_, prop) => { throw new Error(`signIn.${String(prop)}() can only be called on client-side`) },
      })

  const signUp: SignUp = client?.signUp
    ? new Proxy(client.signUp, {
        get(target, prop) {
          const targetRecord = target as Record<string | symbol, unknown>
          const method = targetRecord[prop]
          if (typeof method !== 'function')
            return method
          // Don't bind - call through target to preserve better-auth's Proxy context
          return wrapAuthMethod((...args: unknown[]) => (targetRecord[prop] as (...a: unknown[]) => Promise<unknown>)(...args))
        },
      })
    : new Proxy({} as SignUp, {
        get: (_, prop) => { throw new Error(`signUp.${String(prop)}() can only be called on client-side`) },
      })

  async function fetchSession(options: { headers?: HeadersInit, force?: boolean } = {}) {
    // On server, session is already fetched by server middleware - nothing to do
    if (import.meta.server) {
      if (!authReady.value)
        authReady.value = true
      return
    }

    if (client) {
      try {
        const headers = options.headers || useRequestHeaders(['cookie'])
        const fetchOptions = headers ? { headers } : undefined
        const query = options.force ? { disableCookieCache: true } : undefined
        const result = await client.getSession({ query }, fetchOptions)
        const data = result.data as { session: AuthSession & { token?: string }, user: AuthUser } | null

        if (data?.session && data?.user) {
          // Filter out sensitive token field
          const { token: _, ...safeSession } = data.session
          session.value = safeSession as AuthSession
          user.value = data.user
        }
        else {
          clearSession()
        }
      }
      catch (error) {
        clearSession()
        console.error('[nuxt-better-auth] Failed to fetch session:', error)
      }
      finally {
        if (!authReady.value)
          authReady.value = true
      }
    }
  }

  async function signOut(options?: SignOutOptions) {
    if (!client)
      throw new Error('signOut can only be called on client-side')
    await client.signOut()
    clearSession()
    if (options?.onSuccess)
      await options.onSuccess()
  }

  return {
    client,
    session,
    user,
    loggedIn,
    ready,
    signIn,
    signUp,
    signOut,
    waitForSession,
    fetchSession,
    updateUser,
  }
}
