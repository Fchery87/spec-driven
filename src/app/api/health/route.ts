import { NextResponse } from 'next/server';
import { getDb } from '@/backend/lib/drizzle';
import { logger } from '@/lib/logger';

/**
 * Health check endpoint for load balancers and container orchestration
 * Returns status of database, memory, and overall system health
 */
export async function GET() {
  const startTime = Date.now();
  const checks: Record<string, { status: 'healthy' | 'degraded' | 'unhealthy'; latencyMs: number; error?: string }> = {};

  // Check database connection
  try {
    const dbStart = Date.now();
    const db = getDb();
    // Simple query to verify DB connection
    if (typeof db?.query !== 'undefined') {
      await db.query.projects.findFirst({ limit: 1 });
      checks.database = {
        status: 'healthy',
        latencyMs: Date.now() - dbStart,
      };
    } else {
      checks.database = {
        status: 'degraded',
        latencyMs: Date.now() - dbStart,
        error: 'Database not initialized',
      };
    }
  } catch (error) {
    checks.database = {
      status: 'unhealthy',
      latencyMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }

  // Check memory usage
  try {
    const memStart = Date.now();
    const usedHeap = process.memoryUsage().heapUsed;
    const totalHeap = process.memoryUsage().heapTotal;
    const memoryPercent = (usedHeap / totalHeap) * 100;

    checks.memory = {
      status: memoryPercent > 90 ? 'unhealthy' : memoryPercent > 75 ? 'degraded' : 'healthy',
      latencyMs: Date.now() - memStart,
    };
  } catch {
    checks.memory = {
      status: 'degraded',
      latencyMs: 0,
      error: 'Unable to get memory stats',
    };
  }

  // Calculate overall status
  const statuses = Object.values(checks).map((c) => c.status);
  const overallStatus = statuses.includes('unhealthy')
    ? 'unhealthy'
    : statuses.includes('degraded')
    ? 'degraded'
    : 'healthy';

  const totalLatency = Date.now() - startTime;

  const response = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    totalLatencyMs: totalLatency,
    checks,
    version: process.env.npm_package_version || 'unknown',
    environment: process.env.NODE_ENV || 'unknown',
  };

  logger.info('Health check completed', { status: overallStatus, latency: totalLatency });

  const statusCode = overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 200 : 503;
  return NextResponse.json(response, { status: statusCode });
}
