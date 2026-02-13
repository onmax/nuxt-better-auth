import { defineEventHandler, getQuery } from 'h3'
import { isDevtoolsDatabaseEligible } from '../../../utils/devtools-database'
import { getDatabaseProvider, getDatabaseSource } from '../../utils/auth'
import { paginationQuerySchema, sanitizeSearchPattern } from './_schema'

export default defineEventHandler(async (event) => {
  try {
    const databaseProvider = getDatabaseProvider()
    const databaseSource = getDatabaseSource()
    if (!isDevtoolsDatabaseEligible({ databaseProvider, databaseSource })) {
      return {
        users: [],
        total: 0,
        error: 'DevTools DB routes are only available for module-managed nuxthub database mode.',
      }
    }

    const { db, schema } = await import('@nuxthub/db')
    if (!schema.user)
      return { users: [], total: 0, error: 'User table not found' }

    const query = paginationQuerySchema.parse(getQuery(event))
    const { page, limit, search } = query
    const offset = (page - 1) * limit

    const { count, like, or, desc } = await import('drizzle-orm')

    let dbQuery = db.select().from(schema.user)
    let countQuery = db.select({ count: count() }).from(schema.user)

    if (search) {
      const pattern = sanitizeSearchPattern(search)
      const searchCondition = or(
        like(schema.user.name, pattern),
        like(schema.user.email, pattern),
      )
      if (searchCondition) {
        dbQuery = dbQuery.where(searchCondition) as typeof dbQuery
        countQuery = countQuery.where(searchCondition) as typeof countQuery
      }
    }

    const [users, totalResult] = await Promise.all([
      dbQuery.orderBy(desc(schema.user.createdAt)).limit(limit).offset(offset),
      countQuery,
    ])

    return { users, total: totalResult[0]?.count ?? 0, page, limit }
  }
  catch (error: unknown) {
    console.error('[DevTools] Fetch users failed:', error)
    return { users: [], total: 0, error: 'Failed to fetch users' }
  }
})
