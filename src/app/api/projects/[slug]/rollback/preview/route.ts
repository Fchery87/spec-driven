import { NextRequest, NextResponse } from 'next/server';
import { getProjectMetadata } from '@/app/api/lib/project-utils';
import { RollbackService } from '@/backend/services/rollback/rollback_service';
import { resolve } from 'path';
import { logger } from '@/lib/logger';
import { withAuth, type AuthSession } from '@/app/api/middleware/auth-guard';

export const runtime = 'nodejs';

const previewHandler = withAuth(
  async (
    request: NextRequest,
    context: { params: Promise<{ slug: string }> },
    session: AuthSession
  ) => {
    try {
      const { slug } = await context.params;
      const { searchParams } = new URL(request.url);
      const targetPhase = searchParams.get('targetPhase');

      if (!targetPhase) {
        return NextResponse.json(
          { success: false, error: 'targetPhase query parameter is required' },
          { status: 400 }
        );
      }

      const metadata = await getProjectMetadata(slug, session.user.id);

      if (!metadata || metadata.created_by_id !== session.user.id) {
        return NextResponse.json(
          { success: false, error: 'Project not found' },
          { status: 404 }
        );
      }

      const projectPath = metadata.project_path || resolve(process.cwd(), 'projects', slug);
      const rollbackService = new RollbackService(projectPath);

      const projectId = metadata.id || slug;

      const result = await rollbackService.getRollbackPreview(
        projectId,
        targetPhase
      );

      if (!result.success || !result.artifacts) {
        return NextResponse.json(
          { success: false, error: result.error || 'Failed to get rollback preview' },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        data: {
          artifacts: result.artifacts,
          metadata: result.metadata,
          gitCommitHash: result.gitCommitHash
        }
      });
    } catch (error) {
      const { slug } = await context.params;
      logger.error('Error getting rollback preview', error instanceof Error ? error : new Error(String(error)), {
        project: slug,
      });
      return NextResponse.json(
        {
          success: false,
          error: `Failed to get rollback preview: ${
            error instanceof Error ? error.message : String(error)
          }`
        },
        { status: 500 }
      );
    }
  }
);

export const GET = previewHandler;
