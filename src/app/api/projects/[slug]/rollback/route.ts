import { NextRequest, NextResponse } from 'next/server';
import { getProjectMetadata, saveProjectMetadata, persistProjectToDB } from '@/app/api/lib/project-utils';
import { RollbackService } from '@/backend/services/rollback/rollback_service';
import { resolve } from 'path';
import { logger } from '@/lib/logger';
import { getCorrelationId } from '@/lib/correlation-id';
import { withAuth, type AuthSession } from '@/app/api/middleware/auth-guard';

export const runtime = 'nodejs';

const rollbackHandler = withAuth(
  async (
    request: NextRequest,
    context: { params: Promise<{ slug: string }> },
    session: AuthSession
  ) => {
    try {
      const { slug } = await context.params;
      const body = await request.json();

      const { targetPhase, confirm } = body;

      if (!targetPhase) {
        return NextResponse.json(
          { success: false, error: 'targetPhase is required' },
          { status: 400 }
        );
      }

      if (!confirm) {
        return NextResponse.json(
          { success: false, error: 'Confirmation required (confirm: true)' },
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

      const phasesCompleted = Array.isArray(metadata.phases_completed)
        ? metadata.phases_completed
        : (metadata.phases_completed ? String(metadata.phases_completed).split(',').filter(Boolean) : []);

      if (!phasesCompleted.includes(targetPhase)) {
        return NextResponse.json(
          { success: false, error: `Phase ${targetPhase} not found in completed phases` },
          { status: 400 }
        );
      }

      const projectPath = metadata.project_path || resolve(process.cwd(), 'projects', slug);
      const rollbackService = new RollbackService(projectPath);

      const projectId = metadata.id || slug;

      const result = await rollbackService.rollbackToPhase({
        projectId,
        targetPhase,
        phasesCompleted,
        confirmDangerousOperation: confirm
      });

      if (!result.success || !result.snapshotId) {
        return NextResponse.json(
          { success: false, error: result.error || 'Rollback failed' },
          { status: 400 }
        );
      }

      const updatedPhasesCompleted = phasesCompleted.filter((phase: string) => phase !== targetPhase);

      const updatedMetadata = {
        ...metadata,
        current_phase: targetPhase,
        phases_completed: updatedPhasesCompleted,
        updated_at: new Date().toISOString()
      };

      await saveProjectMetadata(slug, updatedMetadata);
      await persistProjectToDB(slug, updatedMetadata);

      logger.info('Rollback executed successfully', {
        project: slug,
        targetPhase,
        snapshotId: result.snapshotId,
        artifactCount: result.restoredArtifacts?.length,
        correlationId: getCorrelationId(),
      });

      return NextResponse.json({
        success: true,
        data: {
          snapshotId: result.snapshotId,
          restoredArtifacts: result.restoredArtifacts || [],
          gitCommitHash: result.gitCommitHash,
          currentPhase: targetPhase,
          phasesCompleted: updatedPhasesCompleted
        }
      });
    } catch (error) {
      const { slug } = await context.params;
      logger.error('Error executing rollback', error instanceof Error ? error : new Error(String(error)), {
        project: slug,
        correlationId: getCorrelationId(),
      });
      return NextResponse.json(
        {
          success: false,
          error: `Failed to execute rollback: ${
            error instanceof Error ? error.message : String(error)
          }`
        },
        { status: 500 }
      );
    }
  }
);

export const POST = rollbackHandler;
