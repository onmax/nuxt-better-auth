import type { NitroRouteRules } from 'nitropack/types'

// Re-export augmentable types
export type { AuthSession, AuthUser, UserSessionComposable } from './types/augment'

export type RoleName = string
export type AuthMode = 'guest' | 'user'

// Route auth meta
export type AuthMeta = false | AuthMode | {
  only?: AuthMode
  redirectTo?: string
  role?: RoleName | RoleName[]
}

// Route rules with auth
export type AuthRouteRules = NitroRouteRules & {
  auth?: AuthMeta
  role?: RoleName | RoleName[]
}
