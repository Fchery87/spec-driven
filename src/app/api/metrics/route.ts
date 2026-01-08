/**
 * Metrics Collection Endpoint
 *
 * Provides Prometheus-compatible metrics for production monitoring:
 * - Request count by endpoint
 * - Error count
 * - Response time histogram (bucketed)
 * - Authentication success/failure counts
 */

import { NextRequest, NextResponse } from 'next/server';
import { metrics, TIME_BUCKETS } from '@/lib/metrics';

/**
 * Generate Prometheus-compatible metrics output
 */
function generatePrometheusMetrics(): string {
  const lines: string[] = [];
  const now = Math.floor(Date.now() / 1000);

  lines.push('# HELP http_requests_total Total number of HTTP requests');
  lines.push('# TYPE http_requests_total counter');
  for (const [path, count] of Object.entries(metrics.requestCount)) {
    const sanitizedPath = path.replace(/[^a-zA-Z0-9]/g, '_');
    lines.push(
      `http_requests_total{method="${
        sanitizedPath.split(' ')[0]
      }",endpoint="${sanitizedPath}"} ${count}`
    );
  }

  lines.push('');
  lines.push('# HELP http_errors_total Total number of HTTP errors');
  lines.push('# TYPE http_errors_total counter');
  for (const [path, count] of Object.entries(metrics.errorCount)) {
    const sanitizedPath = path.replace(/[^a-zA-Z0-9]/g, '_');
    lines.push(
      `http_errors_total{method="${
        sanitizedPath.split(' ')[0]
      }",endpoint="${sanitizedPath}"} ${count}`
    );
  }

  lines.push('');
  lines.push('# HELP http_request_duration_seconds HTTP request duration');
  lines.push('# TYPE http_request_duration_seconds histogram');
  for (const [path, times] of Object.entries(metrics.responseTimes)) {
    const sanitizedPath = path.replace(/[^a-zA-Z0-9]/g, '_');
    const method = sanitizedPath.split('_')[0];
    const endpoint = sanitizedPath.split(' ').slice(1).join('_');

    // Calculate histogram buckets
    const histogram: Record<number, number> = {};
    TIME_BUCKETS.forEach((bucket) => {
      histogram[bucket] = 0;
    });

    times.forEach((time) => {
      const seconds = time / 1000;
      for (const bucket of TIME_BUCKETS) {
        if (seconds <= bucket / 1000) {
          histogram[bucket]++;
        }
      }
    });

    const totalCount = times.length;
    const totalSum = times.reduce((sum, t) => sum + t, 0) / 1000;

    lines.push(
      `http_request_duration_seconds_sum{method="${method}",endpoint="${endpoint}"} ${totalSum.toFixed(
        6
      )}`
    );
    lines.push(
      `http_request_duration_seconds_count{method="${method}",endpoint="${endpoint}"} ${totalCount}`
    );

    for (const [bucket, count] of Object.entries(histogram)) {
      const bucketSeconds = parseInt(bucket) / 1000;
      lines.push(
        `http_request_duration_seconds_bucket{method="${method}",endpoint="${endpoint}",le="${bucketSeconds}"} ${count}`
      );
    }
    lines.push(
      `http_request_duration_seconds_bucket{method="${method}",endpoint="${endpoint}",le="+Inf"} ${totalCount}`
    );
  }

  lines.push('');
  lines.push(
    '# HELP auth_success_total Total number of successful authentications'
  );
  lines.push('# TYPE auth_success_total counter');
  lines.push(`auth_success_total ${metrics.authSuccess}`);

  lines.push('');
  lines.push(
    '# HELP auth_failure_total Total number of failed authentications'
  );
  lines.push('# TYPE auth_failure_total counter');
  lines.push(`auth_failure_total ${metrics.authFailure}`);

  lines.push('');
  lines.push(`# Last updated: ${new Date(metrics.lastUpdated).toISOString()}`);
  lines.push(`# Timestamp: ${now}`);

  return lines.join('\n');
}

/**
 * GET /api/metrics
 * Returns metrics in Prometheus format
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  // Basic auth for metrics endpoint (optional - configure in production)
  const authHeader = request.headers.get('authorization');
  const expectedAuth = process.env.METRICS_AUTH;

  if (expectedAuth && authHeader !== `Bearer ${expectedAuth}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const format = request.nextUrl.searchParams.get('format');

  if (format === 'json') {
    // Return JSON format for debugging
    return NextResponse.json({
      requestCount: metrics.requestCount,
      errorCount: metrics.errorCount,
      sampleCounts: Object.fromEntries(
        Object.entries(metrics.responseTimes).map(([k, v]) => [k, v.length])
      ),
      authSuccess: metrics.authSuccess,
      authFailure: metrics.authFailure,
      lastUpdated: new Date(metrics.lastUpdated).toISOString(),
    });
  }

  // Default: Prometheus format
  const metricsOutput = generatePrometheusMetrics();

  return new NextResponse(metricsOutput, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}
