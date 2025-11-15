/**
 * Global Error Handler
 *
 * Centralized error handling for consistent error responses across the application
 * Handles validation errors, authentication errors, and generic server errors
 */

export enum ErrorCode {
  // Validation errors (400)
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',

  // Authentication errors (401)
  UNAUTHORIZED = 'UNAUTHORIZED',
  INVALID_TOKEN = 'INVALID_TOKEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',

  // Authorization errors (403)
  FORBIDDEN = 'FORBIDDEN',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',

  // Not found errors (404)
  NOT_FOUND = 'NOT_FOUND',
  PROJECT_NOT_FOUND = 'PROJECT_NOT_FOUND',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  ARTIFACT_NOT_FOUND = 'ARTIFACT_NOT_FOUND',

  // Conflict errors (409)
  CONFLICT = 'CONFLICT',
  RESOURCE_ALREADY_EXISTS = 'RESOURCE_ALREADY_EXISTS',
  DUPLICATE_EMAIL = 'DUPLICATE_EMAIL',

  // Rate limiting (429)
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',

  // Server errors (500)
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  LLM_ERROR = 'LLM_ERROR',
  FILE_SYSTEM_ERROR = 'FILE_SYSTEM_ERROR'
}

export interface ErrorResponse {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: Record<string, any>;
    timestamp: string;
    requestId?: string;
  };
}

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: Record<string, any>;

  constructor(
    code: ErrorCode,
    message: string,
    statusCode: number = 500,
    details?: Record<string, any>
  ) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.name = 'AppError';

    // Maintain proper stack trace for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Map error codes to HTTP status codes
 */
export function getStatusCode(code: ErrorCode): number {
  const statusMap: Record<ErrorCode, number> = {
    // 400 errors
    [ErrorCode.VALIDATION_ERROR]: 400,
    [ErrorCode.INVALID_INPUT]: 400,
    [ErrorCode.MISSING_REQUIRED_FIELD]: 400,

    // 401 errors
    [ErrorCode.UNAUTHORIZED]: 401,
    [ErrorCode.INVALID_TOKEN]: 401,
    [ErrorCode.TOKEN_EXPIRED]: 401,
    [ErrorCode.INVALID_CREDENTIALS]: 401,

    // 403 errors
    [ErrorCode.FORBIDDEN]: 403,
    [ErrorCode.INSUFFICIENT_PERMISSIONS]: 403,

    // 404 errors
    [ErrorCode.NOT_FOUND]: 404,
    [ErrorCode.PROJECT_NOT_FOUND]: 404,
    [ErrorCode.USER_NOT_FOUND]: 404,
    [ErrorCode.ARTIFACT_NOT_FOUND]: 404,

    // 409 errors
    [ErrorCode.CONFLICT]: 409,
    [ErrorCode.RESOURCE_ALREADY_EXISTS]: 409,
    [ErrorCode.DUPLICATE_EMAIL]: 409,

    // 429 errors
    [ErrorCode.RATE_LIMIT_EXCEEDED]: 429,

    // 500 errors
    [ErrorCode.INTERNAL_SERVER_ERROR]: 500,
    [ErrorCode.DATABASE_ERROR]: 500,
    [ErrorCode.LLM_ERROR]: 500,
    [ErrorCode.FILE_SYSTEM_ERROR]: 500
  };

  return statusMap[code] || 500;
}

/**
 * Format error response
 */
export function formatErrorResponse(
  error: AppError | Error | unknown,
  requestId?: string
): ErrorResponse {
  if (error instanceof AppError) {
    return {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
        timestamp: new Date().toISOString(),
        requestId
      }
    };
  }

  // Handle standard Error objects
  if (error instanceof Error) {
    return {
      success: false,
      error: {
        code: ErrorCode.INTERNAL_SERVER_ERROR,
        message: error.message || 'An unexpected error occurred',
        timestamp: new Date().toISOString(),
        requestId
      }
    };
  }

  // Handle unknown error types
  return {
    success: false,
    error: {
      code: ErrorCode.INTERNAL_SERVER_ERROR,
      message: 'An unexpected error occurred',
      timestamp: new Date().toISOString(),
      requestId
    }
  };
}

