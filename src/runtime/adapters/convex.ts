import type { Where } from 'better-auth/types'
import type { FunctionReference } from 'convex/server'
import { createAdapterFactory } from 'better-auth/adapters'
import { ConvexHttpClient } from 'convex/browser'

// Placeholder type - Convex generates actual table names dynamically in user's schema
type TableNames = string

interface ConvexCleanedWhere {
  field: string
  value: string | number | boolean | string[] | number[] | null
  operator?: 'lt' | 'lte' | 'gt' | 'gte' | 'eq' | 'in' | 'not_in' | 'ne' | 'contains' | 'starts_with' | 'ends_with'
  connector?: 'AND' | 'OR'
}

function parseWhere(where?: Where | Where[]): ConvexCleanedWhere[] {
  if (!where)
    return []
  const whereArray = Array.isArray(where) ? where : [where]
  return whereArray.map((w) => {
    if (w.value instanceof Date)
      return { ...w, value: w.value.getTime() } as ConvexCleanedWhere
    return w as ConvexCleanedWhere
  })
}

interface PaginationResult<T> {
  page: T[]
  isDone: boolean
  continueCursor: string | null
  splitCursor?: string
  pageStatus?: 'SplitRecommended' | 'SplitRequired' | string
  count?: number
}

async function handlePagination<T>(
  next: (opts: { paginationOpts: { numItems: number, cursor: string | null } }) => Promise<PaginationResult<T> & { count?: number }>,
  { limit }: { limit?: number } = {},
): Promise<{ docs: T[], count: number }> {
  const state: { isDone: boolean, cursor: string | null, docs: T[], count: number } = { isDone: false, cursor: null, docs: [], count: 0 }

  const onResult = (result: PaginationResult<T> & { count?: number }) => {
    state.cursor = result.pageStatus === 'SplitRecommended' || result.pageStatus === 'SplitRequired'
      ? (result.splitCursor ?? result.continueCursor)
      : result.continueCursor
    if (result.page) {
      state.docs.push(...result.page)
      state.isDone = (limit && state.docs.length >= limit) || result.isDone
      return
    }
    if (result.count) {
      state.count += result.count
      state.isDone = (limit && state.count >= limit) || result.isDone
      return
    }
    state.isDone = result.isDone
  }

  do {
    const result = await next({
      paginationOpts: {
        numItems: Math.min(200, (limit ?? 200) - state.docs.length, 200),
        cursor: state.cursor,
      },
    })
    onResult(result)
  } while (!state.isDone)

  return state
}

interface ConvexAuthApi {
  create: FunctionReference<'mutation', 'public', { input: { model: string, data: Record<string, unknown> }, select?: string[] }, unknown>
  findOne: FunctionReference<'query', 'public', { model: string, where?: ConvexCleanedWhere[], select?: string[] }, unknown>
  findMany: FunctionReference<'query', 'public', { model: string, where?: ConvexCleanedWhere[], limit?: number, sortBy?: { direction: 'asc' | 'desc', field: string }, paginationOpts: { numItems: number, cursor: string | null } }, PaginationResult<unknown>>
  updateOne: FunctionReference<'mutation', 'public', { input: { model: string, where?: ConvexCleanedWhere[], update: Record<string, unknown> } }, unknown>
  updateMany: FunctionReference<'mutation', 'public', { input: { model: string, where?: ConvexCleanedWhere[], update: Record<string, unknown> }, paginationOpts: { numItems: number, cursor: string | null } }, PaginationResult<unknown> & { count: number }>
  deleteOne: FunctionReference<'mutation', 'public', { input: { model: string, where?: ConvexCleanedWhere[] } }, unknown>
  deleteMany: FunctionReference<'mutation', 'public', { input: { model: string, where?: ConvexCleanedWhere[] }, paginationOpts: { numItems: number, cursor: string | null } }, PaginationResult<unknown> & { count: number }>
}

export interface ConvexHttpAdapterOptions {
  /** Convex deployment URL (e.g., https://your-app.convex.cloud) */
  url: string
  /** Convex API functions for auth operations - import from your convex/_generated/api */
  api: ConvexAuthApi
  /** Enable debug logging for adapter operations */
  debugLogs?: boolean
}

/**
 * Creates a Better Auth adapter that communicates with Convex via HTTP.
 * Uses ConvexHttpClient for server-side auth operations.
 *
 * @example
 * ```ts
 * import { api } from '~/convex/_generated/api'
 *
 * export default defineServerAuth(() => ({
 *   database: createConvexHttpAdapter({
 *     url: process.env.CONVEX_URL!,
 *     api: api.auth,
 *   }),
 * }))
 * ```
 *
 * @limitations
 * - `update()` only supports AND-connected where clauses (no OR support)
 * - `count()` fetches all documents client-side (Convex limitation)
 * - `offset` pagination not supported in `findMany()`
 */
