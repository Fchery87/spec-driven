/**
 * Authentication Middleware
 *
 * Middleware for protecting API routes with JWT authentication
 * Can be used in Next.js API routes or middleware
 */

import { NextRequest, NextResponse } from 'next/server';
import { jwtService, JWTPayload } from '@/backend/services/auth/jwt_service';
import { logger } from '@/lib/logger';

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
  handler: (request: AuthenticatedRequest, params: any) => Promise<NextResponse>
) {
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
      logger.error('Route error:', error);
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
  handler: (request: AuthenticatedRequest, params: any) => Promise<NextResponse>
) {
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
      logger.error('Route error:', error);
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
  handler: (request: NextRequest, params: any) => Promise<NextResponse>
) {
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
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

export function withRateLimit(
  maxRequests: number = 100,
  windowMs: number = 60000, // 1 minute
  keyFn: (request: NextRequest) => string = (req) =>
    req.headers.get('x-forwarded-for') || 'unknown'
) {
  return (
    handler: (request: NextRequest, params: any) => Promise<NextResponse>
  ) => {
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
