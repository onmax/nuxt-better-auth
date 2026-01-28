import { defineEventHandler, HTTPError, readBody } from 'nitro/h3'
import { z } from 'zod'

const deleteSessionSchema = z.object({
  id: z.string().min(1, 'Session ID required'),
})

export default defineEventHandler(async (event) => {
  try {
    const body = deleteSessionSchema.parse(await readBody(event))

    const { db, schema } = await import('@nuxthub/db')
    if (!schema.session)
      throw new HTTPError('Session table not found', { status: 500 })

    const { eq } = await import('drizzle-orm')
    await db.delete(schema.session).where(eq(schema.session.id, body.id))

    return { success: true }
  }
  catch (error: unknown) {
    if (error instanceof z.ZodError) {
      throw new HTTPError(error.errors[0]?.message || 'Invalid request', { status: 400 })
    }
    console.error('[DevTools] Delete session failed:', error)
    throw new HTTPError('Failed to delete session', { status: 500 })
  }
})
