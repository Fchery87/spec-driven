/**
 * Metrics Collection & Middleware
 *
 * Provides Prometheus-compatible metrics for production monitoring:
 * - Request count by endpoint
 * - Error count
 * - Response time histogram (bucketed)
 * - Authentication success/failure counts
 */

import { NextRequest, NextResponse } from 'next/server';

// ============================================================================
// METRICS STORAGE
// Uses in-memory storage for metrics (Redis recommended for production)
// ============================================================================

interface Metrics {
  requestCount: Record<string, number>;
  errorCount: Record<string, number>;
  responseTimes: Record<string, number[]>;
  authSuccess: number;
  authFailure: number;
  lastUpdated: number;
}

export const metrics: Metrics = {
  requestCount: {},
  errorCount: {},
  responseTimes: {},
  authSuccess: 0,
  authFailure: 0,
  lastUpdated: Date.now(),
};

// Response time buckets in milliseconds (for histogram)
export const TIME_BUCKETS = [
  5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000,
];

/**
 * Record a request metric
 */
export function recordRequest(
  method: string,
  path: string,
  statusCode: number,
  durationMs: number,
  isAuth: boolean = false,
  authSuccess: boolean = false
): void {
  const key = `${method} ${path}`;

  // Request count
  metrics.requestCount[key] = (metrics.requestCount[key] || 0) + 1;

  // Error count (4xx and 5xx)
  if (statusCode >= 400) {
    metrics.errorCount[key] = (metrics.errorCount[key] || 0) + 1;
  }

  // Response times
  if (!metrics.responseTimes[key]) {
    metrics.responseTimes[key] = [];
  }
  metrics.responseTimes[key].push(durationMs);

  // Keep only last 1000 samples per endpoint to prevent memory issues
  if (metrics.responseTimes[key].length > 1000) {
    metrics.responseTimes[key] = metrics.responseTimes[key].slice(-1000);
  }

  // Auth metrics
  if (isAuth) {
    if (authSuccess) {
      metrics.authSuccess++;
    } else {
      metrics.authFailure++;
    }
  }

  metrics.lastUpdated = Date.now();
}

/**
 * Middleware to record request metrics
 */
export function withMetrics(
  handler: (req: NextRequest) => Promise<NextResponse>
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const startTime = Date.now();
    const path = req.nextUrl.pathname;
    const method = req.method;

    try {
      const response = await handler(req);
      const duration = Date.now() - startTime;
      const isAuth = path.includes('/auth/');

      recordRequest(method, path, response.status, duration, isAuth);

      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      recordRequest(method, path, 500, duration, method !== 'GET');
      throw error;
    }
  };
}
