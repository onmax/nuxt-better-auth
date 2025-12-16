import { defineEventHandler } from 'h3'
import { useRuntimeConfig } from 'nitropack/runtime'
import { serverAuth } from '../../utils/auth'

export default defineEventHandler(async () => {
  try {
    const auth = await serverAuth()
    const options = auth.options
    const runtimeConfig = useRuntimeConfig()
    const publicAuth = runtimeConfig.public?.auth as { redirects?: { login?: string, guest?: string }, useDatabase?: boolean } | undefined
    const privateAuth = runtimeConfig.auth as { secondaryStorage?: boolean } | undefined

    // Session config with sensible defaults display
    const sessionConfig = options.session || {}
    const expiresInDays = sessionConfig.expiresIn ? Math.round(sessionConfig.expiresIn / 86400) : 7
    const updateAgeDays = sessionConfig.updateAge ? Math.round(sessionConfig.updateAge / 86400) : 1

    return {
      config: {
        // Module config (nuxt.config.ts)
        module: {
          redirects: publicAuth?.redirects || { login: '/login', guest: '/' },
          secondaryStorage: privateAuth?.secondaryStorage ?? false,
          useDatabase: publicAuth?.useDatabase ?? false,
        },
        // Server config (server/auth.config.ts)
        server: {
          baseURL: options.baseURL,
          basePath: options.basePath || '/api/auth',
          socialProviders: Object.keys(options.socialProviders || {}),
          plugins: (options.plugins || []).map((p: any) => p.id || 'unknown'),
          trustedOrigins: options.trustedOrigins || [],
          session: {
            expiresIn: `${expiresInDays} days`,
            updateAge: `${updateAgeDays} days`,
            cookieCache: sessionConfig.cookieCache?.enabled ?? false,
          },
          emailAndPassword: !!options.emailAndPassword,
          rateLimit: options.rateLimit?.enabled ?? false,
          advanced: {
            useSecureCookies: options.advanced?.useSecureCookies ?? 'auto',
            disableCSRFCheck: options.advanced?.disableCSRFCheck ?? false,
          },
        },
      },
    }
  }
  catch (error: any) {
    return { config: null, error: error.message || 'Failed to fetch config' }
  }
})