/**
 * Common error creators
 */
export const Errors = {
  validationError: (message: string, details?: Record<string, any>) =>
    new AppError(
      ErrorCode.VALIDATION_ERROR,
      message,
      400,
      details
    ),

  missingField: (field: string) =>
    new AppError(
      ErrorCode.MISSING_REQUIRED_FIELD,
      `Missing required field: ${field}`,
      400,
      { field }
    ),

  invalidInput: (message: string, details?: Record<string, any>) =>
    new AppError(
      ErrorCode.INVALID_INPUT,
      message,
      400,
      details
    ),

  unauthorized: (message = 'Unauthorized') =>
    new AppError(
      ErrorCode.UNAUTHORIZED,
      message,
      401
    ),

  invalidToken: () =>
    new AppError(
      ErrorCode.INVALID_TOKEN,
      'Invalid or expired token',
      401
    ),

  tokenExpired: () =>
    new AppError(
      ErrorCode.TOKEN_EXPIRED,
      'Token has expired',
      401
    ),

  invalidCredentials: () =>
    new AppError(
      ErrorCode.INVALID_CREDENTIALS,
      'Invalid email or password',
      401
    ),

  forbidden: (message = 'Access denied') =>
    new AppError(
      ErrorCode.FORBIDDEN,
      message,
      403
    ),

  insufficientPermissions: () =>
    new AppError(
      ErrorCode.INSUFFICIENT_PERMISSIONS,
      'Insufficient permissions to perform this action',
      403
    ),

  notFound: (resource = 'Resource') =>
    new AppError(
      ErrorCode.NOT_FOUND,
      `${resource} not found`,
      404,
      { resource }
    ),

  projectNotFound: (slug?: string) =>
    new AppError(
      ErrorCode.PROJECT_NOT_FOUND,
      `Project not found${slug ? `: ${slug}` : ''}`,
      404,
      { slug }
    ),

  userNotFound: (userId?: string) =>
    new AppError(
      ErrorCode.USER_NOT_FOUND,
      `User not found${userId ? `: ${userId}` : ''}`,
      404,
      { userId }
    ),

  artifactNotFound: (name?: string) =>
    new AppError(
      ErrorCode.ARTIFACT_NOT_FOUND,
      `Artifact not found${name ? `: ${name}` : ''}`,
      404,
      { name }
    ),

  conflict: (message: string, details?: Record<string, any>) =>
    new AppError(
      ErrorCode.CONFLICT,
      message,
      409,
      details
    ),

  resourceAlreadyExists: (resource: string, details?: Record<string, any>) =>
    new AppError(
      ErrorCode.RESOURCE_ALREADY_EXISTS,
      `${resource} already exists`,
      409,
      details
    ),

  duplicateEmail: (email: string) =>
    new AppError(
      ErrorCode.DUPLICATE_EMAIL,
      `User with email already exists: ${email}`,
      409,
      { email }
    ),

  rateLimitExceeded: (retryAfter?: number) =>
    new AppError(
      ErrorCode.RATE_LIMIT_EXCEEDED,
      'Too many requests. Please try again later.',
      429,
      retryAfter ? { retryAfter } : undefined
    ),

  databaseError: (message: string, details?: Record<string, any>) =>
    new AppError(
      ErrorCode.DATABASE_ERROR,
      `Database error: ${message}`,
      500,
      details
    ),

  llmError: (message: string, details?: Record<string, any>) =>
    new AppError(
      ErrorCode.LLM_ERROR,
      `LLM service error: ${message}`,
      500,
      details
    ),

  fileSystemError: (message: string, details?: Record<string, any>) =>
    new AppError(
      ErrorCode.FILE_SYSTEM_ERROR,
      `File system error: ${message}`,
      500,
      details
    ),

  internalServerError: (message = 'Internal server error') =>
    new AppError(
      ErrorCode.INTERNAL_SERVER_ERROR,
      message,
      500
    )
};
