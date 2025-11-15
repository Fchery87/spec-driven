import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/backend/services/auth/auth_service';

/**
 * POST /api/auth/register
 *
 * Register a new user
 * Body: { email: string, name: string, password: string }
 *
 * Returns:
 * - 201: User created successfully with JWT token
 * - 400: Validation error
 * - 409: User already exists
 * - 500: Server error
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, name, password } = body;

    // Validate required fields
    if (!email || !name || !password) {
      return NextResponse.json(
        {
          success: false,
          message: 'Missing required fields: email, name, password'
        },
        { status: 400 }
      );
    }

    const result = await authService.register({
      email,
      name,
      password
    });

    if (!result.success) {
      const statusCode =
        result.message.includes('already exists') ? 409 : 400;
      return NextResponse.json(result, { status: statusCode });
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      {
        success: false,
        message: `Registration failed: ${error instanceof Error ? error.message : String(error)}`
      },
      { status: 500 }
    );
  }
}

/**
 * OPTIONS endpoint for CORS preflight
 */
export async function OPTIONS() {
  return NextResponse.json(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}
