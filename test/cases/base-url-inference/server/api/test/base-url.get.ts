export default defineEventHandler((event) => {
  const auth = serverAuth(event) as { options?: { baseURL?: string } }
  return { baseURL: auth.options?.baseURL }
})
