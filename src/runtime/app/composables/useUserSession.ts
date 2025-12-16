import type { AppAuthClient, AuthSession, AuthUser } from '#nuxt-better-auth'
import { createAppAuthClient } from '#auth/client'
import { computed, useRequestHeaders, useRequestURL, useRuntimeConfig, useState, watch } from '#imports'
import { consola } from 'consola'

export interface SignOutOptions { onSuccess?: () => void | Promise<void> }

// Singleton client instance to ensure consistent state across all useUserSession calls
let _client: AppAuthClient | null = null
function getClient(baseURL: string): AppAuthClient {
  if (!_client)
    _client = createAppAuthClient(baseURL)
  return _client
}

export function useUserSession() {
  const runtimeConfig = useRuntimeConfig()
  const requestURL = useRequestURL()

  // Client only - create better-auth client for client-side operations (singleton)
  const client: AppAuthClient | null = import.meta.client
    ? getClient(runtimeConfig.public.siteUrl || requestURL.origin)
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
          session.value = newSession.data.session as AuthSession
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
  type SignIn = NonNullable<AppAuthClient>['signIn']
  type SignUp = NonNullable<AppAuthClient>['signUp']

  function wrapAuthMethod<T extends (...args: unknown[]) => Promise<unknown>>(method: T): T {
    return (async (...args: unknown[]) => {
      const [data, options] = args as [unknown, { onSuccess?: (ctx: unknown) => void } | undefined]

      // Check for nested fetchOptions.onSuccess (passkey pattern)
      const dataWithFetch = data as { fetchOptions?: { onSuccess?: (ctx: unknown) => void } } | undefined
      const nestedOnSuccess = dataWithFetch?.fetchOptions?.onSuccess

      // Check for top-level options.onSuccess (email/social pattern)
      const topLevelOnSuccess = options?.onSuccess

      // If no onSuccess callback anywhere, pass through unchanged
      if (!topLevelOnSuccess && !nestedOnSuccess)
        return method(data, options)

      // Wrap nested fetchOptions.onSuccess (passkey)
      if (nestedOnSuccess) {
        const wrappedData = {
          ...dataWithFetch,
          fetchOptions: {
            ...dataWithFetch?.fetchOptions,
            onSuccess: async (ctx: unknown) => {
              await waitForSession()
              await nestedOnSuccess(ctx)
            },
          },
        }
        return method(wrappedData, options)
      }

      // Wrap top-level options.onSuccess (email/social)
      const wrappedOptions = {
        ...options,
        onSuccess: async (ctx: unknown) => {
          await waitForSession()
          await topLevelOnSuccess!(ctx)
        },
      }
      return method(data, wrappedOptions)
    }) as T
  }

  const signIn: SignIn = client?.signIn
    ? new Proxy(client.signIn, {
        get(target, prop) {
          const method = (target as any)[prop]
          if (typeof method !== 'function')
            return method
          // Don't bind - call through target to preserve better-auth's Proxy context
          return wrapAuthMethod((...args: unknown[]) => (target as any)[prop](...args))
        },
      })
    : new Proxy({} as SignIn, {
        get: (_, prop) => { throw new Error(`signIn.${String(prop)}() can only be called on client-side`) },
      })

  const signUp: SignUp = client?.signUp
    ? new Proxy(client.signUp, {
        get(target, prop) {
          const method = (target as any)[prop]
          if (typeof method !== 'function')
            return method
          // Don't bind - call through target to preserve better-auth's Proxy context
          return wrapAuthMethod((...args: unknown[]) => (target as any)[prop](...args))
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
        const result = await client.getSession({}, fetchOptions)
        const data = result.data as { session: AuthSession, user: AuthUser } | null

        if (data?.session && data?.user) {
          session.value = data.session
          user.value = data.user
        }
        else {
          clearSession()
        }
      }
      catch (error) {
        clearSession()
        if (import.meta.dev)
          consola.error('Failed to fetch auth session:', error)
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
    const response = await client.signOut()
    clearSession()
    if (options?.onSuccess)
      await options.onSuccess()
    return response
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
    fetchSession,
    updateUser,
  }
}
