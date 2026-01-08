import { NextRequest, NextResponse } from 'next/server';
import { ProjectDBService } from '@/backend/services/database/drizzle_project_db_service';
import { ApprovalGateService } from '@/backend/services/approval/approval_gate_service';
import { logger } from '@/lib/logger';
import { withAuth, type AuthSession } from '@/app/api/middleware/auth-guard';

export const runtime = 'nodejs';

export const GET = withAuth(
  async (
    _request: NextRequest,
    { params }: { params: Promise<{ slug: string }> },
    session: AuthSession
  ) => {
    try {
      const { slug } = await params;

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
      const gates = await approvalService.getProjectGates(project.id);

      logger.info('Retrieved approval gates for project', {
        slug,
        userId: session.user.id,
        gateCount: gates.length,
      });

      return NextResponse.json({
        success: true,
        data: {
          projectId: project.id,
          slug: project.slug,
          gates,
        },
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Error retrieving approval gates:', err);
      return NextResponse.json(
        { success: false, error: 'Failed to retrieve approval gates' },
        { status: 500 }
      );
    }
  }
);
