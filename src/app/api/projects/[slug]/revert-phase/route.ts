import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/backend/lib/drizzle';
import { projects, artifacts, phaseHistory, stackChoices, dependencyApprovals } from '@/backend/lib/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { logger } from '@/lib/logger';

// Phase order for determining which phases to clear
const PHASE_ORDER = [
  'ANALYSIS',
  'STACK_SELECTION',
  'SPEC',
  'SOLUTIONING',
  'DEPENDENCIES',
  'VALIDATE',
  'DONE'
];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const body = await request.json();
    const { targetPhase } = body;

    if (!targetPhase || !PHASE_ORDER.includes(targetPhase)) {
      return NextResponse.json(
        { success: false, error: `Invalid target phase: ${targetPhase}` },
        { status: 400 }
      );
    }

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

    const currentPhaseIndex = PHASE_ORDER.indexOf(project.currentPhase);
    const targetPhaseIndex = PHASE_ORDER.indexOf(targetPhase);

    // Can only revert to earlier or same phase
    if (targetPhaseIndex > currentPhaseIndex) {
      return NextResponse.json(
        { success: false, error: `Cannot advance to ${targetPhase}. Use normal phase progression.` },
        { status: 400 }
      );
    }

    // Determine which phases to clear (targetPhase and all phases after it)
    const phasesToClear = PHASE_ORDER.slice(targetPhaseIndex);
    
    // Determine completed phases (all phases before targetPhase)
    const completedPhases = PHASE_ORDER.slice(0, targetPhaseIndex);

    logger.info('Reverting project to phase', { 
      slug, 
      targetPhase, 
      currentPhase: project.currentPhase,
      phasesToClear,
      completedPhases
    });

    // Delete artifacts for phases being cleared
    if (phasesToClear.length > 0) {
      await db.delete(artifacts).where(
        and(
          eq(artifacts.projectId, project.id),
          inArray(artifacts.phase, phasesToClear)
        )
      );
    }

    // Delete phase history for phases being cleared
    if (phasesToClear.length > 0) {
      await db.delete(phaseHistory).where(
        and(
          eq(phaseHistory.projectId, project.id),
          inArray(phaseHistory.phase, phasesToClear)
        )
      );
    }

    // Handle special resets based on target phase
    const updates: Record<string, unknown> = {
      currentPhase: targetPhase,
      phasesCompleted: completedPhases.join(','),
      updatedAt: new Date(),
    };

    // If reverting to before STACK_SELECTION, clear stack choice
    if (targetPhaseIndex <= PHASE_ORDER.indexOf('STACK_SELECTION')) {
      updates.stackChoice = null;
      updates.stackApproved = false;
      await db.delete(stackChoices).where(eq(stackChoices.projectId, project.id));
    }

    // If reverting to before DEPENDENCIES, clear dependency approval
    if (targetPhaseIndex <= PHASE_ORDER.indexOf('DEPENDENCIES')) {
      updates.dependenciesApproved = false;
      await db.delete(dependencyApprovals).where(eq(dependencyApprovals.projectId, project.id));
    }

    // If reverting to ANALYSIS, clear clarification state
    if (targetPhase === 'ANALYSIS') {
      updates.clarificationState = null;
      updates.clarificationCompleted = false;
    }

    // If reverting from DONE, clear handoff flag
    if (project.currentPhase === 'DONE') {
      updates.handoffGenerated = false;
    }

    // Update project
    await db.update(projects)
      .set(updates)
      .where(eq(projects.id, project.id));

    logger.info('Project reverted to phase', { slug, targetPhase });

    return NextResponse.json(
      {
        success: true,
        message: `Project reverted to ${targetPhase} phase`,
        project: {
          slug,
          current_phase: targetPhase,
          phases_completed: completedPhases,
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
    logger.error('Failed to revert project phase', err);
    return NextResponse.json(
      { success: false, error: 'Failed to revert project phase' },
      { status: 500 }
    );
  }
}
