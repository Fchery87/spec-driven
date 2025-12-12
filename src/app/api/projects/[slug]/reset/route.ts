import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/backend/lib/drizzle';
import { projects, artifacts, phaseHistory, stackChoices, dependencyApprovals } from '@/backend/lib/schema';
import { eq } from 'drizzle-orm';
import { logger } from '@/lib/logger';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    // Find the project
    const project = await db.query.projects.findFirst({
      where: eq(projects.slug, slug),
    });

    if (!project) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      );
    }

    // Delete all related data
    await db.delete(artifacts).where(eq(artifacts.projectId, project.id));
    await db.delete(phaseHistory).where(eq(phaseHistory.projectId, project.id));
    await db.delete(stackChoices).where(eq(stackChoices.projectId, project.id));
    await db.delete(dependencyApprovals).where(eq(dependencyApprovals.projectId, project.id));

    // Reset project to initial state
    await db.update(projects)
      .set({
        currentPhase: 'ANALYSIS',
        phasesCompleted: '',
        stackChoice: null,
        stackApproved: false,
        dependenciesApproved: false,
        handoffGenerated: false,
        clarificationState: null,
        clarificationCompleted: false,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, project.id));

    logger.info('Project reset to ANALYSIS phase', { slug, projectId: project.id });

    return NextResponse.json(
      {
        success: true,
        message: 'Project reset to ANALYSIS phase',
        project: {
          slug,
          current_phase: 'ANALYSIS',
        },
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to reset project', err);
    return NextResponse.json(
      { success: false, error: 'Failed to reset project' },
      { status: 500 }
    );
  }
}
