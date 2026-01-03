/**
 * Authentication Middleware
 *
 * Middleware for protecting API routes with JWT authentication
 * Can be used in Next.js API routes or middleware
 */

import { NextRequest, NextResponse } from 'next/server';
import { jwtService, JWTPayload } from '@/backend/services/auth/jwt_service';
import { logger } from '@/lib/logger';
import { formatErrorResponse, AppError } from '@/backend/lib/error_handler';

export interface AuthenticatedRequest extends NextRequest {
  user?: JWTPayload;
}

/**
 * Extract JWT token from request headers
 * Looks for Authorization: Bearer <token>
 */
export function extractToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
}

/**
 * Middleware to authenticate requests
 * Returns null if authenticated, NextResponse with error if not
 */
export function authenticateRequest(
  request: NextRequest
): { user: JWTPayload } | { error: NextResponse } {
  const token = extractToken(request);

  if (!token) {
    return {
      error: NextResponse.json(
        { success: false, message: 'Missing authentication token' },
        { status: 401 }
      )
    };
  }

  const payload = jwtService.verifyToken(token);

  if (!payload) {
    return {
      error: NextResponse.json(
        { success: false, message: 'Invalid or expired token' },
        { status: 401 }
      )
    };
  }

  return { user: payload };
}

/**
 * Higher-order function for protecting API routes
 * Usage:
 * export const POST = withAuth(async (request, params) => {
 *   // request has req.user available
 * });
 */
export function withAuth(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: (request: AuthenticatedRequest, params: any) => Promise<NextResponse>
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return async (request: NextRequest, params: any) => {
    const auth = authenticateRequest(request);

    if ('error' in auth) {
      return auth.error;
    }

    // Attach user to request
    (request as AuthenticatedRequest).user = auth.user;

    try {
      return await handler(request as AuthenticatedRequest, params);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Route error:', err);
      
      // Preserve AppError details in response
      if (error instanceof AppError) {
        return NextResponse.json(
          formatErrorResponse(error),
          { status: error.statusCode }
        );
      }
      
      return NextResponse.json(
        { success: false, message: 'Internal server error' },
        { status: 500 }
      );
    }
  };
}

/**
 * Middleware for optional authentication
 * Does not fail if token is missing, but validates if present
 */
export function optionalAuth(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: (request: AuthenticatedRequest, params: any) => Promise<NextResponse>
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return async (request: NextRequest, params: any) => {
    const token = extractToken(request);

    if (token) {
      const payload = jwtService.verifyToken(token);
      if (payload) {
        (request as AuthenticatedRequest).user = payload;
      }
    }

    try {
      return await handler(request as AuthenticatedRequest, params);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Route error:', err);
      
      // Preserve AppError details in response
      if (error instanceof AppError) {
        return NextResponse.json(
          formatErrorResponse(error),
          { status: error.statusCode }
        );
      }
      
      return NextResponse.json(
        { success: false, message: 'Internal server error' },
        { status: 500 }
      );
    }
  };
}

/**
 * Middleware for CORS protection
 * Restricts API access to authorized domains
 */
export function withCORS(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: (request: NextRequest, params: any) => Promise<NextResponse>
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return async (request: NextRequest, params: any) => {
    const origin = request.headers.get('origin') || '';
    const allowedOrigins = (
      process.env.ALLOWED_ORIGINS || 'http://localhost:3000'
    ).split(',');

    if (!allowedOrigins.includes(origin) && origin !== '') {
      return NextResponse.json(
        { success: false, message: 'CORS policy violation' },
        { status: 403 }
      );
    }

    const response = await handler(request, params);

    if (origin) {
      response.headers.set('Access-Control-Allow-Origin', origin);
      response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      response.headers.set('Access-Control-Allow-Credentials', 'true');
    }

    return response;
  };
}

/**
 * Middleware for rate limiting (basic in-memory implementation)
 * For production, use Redis or external rate limiting service
 */
const MAX_ENTRIES = 1000; // Maximum number of entries to keep in the store
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();
let cleanupInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Clean up old entries to prevent memory leaks
 */
function startCleanup() {
  if (cleanupInterval) return;
  
  cleanupInterval = setInterval(() => {
    const now = Date.now();
    // Only clean if store is getting large
    if (rateLimitStore.size < MAX_ENTRIES) return;
    
    for (const [key, entry] of rateLimitStore.entries()) {
      if (now > entry.resetTime) {
        rateLimitStore.delete(key);
      }
    }
    
    // If still too many, use LRU eviction
    if (rateLimitStore.size >= MAX_ENTRIES) {
      const entriesToDelete = rateLimitStore.size - MAX_ENTRIES + 100;
      const entries = Array.from(rateLimitStore.entries());
      // Delete oldest entries
      for (let i = 0; i < entriesToDelete && entries[i]; i++) {
        rateLimitStore.delete(entries[i][0]);
      }
    }
  }, 60 * 1000); // Run cleanup every minute
  
  // Start cleanup on module load
  if (typeof window === 'undefined') {
    startCleanup();
  }
}

/**
 * Stop cleanup interval
 */
export function stopRateLimitCleanup(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}

export function withRateLimit(
  maxRequests: number = 100,
  windowMs: number = 60000, // 1 minute
  keyFn: (request: NextRequest) => string = (req) =>
    req.headers.get('x-forwarded-for') || 'unknown'
) {
  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    handler: (request: NextRequest, params: any) => Promise<NextResponse>
  ) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return async (request: NextRequest, params: any) => {
      const key = keyFn(request);
      const now = Date.now();

      let entry = rateLimitStore.get(key);

      if (!entry || now > entry.resetTime) {
        entry = { count: 0, resetTime: now + windowMs };
        rateLimitStore.set(key, entry);
      }

      if (entry.count >= maxRequests) {
        return NextResponse.json(
          {
            success: false,
            message: 'Too many requests. Please try again later.'
          },
          { status: 429 }
        );
      }

      entry.count++;

      const response = await handler(request, params);
      response.headers.set('X-RateLimit-Limit', maxRequests.toString());
      response.headers.set(
        'X-RateLimit-Remaining',
        (maxRequests - entry.count).toString()
      );
      response.headers.set(
        'X-RateLimit-Reset',
        Math.ceil(entry.resetTime / 1000).toString()
      );

      return response;
    };
  };
}
