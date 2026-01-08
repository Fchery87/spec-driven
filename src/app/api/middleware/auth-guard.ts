import { NextRequest, NextResponse } from 'next/server';
import { betterFetch } from '@better-fetch/fetch';
import { logger } from '@/lib/logger';

/**
 * User role type
 */
export type UserRole = 'user' | 'admin' | 'super_admin';

/**
 * Better Auth session type - includes user and session data
 */
export interface AuthSession {
  user: {
    id: string;
    email: string;
    emailVerified: boolean;
    name?: string;
    image?: string;
    role?: UserRole;
    createdAt: Date;
    updatedAt: Date;
  };
  session: {
    id: string;
    token: string;
    expiresAt: Date;
    createdAt: Date;
    updatedAt: Date;
    ipAddress?: string;
    userAgent?: string;
  };
}

/**
 * Middleware to protect API routes with authentication
 * Verifies valid session from Better Auth
 */
export async function requireAuth(request: NextRequest) {
  try {
    const { data: session } = await betterFetch<AuthSession>(
      '/api/auth/get-session',
      {
        baseURL: request.nextUrl.origin,
        headers: {
          cookie: request.headers.get('cookie') || '',
        },
      }
    );

    if (!session) {
      logger.warn('Unauthorized API access attempt', {
        path: request.nextUrl.pathname,
        method: request.method,
      });
      return null;
    }

    return session;
  } catch (error) {
    logger.error(
      'Error checking session:',
      error instanceof Error ? error : new Error(String(error))
    );
    return null;
  }
}

/**
 * Higher-order function to wrap API route handlers with auth protection
 */
export function withAuth(
  handler: (
    request: NextRequest,
     
    context: any,
    session: AuthSession
  ) => Promise<Response | NextResponse>
   
): (request: NextRequest, context: any) => Promise<Response | NextResponse> {
   
  return async (request: NextRequest, context: any) => {
    const session = await requireAuth(request);

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    return handler(request, context, session);
  };
}

/**
 * Check if user has admin role
 */
export function isAdmin(session: AuthSession): boolean {
  if (!session.user.role) return false;
  return session.user.role === 'admin' || session.user.role === 'super_admin';
}

/**
 * Check if user has super admin role
 */
export function isSuperAdmin(session: AuthSession): boolean {
  return session.user.role === 'super_admin';
}

/**
 * Higher-order function to wrap API route handlers with admin protection
 */
export function withAdminAuth(
  handler: (
    request: NextRequest,
     
    context: any,
    session: AuthSession
  ) => Promise<Response | NextResponse>
   
): (request: NextRequest, context: any) => Promise<Response | NextResponse> {
   
  return async (request: NextRequest, context: any) => {
    const session = await requireAuth(request);

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (!isAdmin(session)) {
      logger.warn('Non-admin user attempted admin API access', {
        userId: session.user.id,
        email: session.user.email,
        path: request.nextUrl.pathname,
      });
      return NextResponse.json(
        { success: false, error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }

    return handler(request, context, session);
  };
}
