import type { NextRequest } from "next/server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// Import auth with proper error handling
let authInstance: any

async function getAuth() {
  if (!authInstance) {
    const { auth } = await import("@/lib/auth")
    authInstance = auth
  }
  return authInstance
}

async function handleRequest(request: NextRequest) {
  const auth = await getAuth()
  const handler = auth.handler
  return handler(request)
}

export {
  handleRequest as GET,
  handleRequest as POST,
  handleRequest as PUT,
  handleRequest as PATCH,
  handleRequest as DELETE,
  handleRequest as HEAD,
  handleRequest as OPTIONS,
}
