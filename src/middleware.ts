import { betterFetch } from "@better-fetch/fetch"
import { NextRequest, NextResponse } from "next/server"

interface SessionUser {
  id: string;
  email: string;
  role?: 'user' | 'admin' | 'super_admin';
}

interface SessionData {
  user: SessionUser;
  session: {
    id: string;
    expiresAt: Date;
  };
}

const publicRoutes = ["/", "/sign-in", "/sign-up"]
const adminRoutes = ["/admin"]

/**
 * Apply security headers to all responses
 */
function addSecurityHeaders(response: NextResponse): NextResponse {
  // ============================================================================
  // CONTENT SECURITY POLICY (CSP)
  // Prevents XSS attacks by restricting resource loading
  // ============================================================================
  const cspHeader = [
    // Default: only allow same-origin resources
    "default-src 'self'",

    // Scripts: allow self + inline (Next.js requires this for dynamic imports)
    // 'unsafe-eval' is required by Next.js for certain runtime evaluations
    // including dynamic imports and some server-side features
    // TODO: Investigate Next.js 14+ alternatives to remove 'unsafe-eval'
     
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",

    // Styles: allow self + inline (Tailwind CSS requires this)
    "style-src 'self' 'unsafe-inline'",

    // Images: allow self, data URIs, and https
    "img-src 'self' data: https:",

    // Fonts: allow self and data URIs
    "font-src 'self' data:",

    // External APIs: only Gemini API
    "connect-src 'self' https://generativelanguage.googleapis.com",

    // Prevent clickjacking
    "frame-ancestors 'none'",

    // Form submission: only to self
    "form-action 'self'",

    // Base tag: only self
    "base-uri 'self'",

    // Object/embed: none (disable Flash, Java applets)
    "object-src 'none'",

    // Media: self only
    "media-src 'self'",

    // Manifest: self only
    "manifest-src 'self'",

    // Worker: self only
    "worker-src 'self'",

    // Require secure transport for XHR/fetch
    "upgrade-insecure-requests",
  ].join('; ')

  response.headers.set('Content-Security-Policy', cspHeader)

  // ============================================================================
  // X-Frame-Options - Prevent clickjacking
  // ============================================================================
  response.headers.set('X-Frame-Options', 'DENY')

  // ============================================================================
  // X-Content-Type-Options - Prevent MIME-sniffing
  // ============================================================================
  response.headers.set('X-Content-Type-Options', 'nosniff')

  // ============================================================================
  // Referrer-Policy - Control referrer information
  // ============================================================================
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')

  // ============================================================================
  // Permissions-Policy - Restrict browser features
  // ============================================================================
  response.headers.set('Permissions-Policy', [
    'geolocation=()',
    'microphone=()',
    'camera=()',
    'payment=()',
    'usb=()',
    'magnetometer=()',
    'gyroscope=()',
    'accelerometer=()',
  ].join(', '))

  // ============================================================================
  // Cross-Origin policies
  // ============================================================================
  response.headers.set('Cross-Origin-Embedder-Policy', 'require-corp')
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin')
  response.headers.set('Cross-Origin-Resource-Policy', 'same-origin')

  // ============================================================================
  // HSTS - Force HTTPS in production
  // ============================================================================
  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    )
  }

  return response
}

function isAdminRoute(pathname: string): boolean {
  return adminRoutes.some(route => pathname.startsWith(route))
}

function isAdmin(user: SessionUser): boolean {
  // Handle undefined role (for sessions created before role field was added)
  if (!user.role) return false
  return user.role === 'admin' || user.role === 'super_admin'
}

export default async function authMiddleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // Allow public routes
  if (publicRoutes.includes(pathname)) {
    const response = NextResponse.next()
    return addSecurityHeaders(response)
  }

  // Check if user has a valid session
  const { data: session } = await betterFetch<SessionData>(
    "/api/auth/get-session",
    {
      baseURL: request.nextUrl.origin,
      headers: {
        cookie: request.headers.get("cookie") || "",
      },
    }
  )

  // If no session and trying to access protected route, redirect to sign-in
  if (!session) {
    const signInUrl = new URL("/sign-in", request.nextUrl.origin)
    signInUrl.searchParams.set("callbackUrl", pathname)
    const response = NextResponse.redirect(signInUrl)
    return addSecurityHeaders(response)
  }

  // Check admin route access - verify role from database via API
  if (isAdminRoute(pathname)) {
    // First try session role, then fall back to database check
    if (!isAdmin(session.user)) {
      // Session doesn't have admin role - check database directly
      const { data: adminCheck } = await betterFetch<{ isAdmin: boolean }>(
        "/api/auth/check-admin",
        {
          baseURL: request.nextUrl.origin,
          headers: {
            cookie: request.headers.get("cookie") || "",
          },
        }
      )

      if (!adminCheck?.isAdmin) {
        const dashboardUrl = new URL("/dashboard", request.nextUrl.origin)
        const response = NextResponse.redirect(dashboardUrl)
        return addSecurityHeaders(response)
      }
    }
  }

  const response = NextResponse.next()
  return addSecurityHeaders(response)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public (public folder)
     */
    "/((?!api|_next/static|_next/image|favicon.ico|public).*)",
  ],
}
