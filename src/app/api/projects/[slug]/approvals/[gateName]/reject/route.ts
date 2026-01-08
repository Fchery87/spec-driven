import { NextRequest, NextResponse } from 'next/server';
import { ProjectDBService } from '@/backend/services/database/drizzle_project_db_service';
import { ApprovalGateService } from '@/backend/services/approval/approval_gate_service';
import { logger } from '@/lib/logger';
import { withAuth, type AuthSession } from '@/app/api/middleware/auth-guard';

export const runtime = 'nodejs';

export const POST = withAuth(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ slug: string; gateName: string }> },
    session: AuthSession
  ) => {
    try {
      const { slug, gateName } = await params;
      const body = await request.json();
      const { reason } = body;

      if (!reason) {
        return NextResponse.json(
          { success: false, error: 'Reason is required for rejection' },
          { status: 400 }
        );
      }

      const dbService = new ProjectDBService();
      const project = await dbService.getProjectBySlug(slug, session.user.id);

      if (!project) {
        return NextResponse.json(
          { success: false, error: 'Project not found' },
          { status: 404 }
        );
      }

      if (project.ownerId !== session.user.id) {
        return NextResponse.json(
          { success: false, error: 'Forbidden: You do not have access to this project' },
          { status: 403 }
        );
      }

      const approvalService = new ApprovalGateService();
      const gateDefinition = approvalService.getGateDefinition(gateName as 'stack_approved' | 'prd_approved' | 'architecture_approved' | 'handoff_acknowledged');

      if (!gateDefinition) {
        return NextResponse.json(
          { success: false, error: `Invalid gate name: ${gateName}` },
          { status: 400 }
        );
      }

      await approvalService.rejectGate({
        projectId: project.id,
        gateName: gateName as 'stack_approved' | 'prd_approved' | 'architecture_approved' | 'handoff_acknowledged',
        rejectedBy: session.user.id,
        reason,
      });

      logger.info('Gate rejected', {
        slug,
        userId: session.user.id,
        gateName,
        reason,
      });

      return NextResponse.json({
        success: true,
        data: {
          projectId: project.id,
          slug: project.slug,
          gateName,
          status: 'rejected',
        },
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Error rejecting gate:', err);
      return NextResponse.json(
        { success: false, error: 'Failed to reject gate' },
        { status: 500 }
      );
    }
  }
);
