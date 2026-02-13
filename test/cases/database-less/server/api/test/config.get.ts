import { getDatabaseProvider, getDatabaseSource, serverAuth } from '../../../../../../src/runtime/server/utils/auth'

export default defineEventHandler((event) => {
  serverAuth(event)
  const databaseProvider = getDatabaseProvider()

  return {
    useDatabase: databaseProvider !== 'none',
    databaseProvider,
    databaseSource: getDatabaseSource(),
  }
})
