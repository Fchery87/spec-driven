import { NextRequest, NextResponse } from 'next/server';
import { getProjectMetadata } from '@/app/api/lib/project-utils';
import { logger } from '@/lib/logger';
import { withAuth, type AuthSession } from '@/app/api/middleware/auth-guard';
import { z } from 'zod';

export const runtime = 'nodejs';

const RegenerateDependenciesSchema = z.object({
  feedback: z.string().optional(),
});

export const POST = withAuth(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ slug: string }> },
    session: AuthSession
  ) => {
    try {
      const { slug } = await params;
      const body = await request.json();

      // Validate input
      const validationResult = RegenerateDependenciesSchema.safeParse(body);
      if (!validationResult.success) {
        logger.warn('POST /api/projects/:slug/regenerate-dependencies - validation failed', {
          errors: validationResult.error.flatten(),
        });
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid input',
            details: validationResult.error.flatten().fieldErrors,
          },
          { status: 400 }
        );
      }

      const { feedback } = validationResult.data;

      const metadata = await getProjectMetadata(slug);

      if (!metadata) {
        return NextResponse.json(
          { success: false, error: 'Project not found' },
          { status: 404 }
        );
      }

      // Re-execute the DEPENDENCIES phase with feedback
      // This would trigger the DevOps agent to regenerate the dependencies
      // based on the user's feedback

      logger.info('Regenerate dependencies requested', {
        slug,
        userId: session.user.id,
        hasFeedback: !!feedback,
      });

      // TODO: Call orchestrator to re-execute DEPENDENCIES phase
      // For now, we'll just return success to indicate the request was received
      // In a real implementation, this would:
      // 1. Call the DevOps agent with the feedback
      // 2. Regenerate DEPENDENCIES.md
      // 3. Update the artifacts

      return NextResponse.json({
        success: true,
        data: {
          slug,
          message: 'Dependencies regeneration requested',
          feedback_received: !!feedback,
        },
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Error regenerating dependencies:', err);
      return NextResponse.json(
        { success: false, error: 'Failed to regenerate dependencies' },
        { status: 500 }
      );
    }
  }
);
