<p align="center">
  <img src="https://raw.githubusercontent.com/onmax/nuxt-better-auth/main/.github/og.png" alt="Nuxt Better Auth" width="100%">
  <br>
  <sub>Design inspired by <a href="https://github.com/HugoRCD">HugoRCD</a>'s work</sub>
</p>

<h1 align="center">@onmax/nuxt-better-auth</h1>

<p align="center">Nuxt module for <a href="https://better-auth.com">Better Auth</a> with auto schema generation, route protection, and session management.</p>

<p align="center">
  <a href="https://npmjs.com/package/@onmax/nuxt-better-auth"><img src="https://img.shields.io/npm/v/@onmax/nuxt-better-auth/latest.svg?style=flat&colorA=020420&colorB=00DC82" alt="npm version"></a>
  <a href="https://npm.chart.dev/@onmax/nuxt-better-auth"><img src="https://img.shields.io/npm/dm/@onmax/nuxt-better-auth.svg?style=flat&colorA=020420&colorB=00DC82" alt="npm downloads"></a>
  <a href="https://npmjs.com/package/@onmax/nuxt-better-auth"><img src="https://img.shields.io/npm/l/@onmax/nuxt-better-auth.svg?style=flat&colorA=020420&colorB=00DC82" alt="License"></a>
  <a href="https://nuxt.com"><img src="https://img.shields.io/badge/Nuxt-020420?logo=nuxt.js" alt="Nuxt"></a>
</p>

> [!WARNING]
> This library is a work in progress and not ready for production use.

Works with [NuxtHub](https://hub.nuxt.com) and future `@nuxt/db`.

## Features

- **Auto Schema Generation** - Generates Drizzle schema from your better-auth plugins
- **Route Protection** - Declarative access rules via `routeRules`
- **Session Management** - SSR-safe session handling with client hydration
- **Role-Based Access** - Support for `admin`, `user`, and custom roles
- **Auto-Imports** - `useUserSession`, `requireUserSession`, `getUserSession`
- **BetterAuthState Component** - Ready-to-use Vue component with slots

## Requirements

- NuxtHub with database enabled (`hub: { database: true }`) or future `@nuxt/db`

## Quick Start

### 1. Install

```bash
pnpm add @onmax/nuxt-better-auth better-auth drizzle-orm @nuxthub/core
```

### 2. Configure Nuxt

```ts
export default defineNuxtConfig({
  modules: ['@nuxthub/core', '@onmax/nuxt-better-auth'],

  hub: { database: true },

  runtimeConfig: {
    betterAuthSecret: '', // BETTER_AUTH_SECRET env var
    public: { siteUrl: 'http://localhost:3000' },
  },

  routeRules: {
    '/app/**': { auth: 'user' },
    '/admin/**': { auth: { role: 'admin' } },
    '/login': { auth: 'guest' },
  },
})
```

### 3. Create Server Config

Create `server/auth.config.ts`:

```ts
import { admin } from 'better-auth/plugins'
import { defineServerAuth } from '@onmax/nuxt-better-auth'

export default defineServerAuth(({ db }) => ({
  appName: 'My App',
  plugins: [admin()],
  emailAndPassword: { enabled: true },
}))
```

> Schema is auto-generated from your plugins! No manual Drizzle schema needed.

### 4. Create Client Config

Create `app/auth.client.ts`:

```ts
import { adminClient } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/vue'

export function createAppAuthClient(baseURL: string) {
  return createAuthClient({
    baseURL,
    plugins: [adminClient()],
  })
}

export type AppAuthClient = ReturnType<typeof createAppAuthClient>
```

### 5. Add Type Extensions

Create `shared/types/auth.d.ts`:

```ts
import '#nuxt-better-auth'

declare module '#nuxt-better-auth' {
  interface AuthUser {
    role?: string | null
    banned?: boolean | null
  }
}
```

## Route Rules

| Option | Type | Description |
|--------|------|-------------|
| `auth` | `false \| 'guest' \| 'user' \| { role: string }` | Auth requirement |

Examples:
- `auth: false` - Public (default)
- `auth: 'guest'` - Only unauthenticated users
- `auth: 'user'` - Any authenticated user
- `auth: { role: 'admin' }` - Requires specific role

## Composables

### `useUserSession()`

```ts
const { user, session, loggedIn, ready, client } = useUserSession()
```

### `<BetterAuthState>`

```vue
<BetterAuthState>
  <template #default="{ loggedIn, user, signOut }">
    <p v-if="loggedIn">Welcome, {{ user?.name }}</p>
    <p v-else>Not logged in</p>
  </template>
  <template #placeholder>
    <p>Loading...</p>
  </template>
</BetterAuthState>
```

## Server Utils

```ts
// Require auth
const { user, session } = await requireUserSession(event)

// Require admin
const { user } = await requireUserSession(event, { role: 'admin' })

// Optional session
const session = await getUserSession(event)
```

## Module Aliases

| Alias | Points To |
|-------|-----------|
| `#auth/server` | `server/auth.config.ts` |
| `#auth/client` | `app/auth.client.ts` |
| `#nuxt-better-auth` | Module type augmentation |

## Development

```bash
pnpm install
pnpm dev:prepare
pnpm dev
```

## License

MIT
