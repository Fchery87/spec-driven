import { NextRequest, NextResponse } from 'next/server';
import { betterFetch } from '@better-fetch/fetch';
import { logger } from '@/lib/logger';

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    context: any,
    session: AuthSession
  ) => Promise<Response | NextResponse>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): (request: NextRequest, context: any) => Promise<Response | NextResponse> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
