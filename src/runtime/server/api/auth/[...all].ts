import type { H3Event } from 'h3'
import { defineEventHandler, toWebRequest } from 'h3'

export default defineEventHandler((event: H3Event) => {
  return serverAuth().handler(toWebRequest(event))
})
