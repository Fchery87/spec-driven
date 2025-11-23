import { NextRequest, NextResponse } from 'next/server';
import { getProjectMetadata, saveProjectMetadata, writeArtifact, persistProjectToDB } from '@/app/api/lib/project-utils';
import { ProjectDBService } from '@/backend/services/database/drizzle_project_db_service';
import { logger } from '@/lib/logger';
import { withAuth, type AuthSession } from '@/app/api/middleware/auth-guard';
import { ApproveDependenciesSchema } from '@/app/api/schemas';

export const runtime = 'nodejs';

export const POST = withAuth(
  async (
    request: NextRequest,
    { params }: { params: { slug: string } },
    session: AuthSession
  ) => {
    try {
      const { slug } = params;
      const body = await request.json();

      // Validate input with Zod schema
      const validationResult = ApproveDependenciesSchema.safeParse(body);
      if (!validationResult.success) {
        logger.warn(
          'POST /api/projects/:slug/approve-dependencies - validation failed',
          {
            errors: validationResult.error.flatten(),
          }
        );
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid input',
            details: validationResult.error.flatten().fieldErrors,
          },
          { status: 400 }
        );
      }

      const { notes: approvalNotes } = validationResult.data;

      const metadata = await getProjectMetadata(slug);

      if (!metadata) {
        return NextResponse.json(
          { success: false, error: 'Project not found' },
          { status: 404 }
        );
      }

      // Check if in DEPENDENCIES phase
      if (metadata.current_phase !== 'DEPENDENCIES') {
        return NextResponse.json(
          {
            success: false,
            error: `Cannot approve dependencies in ${metadata.current_phase} phase. Must be in DEPENDENCIES phase.`,
          },
          { status: 400 }
        );
      }

      // Create approval artifact
      const approvalContent = `---
title: "Dependencies Approval"
owner: "devops"
version: "1"
date: "${new Date().toISOString().split('T')[0]}"
status: "approved"
---

# Dependencies Approval

## Status
**Approved**

## Approval Notes
${approvalNotes || 'Dependencies reviewed and approved for this project.'}

## Date Approved
${new Date().toISOString()}

## What This Means
All project dependencies have been reviewed and approved. The project is now cleared to proceed to the SOLUTIONING phase where architecture design and task breakdown will occur.
`;

      // Write artifact to filesystem
      await writeArtifact(slug, 'DEPENDENCIES', 'approval.md', approvalContent);

      // DB-primary: persist artifact to database
      const dbService = new ProjectDBService();
      const dbProject = await dbService.getProjectBySlug(slug);

      if (dbProject) {
        try {
          await dbService.saveArtifact(
            dbProject.id,
            'DEPENDENCIES',
            'approval.md',
            approvalContent
          );

          logger.info(
            'Dependencies approval artifact persisted to database',
            {
              slug,
              projectId: dbProject.id,
            }
          );
        } catch (dbError) {
          logger.warn(
            `Failed to persist dependencies approval to database: ${dbError instanceof Error ? dbError.message : String(dbError)}`,
            { slug }
          );
          // Don't fail the request; artifact is still in filesystem
        }
      }

      // Update project metadata
      const updated = {
        ...metadata,
        dependencies_approved: true,
        dependencies_approval_date: new Date().toISOString(),
        dependencies_approval_notes: approvalNotes,
        updated_at: new Date().toISOString(),
      };

      await saveProjectMetadata(slug, updated);
      await persistProjectToDB(slug, updated);

      logger.info('Dependencies approved', {
        slug,
        userId: session.user.id,
      });

      return NextResponse.json({
        success: true,
        data: {
          slug,
          dependencies_approved: true,
          message: 'Dependencies approved successfully',
        },
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Error approving dependencies:', err);
      return NextResponse.json(
        { success: false, error: 'Failed to approve dependencies' },
        { status: 500 }
      );
    }
  }
);
