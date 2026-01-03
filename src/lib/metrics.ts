/**
 * Metrics Middleware
 *
 * Middleware wrapper for automatically recording request metrics
 */

import { NextRequest, NextResponse } from 'next/server';
import { recordRequest } from '@/app/api/metrics/route';

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