export function createConvexHttpAdapter(options: ConvexHttpAdapterOptions) {
  if (!options.url.startsWith('https://') || !options.url.includes('.convex.')) {
    throw new Error(`Invalid Convex URL: ${options.url}. Expected format: https://your-app.convex.cloud`)
  }

  const client = new ConvexHttpClient(options.url)

  return createAdapterFactory({
    config: {
      adapterId: 'convex-http',
      adapterName: 'Convex HTTP Adapter',
      debugLogs: options.debugLogs ?? false,
      disableIdGeneration: true,
      transaction: false,
      supportsNumericIds: false,
      supportsJSON: false,
      supportsDates: false,
      supportsArrays: true,
      usePlural: false,
      mapKeysTransformInput: { id: '_id' },
      mapKeysTransformOutput: { _id: 'id' },
      customTransformInput: ({ data, fieldAttributes }) => {
        if (data && fieldAttributes.type === 'date')
          return new Date(data as string | number | Date).getTime()
        return data
      },
      customTransformOutput: ({ data, fieldAttributes }) => {
        if (data && fieldAttributes.type === 'date')
          return new Date(data as number).getTime()
        return data
      },
    },
    adapter: ({ options: authOptions }) => {
      // Disable telemetry - HTTP adapter cannot reliably send telemetry from edge/serverless
      authOptions.telemetry = { enabled: false }
      return {
        id: 'convex-http',

        create: async ({ model, data, select }): Promise<unknown> => {
          return client.mutation(options.api.create, {
            input: { model: model as TableNames, data },
            select,
          })
        },

        findOne: async (data): Promise<unknown> => {
          if (data.where?.every((w: Where) => w.connector === 'OR')) {
            for (const w of data.where) {
              const result = await client.query(options.api.findOne, {
                ...data,
                model: data.model as TableNames,
                where: parseWhere(w),
              })
              if (result)
                return result
            }
            return null
          }
          return client.query(options.api.findOne, {
            ...data,
            model: data.model as TableNames,
            where: parseWhere(data.where),
          })
        },

        findMany: async (data): Promise<unknown[]> => {
          if (data.offset)
            throw new Error('offset not supported')

          if (data.where?.some((w: Where) => w.connector === 'OR')) {
            const results = await Promise.all(
              data.where.map(async (w: Where) =>
                handlePagination(async ({ paginationOpts }) => {
                  return client.query(options.api.findMany, {
                    ...data,
                    model: data.model as TableNames,
                    where: parseWhere(w),
                    paginationOpts,
                  })
                }, { limit: data.limit }),
              ),
            )
            const allDocs = results.flatMap(r => r.docs)
            const uniqueDocs = [...new Map(allDocs.map((d: unknown) => [(d as { _id: string })._id, d])).values()]
            if (data.sortBy) {
              return uniqueDocs.sort((a, b) => {
                const aVal = (a as Record<string, unknown>)[data.sortBy!.field]
                const bVal = (b as Record<string, unknown>)[data.sortBy!.field]
                const cmp = aVal! < bVal! ? -1 : aVal! > bVal! ? 1 : 0
                return data.sortBy!.direction === 'asc' ? cmp : -cmp
              })
            }
            return uniqueDocs
          }

          const result = await handlePagination(
            async ({ paginationOpts }) => client.query(options.api.findMany, {
              ...data,
              model: data.model as TableNames,
              where: parseWhere(data.where),
              paginationOpts,
            }),
            { limit: data.limit },
          )
          return result.docs
        },

        // Note: Convex doesn't have a native count query, so we fetch all docs and count client-side.
        // This is inefficient for large datasets but acceptable for auth tables (typically small).
        count: async (data): Promise<number> => {
          if (data.where?.some((w: Where) => w.connector === 'OR')) {
            const results = await Promise.all(
              data.where.map(async (w: Where) =>
                handlePagination(async ({ paginationOpts }) => {
                  return client.query(options.api.findMany, {
                    ...data,
                    model: data.model as TableNames,
                    where: parseWhere(w),
                    paginationOpts,
                  })
                }),
              ),
            )
            const allDocs = results.flatMap(r => r.docs)
            const uniqueDocs = [...new Map(allDocs.map((d: unknown) => [(d as { _id: string })._id, d])).values()]
            return uniqueDocs.length
          }

          const result = await handlePagination(async ({ paginationOpts }) => client.query(options.api.findMany, {
            ...data,
            model: data.model as TableNames,
            where: parseWhere(data.where),
            paginationOpts,
          }))
          return result.docs.length
        },

        // Supports single eq or multiple AND-connected conditions (Better Auth's common patterns)
        update: async (data): Promise<unknown> => {
          const hasOrConnector = data.where?.some((w: Where) => w.connector === 'OR')
          if (hasOrConnector) {
            throw new Error('update() does not support OR conditions - use updateMany() or split into multiple calls')
          }
          return client.mutation(options.api.updateOne, {
            input: {
              model: data.model as TableNames,
              where: parseWhere(data.where),
              update: data.update as Record<string, unknown>,
            },
          })
        },

        updateMany: async (data): Promise<number> => {
          const result = await handlePagination(async ({ paginationOpts }) => client.mutation(options.api.updateMany, {
            input: {
              ...data,
              model: data.model as TableNames,
              where: parseWhere(data.where),
            },
            paginationOpts,
          }))
          return result.count
        },

        delete: async (data): Promise<void> => {
          await client.mutation(options.api.deleteOne, {
            input: {
              model: data.model as TableNames,
              where: parseWhere(data.where),
            },
          })
        },

        deleteMany: async (data): Promise<number> => {
          const result = await handlePagination(async ({ paginationOpts }) => client.mutation(options.api.deleteMany, {
            input: {
              ...data,
              model: data.model as TableNames,
              where: parseWhere(data.where),
            },
            paginationOpts,
          }))
          return result.count
        },
      }
    },
  })
}
