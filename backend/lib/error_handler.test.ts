/**
 * Tests for Error Handler Service
 */

import { describe, it, expect } from 'vitest';
import {
  AppError,
  ErrorCode,
  getStatusCode,
  formatErrorResponse,
  Errors
} from './error_handler';

describe('AppError', () => {
  it('should create an error with code and message', () => {
    const error = new AppError(
      ErrorCode.VALIDATION_ERROR,
      'Test error message',
      400
    );

    expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
    expect(error.message).toBe('Test error message');
    expect(error.statusCode).toBe(400);
  });

  it('should include details if provided', () => {
    const details = { field: 'email', reason: 'Invalid format' };
    const error = new AppError(
      ErrorCode.INVALID_INPUT,
      'Invalid input',
      400,
      details
    );

    expect(error.details).toEqual(details);
  });

  it('should maintain proper instanceof checks', () => {
    const error = new AppError(
      ErrorCode.INTERNAL_SERVER_ERROR,
      'Server error',
      500
    );

    expect(error instanceof AppError).toBe(true);
    expect(error instanceof Error).toBe(true);
  });
});

describe('getStatusCode', () => {
  it('should return correct status codes for validation errors', () => {
    expect(getStatusCode(ErrorCode.VALIDATION_ERROR)).toBe(400);
    expect(getStatusCode(ErrorCode.INVALID_INPUT)).toBe(400);
    expect(getStatusCode(ErrorCode.MISSING_REQUIRED_FIELD)).toBe(400);
  });

  it('should return correct status codes for auth errors', () => {
    expect(getStatusCode(ErrorCode.UNAUTHORIZED)).toBe(401);
    expect(getStatusCode(ErrorCode.INVALID_TOKEN)).toBe(401);
    expect(getStatusCode(ErrorCode.INVALID_CREDENTIALS)).toBe(401);
  });

  it('should return correct status codes for permission errors', () => {
    expect(getStatusCode(ErrorCode.FORBIDDEN)).toBe(403);
    expect(getStatusCode(ErrorCode.INSUFFICIENT_PERMISSIONS)).toBe(403);
  });

  it('should return correct status codes for not found errors', () => {
    expect(getStatusCode(ErrorCode.NOT_FOUND)).toBe(404);
    expect(getStatusCode(ErrorCode.PROJECT_NOT_FOUND)).toBe(404);
    expect(getStatusCode(ErrorCode.USER_NOT_FOUND)).toBe(404);
  });

  it('should return correct status codes for conflict errors', () => {
    expect(getStatusCode(ErrorCode.CONFLICT)).toBe(409);
    expect(getStatusCode(ErrorCode.DUPLICATE_EMAIL)).toBe(409);
  });

  it('should return correct status codes for rate limit errors', () => {
    expect(getStatusCode(ErrorCode.RATE_LIMIT_EXCEEDED)).toBe(429);
  });

  it('should return correct status codes for server errors', () => {
    expect(getStatusCode(ErrorCode.INTERNAL_SERVER_ERROR)).toBe(500);
    expect(getStatusCode(ErrorCode.DATABASE_ERROR)).toBe(500);
    expect(getStatusCode(ErrorCode.LLM_ERROR)).toBe(500);
  });
});

describe('formatErrorResponse', () => {
  it('should format AppError correctly', () => {
    const error = new AppError(
      ErrorCode.VALIDATION_ERROR,
      'Invalid email',
      400,
      { field: 'email' }
    );

    const response = formatErrorResponse(error, 'req_123');

    expect(response.success).toBe(false);
    expect(response.error.code).toBe(ErrorCode.VALIDATION_ERROR);
    expect(response.error.message).toBe('Invalid email');
    expect(response.error.details).toEqual({ field: 'email' });
    expect(response.error.requestId).toBe('req_123');
    expect(response.error.timestamp).toBeDefined();
  });

  it('should format standard Error correctly', () => {
    const error = new Error('Standard error message');
    const response = formatErrorResponse(error);

    expect(response.success).toBe(false);
    expect(response.error.code).toBe(ErrorCode.INTERNAL_SERVER_ERROR);
    expect(response.error.message).toBe('Standard error message');
  });

  it('should handle unknown error types', () => {
    const response = formatErrorResponse('Unknown error');

    expect(response.success).toBe(false);
    expect(response.error.code).toBe(ErrorCode.INTERNAL_SERVER_ERROR);
    expect(response.error.message).toBe('An unexpected error occurred');
  });

  it('should include request ID if provided', () => {
    const error = new AppError(ErrorCode.NOT_FOUND, 'Not found', 404);
    const response = formatErrorResponse(error, 'req_abc');

    expect(response.error.requestId).toBe('req_abc');
  });

  it('should have timestamp in ISO format', () => {
    const error = new AppError(ErrorCode.INTERNAL_SERVER_ERROR, 'Error', 500);
    const response = formatErrorResponse(error);

    expect(response.error.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe('Errors helper functions', () => {
  it('should create validation error', () => {
    const error = Errors.validationError('Invalid input', { field: 'x' });

    expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
    expect(error.statusCode).toBe(400);
    expect(error.message).toBe('Invalid input');
    expect(error.details).toEqual({ field: 'x' });
  });

  it('should create missing field error', () => {
    const error = Errors.missingField('email');

    expect(error.code).toBe(ErrorCode.MISSING_REQUIRED_FIELD);
    expect(error.statusCode).toBe(400);
    expect(error.message).toContain('email');
  });

  it('should create unauthorized error', () => {
    const error = Errors.unauthorized('Please log in');

    expect(error.code).toBe(ErrorCode.UNAUTHORIZED);
    expect(error.statusCode).toBe(401);
    expect(error.message).toBe('Please log in');
  });

  it('should create invalid token error', () => {
    const error = Errors.invalidToken();

    expect(error.code).toBe(ErrorCode.INVALID_TOKEN);
    expect(error.statusCode).toBe(401);
  });

  it('should create forbidden error', () => {
    const error = Errors.forbidden('No access');

    expect(error.code).toBe(ErrorCode.FORBIDDEN);
    expect(error.statusCode).toBe(403);
    expect(error.message).toBe('No access');
  });

  it('should create not found error', () => {
    const error = Errors.notFound('Project');

    expect(error.code).toBe(ErrorCode.NOT_FOUND);
    expect(error.statusCode).toBe(404);
    expect(error.message).toContain('Project');
  });

  it('should create project not found error', () => {
    const error = Errors.projectNotFound('my-app');

    expect(error.code).toBe(ErrorCode.PROJECT_NOT_FOUND);
    expect(error.statusCode).toBe(404);
    expect(error.details).toEqual({ slug: 'my-app' });
  });

  it('should create duplicate email error', () => {
    const error = Errors.duplicateEmail('user@example.com');

    expect(error.code).toBe(ErrorCode.DUPLICATE_EMAIL);
    expect(error.statusCode).toBe(409);
    expect(error.details).toEqual({ email: 'user@example.com' });
  });

  it('should create rate limit error', () => {
    const error = Errors.rateLimitExceeded(60);

    expect(error.code).toBe(ErrorCode.RATE_LIMIT_EXCEEDED);
    expect(error.statusCode).toBe(429);
    expect(error.details).toEqual({ retryAfter: 60 });
  });

  it('should create database error', () => {
    const error = Errors.databaseError('Connection failed');

    expect(error.code).toBe(ErrorCode.DATABASE_ERROR);
    expect(error.statusCode).toBe(500);
    expect(error.message).toContain('Database error');
  });
});
