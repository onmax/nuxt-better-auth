import { getDatabaseProvider, getDatabaseSource, serverAuth } from '../../../../../../src/runtime/server/utils/auth'

export default defineEventHandler((event) => {
  serverAuth(event)
  const runtimeConfig = useRuntimeConfig()
  const auth = runtimeConfig.public.auth as { useDatabase?: boolean, databaseProvider?: string, databaseSource?: 'module' | 'user' } | undefined

  return {
    useDatabase: auth?.useDatabase ?? false,
    databaseProvider: getDatabaseProvider(),
    databaseSource: getDatabaseSource(),
  }
})
