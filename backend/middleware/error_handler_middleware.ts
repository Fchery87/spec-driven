/**
 * Error Handler Middleware
 *
 * Wraps API route handlers to catch and format errors consistently
 * Generates request IDs for tracking errors
 */

import { NextRequest, NextResponse } from 'next/server';
 
import { AppError, formatErrorResponse, getStatusCode } from '@/backend/lib/error_handler';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '@/lib/logger';

/**
 * Generate a unique request ID for tracking
 */
function generateRequestId(): string {
  return `req_${uuidv4().substring(0, 8)}`;
}

/**
 * Higher-order function to wrap API handlers with error handling
 *
 * Usage:
 * export const POST = withErrorHandler(async (request) => {
 *   // Your route handler
 * });
 */
export function withErrorHandler(
  handler: (request: NextRequest) => Promise<NextResponse>
) {
  return async (request: NextRequest) => {
    const requestId = generateRequestId();

    try {
      // Log request
      logger.info(`[${requestId}] ${request.method} ${request.nextUrl.pathname}`);

      const response = await handler(request);

      // Log successful response
      logger.info(
        `[${requestId}] ${response.status} - ${request.method} ${request.nextUrl.pathname}`
      );

      // Add request ID to response headers
      response.headers.set('X-Request-ID', requestId);

      return response;
    } catch (error) {
      return handleError(error, requestId);
    }
  };
}

/**
 * Higher-order function for handlers with path parameters
 *
 * Usage:
 * export const POST = withErrorHandlerParams(async (request, { params }) => {
 *   // Your route handler
 * });
 */
export function withErrorHandlerParams(
   
  handler: (request: NextRequest, params: any) => Promise<NextResponse>
) {
   
  return async (request: NextRequest, params: any) => {
    const requestId = generateRequestId();

    try {
      logger.info(
        `[${requestId}] ${request.method} ${request.nextUrl.pathname}`,
        params
      );

      const response = await handler(request, params);

      logger.info(
        `[${requestId}] ${response.status} - ${request.method} ${request.nextUrl.pathname}`
      );

      response.headers.set('X-Request-ID', requestId);
      return response;
    } catch (error) {
      return handleError(error, requestId);
    }
  };
}

/**
 * Central error handling logic
 */
function handleError(error: unknown, requestId: string): NextResponse {
  // Log error
  if (error instanceof AppError) {
    logger.warn(
      `[${requestId}] AppError: ${error.code} - ${error.message}`,
      error.details
    );
  } else if (error instanceof Error) {
    logger.error(`[${requestId}] Error: ${error.message}`, error);
  } else {
    const err = new Error(String(error));
    logger.error(`[${requestId}] Unknown error:`, err);
  }

  // Format response
  const errorResponse = formatErrorResponse(error, requestId);
  const statusCode =
    error instanceof AppError ? error.statusCode : 500;

  return NextResponse.json(errorResponse, { status: statusCode });
}

/**
 * Lightweight error handler for POST/PUT requests
 * Validates JSON body can be parsed
 */
 
export async function safeParseJson(request: NextRequest): Promise<any> {
  try {
    return await request.json();
   
  } catch (error) {
    throw new AppError(
       
      'INVALID_INPUT' as any,
      'Invalid JSON in request body',
      400
    );
  }
}

/**
 * Generate security headers for error responses
 */
export function getSecurityHeaders(): Record<string, string> {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
  };
}

/**
 * Create a safe response with security headers
 */
export function createSafeResponse(
   
  data: any,
  status: number = 200,
  headers?: Record<string, string>
): NextResponse {
  const response = NextResponse.json(data, { status });

  // Add security headers
  const securityHeaders = getSecurityHeaders();
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  // Add custom headers
  if (headers) {
    Object.entries(headers).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
  }

  return response;
}
