// Augment AuthUser with plugin fields (admin, twoFactor)
declare module '#nuxt-better-auth' {
  interface AuthUser {
    role?: 'user' | 'admin'
    twoFactorEnabled?: boolean
  }
}

export {}
