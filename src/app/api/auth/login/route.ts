import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/backend/services/auth/auth_service';
import { withErrorHandlerParams } from '@/backend/middleware/error_handler_middleware';
import { validateInput, LoginSchema } from '@/backend/lib/validation_schemas';
import { sanitizeRequest } from '@/backend/lib/sanitizer';
import { formatErrorResponse } from '@/backend/lib/error_handler';

/**
 * POST /api/auth/login
 *
 * Login a user and return JWT token
 * Body: { email: string, password: string }
 *
 * Returns:
 * - 200: Login successful with JWT token
 * - 400: Validation error
 * - 401: Invalid credentials
 * - 500: Server error
 */
async function loginHandler(request: NextRequest) {
  // Parse and sanitize request body
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      formatErrorResponse(
        new Error('Invalid JSON in request body'),
        request.headers.get('x-request-id') || undefined
      ),
      { status: 400 }
    );
  }

  // Sanitize input to prevent XSS/injection
  const sanitized = sanitizeRequest(body);

  // Validate input against schema
  const validated = validateInput(LoginSchema, sanitized, 'login request');

  // Perform login
  const result = await authService.login(validated);

  if (!result.success) {
    return NextResponse.json(result, { status: 401 });
  }

  return NextResponse.json(result, { status: 200 });
}

export const POST = withErrorHandlerParams(loginHandler);

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
