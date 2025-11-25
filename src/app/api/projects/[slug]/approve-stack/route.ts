import { NextRequest, NextResponse } from 'next/server';
import { getProjectMetadata, saveProjectMetadata, writeArtifact, persistProjectToDB } from '@/app/api/lib/project-utils';
import { ProjectDBService } from '@/backend/services/database/drizzle_project_db_service';
import { logger } from '@/lib/logger';
import { withAuth, type AuthSession } from '@/app/api/middleware/auth-guard';
import { ApproveStackSchema } from '@/app/api/schemas';

export const runtime = 'nodejs';

export const POST = withAuth(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ slug: string }> },
    session: AuthSession
  ) => {
    try {
      const { slug } = await params;
      const body = await request.json();

      // Validate input with Zod schema
      const validationResult = ApproveStackSchema.safeParse(body);
      if (!validationResult.success) {
        logger.warn('POST /api/projects/:slug/approve-stack - validation failed', {
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

      const { stack_choice, reasoning, platform } = validationResult.data;

      const metadata = await getProjectMetadata(slug, session.user.id);

      if (!metadata || metadata.created_by_id !== session.user.id) {
        return NextResponse.json(
          { success: false, error: 'Project not found' },
          { status: 404 }
        );
      }

      // Generate stack approval artifacts
      const stackDecisionContent = `---
title: "Architecture Decision"
owner: "architect"
version: "1"
date: "${new Date().toISOString().split('T')[0]}"
status: "approved"
---

# Architecture Decision

## Selected Pattern
**${stack_choice}**

## Rationale
${reasoning || 'Architecture pattern approved.'}

## Date Approved
${new Date().toISOString()}

## Next Steps
This architectural decision will guide the selection of specific technologies in the DEPENDENCIES phase.
`;

      // Write artifacts to filesystem
      await writeArtifact(slug, 'STACK_SELECTION', 'stack-decision.md', stackDecisionContent);

      // DB-primary: persist artifacts to database
      const dbService = new ProjectDBService();
      const dbProject = await dbService.getProjectBySlug(slug, session.user.id);

      if (dbProject) {
        try {
          await dbService.saveArtifact(
            dbProject.id,
            'STACK_SELECTION',
            'stack-decision.md',
            stackDecisionContent
          );

          logger.info('Stack approval artifacts persisted to database', {
            slug,
            projectId: dbProject.id,
          });
        } catch (dbError) {
          logger.warn(
            `Failed to persist stack artifacts to database: ${dbError instanceof Error ? dbError.message : String(dbError)}`,
            { slug }
          );
          // Don't fail the request; artifacts are still in filesystem
        }
      }

      // Update project metadata
      const updated = {
        ...metadata,
        stack_choice,
        platform_type: platform,
        stack_approved: true,
        stack_approval_date: new Date().toISOString(),
        stack_reasoning: reasoning,
        created_by_id: metadata.created_by_id || session.user.id,
        updated_at: new Date().toISOString(),
      };

      await saveProjectMetadata(slug, updated);
      await persistProjectToDB(slug, updated);

      logger.info('Stack selection approved', {
        slug,
        userId: session.user.id,
        stackChoice: stack_choice,
      });

      return NextResponse.json({
        success: true,
        data: {
          slug,
          stack_choice,
          platform_type: platform,
          stack_approved: true,
          message: 'Stack selection approved successfully',
        },
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Error approving stack:', err);
      return NextResponse.json(
        { success: false, error: 'Failed to approve stack' },
        { status: 500 }
      );
    }
  }
);
