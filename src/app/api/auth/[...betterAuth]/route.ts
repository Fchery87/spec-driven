import type { NextRequest } from "next/server"
import { logger } from '@/lib/logger';

import { auth } from "@/lib/auth"

const handler = auth.handler

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

async function handleRequest(request: NextRequest) {
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
