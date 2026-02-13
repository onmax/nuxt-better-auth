import type { AuthUser } from '#nuxt-better-auth'

const user: AuthUser = {
  id: '1',
  createdAt: new Date(),
  updatedAt: new Date(),
  email: 'a@b.c',
  emailVerified: false,
  name: 'n',
  role: 'admin',
  internalCode: 'x',
}

void user
