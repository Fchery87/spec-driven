import { NextResponse } from 'next/server';

/**
 * Standardized API error response format
 * Ensures consistent error responses across all API endpoints
 */
export interface ApiErrorResponse {
  success: false;
  error: string;
  code?: string;
}

export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data?: T;
}

/**
 * Create a standardized error response
 */
export function apiError(
  error: string,
  statusCode: number = 500,
  code?: string
): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    {
      success: false,
      error,
      code: code || getStatusCodeName(statusCode),
    },
    { status: statusCode }
  );
}

/**
 * Create a standardized success response
 */
export function apiSuccess<T = unknown>(
  data: T,
  statusCode: number = 200
): NextResponse<ApiSuccessResponse<T>> {
  return NextResponse.json(
    {
      success: true,
      data,
    },
    { status: statusCode }
  );
}

/**
 * Map HTTP status codes to error codes
 */
function getStatusCodeName(statusCode: number): string {
  switch (statusCode) {
    case 400:
      return 'BAD_REQUEST';
    case 401:
      return 'UNAUTHORIZED';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'NOT_FOUND';
    case 409:
      return 'CONFLICT';
    case 422:
      return 'VALIDATION_ERROR';
    case 429:
      return 'RATE_LIMITED';
    case 500:
      return 'INTERNAL_ERROR';
    case 503:
      return 'SERVICE_UNAVAILABLE';
    default:
      return 'ERROR';
  }
}

/**
 * Common error factory functions for convenience
 */
export const ApiErrors = {
  badRequest(message: string = 'Bad request', code?: string) {
    return apiError(message, 400, code || 'BAD_REQUEST');
  },

  unauthorized(message: string = 'Unauthorized', code?: string) {
    return apiError(message, 401, code || 'UNAUTHORIZED');
  },

  forbidden(message: string = 'Forbidden', code?: string) {
    return apiError(message, 403, code || 'FORBIDDEN');
  },

  notFound(message: string = 'Resource not found', code?: string) {
    return apiError(message, 404, code || 'NOT_FOUND');
  },

  conflict(message: string = 'Resource already exists', code?: string) {
    return apiError(message, 409, code || 'CONFLICT');
  },

  validationError(message: string = 'Validation failed', code?: string) {
    return apiError(message, 422, code || 'VALIDATION_ERROR');
  },

  rateLimited(message: string = 'Too many requests', code?: string) {
    return apiError(message, 429, code || 'RATE_LIMITED');
  },

  internal(message: string = 'Internal server error', code?: string) {
    return apiError(message, 500, code || 'INTERNAL_ERROR');
  },

  serviceUnavailable(message: string = 'Service temporarily unavailable', code?: string) {
    return apiError(message, 503, code || 'SERVICE_UNAVAILABLE');
  },
};
