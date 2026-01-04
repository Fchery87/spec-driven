/**
 * Rate limiting middleware for API routes
 * Wraps API handlers to enforce rate limits
 */

import { NextRequest } from 'next/server';
import { llmLimiter, generalLimiter, authLimiter, getRateLimitKey, createRateLimitResponse } from '@/lib/rate-limiter';
import { logger } from '@/lib/logger';

export type LimitType = 'general' | 'llm' | 'auth';

/**
 * Wrap an API handler with rate limiting
 */
export function withRateLimit(
  handler: (req: NextRequest) => Promise<Response>,
  limitType: LimitType = 'general',
  userIdFn?: (req: NextRequest) => string | undefined
) {
  return async (req: NextRequest): Promise<Response> => {
    // Get the appropriate limiter
    const limiter = limitType === 'llm' ? llmLimiter : limitType === 'auth' ? authLimiter : generalLimiter;

    // Get rate limit key
    const userId = userIdFn?.(req);
    const key = getRateLimitKey(req, userId);

    // Check if request is allowed
    const allowed = await limiter.isAllowed(key);

    if (!allowed) {
      const remaining = await limiter.getRemainingPoints(key);
      logger.warn('Rate limit exceeded', {
        limitType,
        key: key.substring(0, 20) + '...', // Log shortened key
        remaining,
      });

      return createRateLimitResponse(remaining, Date.now() + 60000, 60);
    }

    // Execute handler
    return handler(req);
  };
}

/**
 * Wrap a route handler with LLM-specific rate limiting
 */
export function withLLMRateLimit(
  handler: (req: NextRequest) => Promise<Response>,
  userIdFn?: (req: NextRequest) => string | undefined
) {
  return withRateLimit(handler, 'llm', userIdFn);
}

/**
 * Wrap a route handler with auth-specific rate limiting
 */
export function withAuthRateLimit(
  handler: (req: NextRequest) => Promise<Response>,
  userIdFn?: (req: NextRequest) => string | undefined
) {
  return withRateLimit(handler, 'auth', userIdFn);
}

/**
 * Wrap a route handler with general rate limiting
 */
export function withGeneralRateLimit(
  handler: (req: NextRequest) => Promise<Response>,
  userIdFn?: (req: NextRequest) => string | undefined
) {
  return withRateLimit(handler, 'general', userIdFn);
}
