import { configDefaults, defineConfig } from 'vitest/config'

const integrationTests = [
  'test/module.test.ts',
  'test/no-db.test.ts',
  'test/no-hub.test.ts',
  'test/dev-trusted-origins.test.ts',
  'test/server-auth-base-url-cache.test.ts',
]

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: ['test/**/*.test.ts'],
          exclude: [...configDefaults.exclude, ...integrationTests],
        },
      },
      {
        test: {
          name: 'integration',
          include: integrationTests,
          fileParallelism: false,
          hookTimeout: 180_000,
          sequence: {
            groupOrder: 1,
          },
        },
      },
    ],
  },
})
