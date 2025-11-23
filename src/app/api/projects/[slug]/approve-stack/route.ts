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
    { params }: { params: { slug: string } },
    session: AuthSession
  ) => {
    try {
      const { slug } = params;
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

      const metadata = await getProjectMetadata(slug);

      if (!metadata) {
        return NextResponse.json(
          { success: false, error: 'Project not found' },
          { status: 404 }
        );
      }

      // Generate stack approval artifacts
      const stackContent = `---
title: "Technology Stack Selection"
owner: "architect"
version: "1"
date: "${new Date().toISOString().split('T')[0]}"
status: "approved"
---

# Technology Stack Selection

## Selected Stack
**${stack_choice}**

## Rationale
${reasoning || 'Stack selection approved.'}

## Date Approved
${new Date().toISOString()}
`;

      const readmeContent = `# Stack Selection Documentation

This folder contains documentation about the approved technology stack for this project.

## Approved Stack
**${stack_choice}**

## Selection Details
See plan.md for the full rationale and decision documentation.
`;

      // Write artifacts to filesystem
      await writeArtifact(slug, 'STACK_SELECTION', 'plan.md', stackContent);
      await writeArtifact(slug, 'STACK_SELECTION', 'README.md', readmeContent);

      // DB-primary: persist artifacts to database
      const dbService = new ProjectDBService();
      const dbProject = await dbService.getProjectBySlug(slug);

      if (dbProject) {
        try {
          await dbService.saveArtifact(
            dbProject.id,
            'STACK_SELECTION',
            'plan.md',
            stackContent
          );
          await dbService.saveArtifact(
            dbProject.id,
            'STACK_SELECTION',
            'README.md',
            readmeContent
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
