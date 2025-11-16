import { NextRequest, NextResponse } from 'next/server';
import { getProjectMetadata, saveProjectMetadata, writeArtifact, persistProjectToDB } from '@/app/api/lib/project-utils';
import { ProjectDBService } from '@/backend/services/database/project_db_service';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params;
    const body = await request.json();
    const { approvalNotes } = body;

    const metadata = getProjectMetadata(slug);

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
          error: `Cannot approve dependencies in ${metadata.current_phase} phase. Must be in DEPENDENCIES phase.`
        },
        { status: 400 }
      );
    }

    const updated = {
      ...metadata,
      dependencies_approved: true,
      dependencies_approval_date: new Date().toISOString(),
      dependencies_approval_notes: approvalNotes,
      updated_at: new Date().toISOString()
    };

    saveProjectMetadata(slug, updated);
    await persistProjectToDB(slug, updated);

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

    writeArtifact(slug, 'DEPENDENCIES', 'approval.md', approvalContent);

    // Log artifact to database
    try {
      const dbService = new ProjectDBService();
      const project = await dbService.getProjectBySlug(slug);
      if (project) {
        await dbService.saveArtifact(project.id, 'DEPENDENCIES', 'approval.md', approvalContent);
      }
    } catch (dbError) {
      logger.error('Warning: Failed to log artifact to database:', dbError);
      // Don't fail the request if database logging fails
    }

    return NextResponse.json({
      success: true,
      data: {
        slug,
        dependencies_approved: true,
        message: 'Dependencies approved successfully'
      }
    });
  } catch (error) {
    logger.error('Error approving dependencies:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to approve dependencies' },
      { status: 500 }
    );
  }
}
