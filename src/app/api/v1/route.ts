import { NextResponse } from 'next/server';

/**
 * API v1 Base Route
 *
 * This route provides information about the v1 API version.
 * All v1 endpoints are accessible under /api/v1/
 *
 * Deprecation Notice:
 * The legacy /api/* endpoints are deprecated and will be removed in a future update.
 * Please migrate to /api/v1/* endpoints.
 */
export async function GET() {
  return NextResponse.json({
    version: 'v1',
    status: 'active',
    deprecation_notice: 'Legacy /api/* endpoints will be removed. Migrate to /api/v1/*',
    migration_guide: '/docs/api/migration',
  });
}
