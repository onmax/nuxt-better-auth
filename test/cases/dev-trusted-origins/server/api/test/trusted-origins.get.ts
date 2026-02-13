export default defineEventHandler(async (event) => {
  const auth = serverAuth(event) as {
    $context?: Promise<{ trustedOrigins?: string[] }> | { trustedOrigins?: string[] }
  }
  const authContext = await auth.$context

  return {
    trustedOrigins: authContext?.trustedOrigins || [],
  }
})
