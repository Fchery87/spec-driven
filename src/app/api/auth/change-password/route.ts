import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/backend/middleware/auth_middleware';
import { authService } from '@/backend/services/auth/auth_service';

/**
 * POST /api/auth/change-password
 *
 * Change user password (requires authentication)
 * Headers: Authorization: Bearer <token>
 * Body: { oldPassword: string, newPassword: string }
 *
 * Returns:
 * - 200: Password changed successfully
 * - 400: Validation error or weak password
 * - 401: Unauthorized or invalid old password
 * - 500: Server error
 */
async function handler(request: AuthenticatedRequest) {
  try {
    if (!request.user) {
      return NextResponse.json(
        {
          success: false,
          message: 'Authentication required'
        },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { oldPassword, newPassword } = body;

    // Validate required fields
    if (!oldPassword || !newPassword) {
      return NextResponse.json(
        {
          success: false,
          message: 'Missing required fields: oldPassword, newPassword'
        },
        { status: 400 }
      );
    }

    // Prevent same password
    if (oldPassword === newPassword) {
      return NextResponse.json(
        {
          success: false,
          message: 'New password must be different from old password'
        },
        { status: 400 }
      );
    }

    const result = await authService.changePassword(
      request.user.userId,
      oldPassword,
      newPassword
    );

    if (!result.success) {
      const statusCode = result.message.includes('incorrect') ? 401 : 400;
      return NextResponse.json(result, { status: statusCode });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('Change password error:', error);
    return NextResponse.json(
      {
        success: false,
        message: `Failed to change password: ${error instanceof Error ? error.message : String(error)}`
      },
      { status: 500 }
    );
  }
}

export const POST = withAuth(handler);

/**
 * OPTIONS endpoint for CORS preflight
 */
export async function OPTIONS() {
  return NextResponse.json(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  });
}
