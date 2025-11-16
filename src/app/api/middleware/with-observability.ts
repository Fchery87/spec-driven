/**
 * Combined middleware for API observability
 * Applies correlation ID tracking and rate limiting in one wrapper
 */

import { NextRequest, NextResponse } from 'next/server';
import { withCorrelationId } from '@/lib/correlation-id';
import { withLLMRateLimit, withAuthRateLimit, withGeneralRateLimit, LimitType } from './rate-limit';

/**
 * Wrap an API handler with full observability (correlation ID + rate limiting)
 */
export function withObservability(
  handler: (req: NextRequest, context?: any) => Promise<Response>,
  limitType: LimitType = 'general',
  userIdFn?: (req: NextRequest) => string | undefined
) {
  // First apply rate limiting, then correlation ID
  const rateLimited = (() => {
    switch (limitType) {
      case 'llm':
        return withLLMRateLimit(handler, userIdFn);
      case 'auth':
        return withAuthRateLimit(handler, userIdFn);
      default:
        return withGeneralRateLimit(handler, userIdFn);
    }
  })();

  return withCorrelationId(rateLimited);
}

/**
 * Wrap for LLM endpoints with full observability
 */
export function withLLMObservability(
  handler: (req: NextRequest, context?: any) => Promise<Response>,
  userIdFn?: (req: NextRequest) => string | undefined
) {
  return withObservability(handler, 'llm', userIdFn);
}

/**
 * Wrap for auth endpoints with full observability
 */
export function withAuthObservability(
  handler: (req: NextRequest, context?: any) => Promise<Response>,
  userIdFn?: (req: NextRequest) => string | undefined
) {
  return withObservability(handler, 'auth', userIdFn);
}

/**
 * Wrap for general API endpoints with full observability
 */
export function withGeneralObservability(
  handler: (req: NextRequest, context?: any) => Promise<Response>,
  userIdFn?: (req: NextRequest) => string | undefined
) {
  return withObservability(handler, 'general', userIdFn);
}
