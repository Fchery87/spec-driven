import { NextRequest, NextResponse } from 'next/server';
import { existsSync, rmSync } from 'fs';
import { resolve } from 'path';
import { db } from '@/backend/lib/drizzle';
import { projects, artifacts, phaseHistory, stackChoices } from '@/backend/lib/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { withAuth, type AuthSession } from '@/app/api/middleware/auth-guard';
import { getProjectMetadata, getProjectsPath, saveProjectMetadata, type ProjectMetadata } from '@/app/api/lib/project-utils';
import { listR2Artifacts, deleteFromR2 } from '@/lib/r2-storage';

export const runtime = 'nodejs';

// Phase order for determining which phases to clear
// NOTE: Must match the canonical order used throughout the app (ProjectPage, phase-status utils, /phase route)
const PHASE_ORDER = ['ANALYSIS', 'STACK_SELECTION', 'SPEC', 'DEPENDENCIES', 'SOLUTIONING', 'VALIDATE', 'DONE'];

export const POST = withAuth(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ slug: string }> },
    session: AuthSession
  ) => {
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

    // Find the project (scoped to owner for security)
    const project = await db.query.projects.findFirst({
      where: and(eq(projects.slug, slug), eq(projects.ownerId, session.user.id)),
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

    // If reverting to ANALYSIS, clear clarification state
    if (targetPhase === 'ANALYSIS') {
      updates.clarificationState = null;
      updates.clarificationCompleted = false;
    }

    // If reverting from DONE, clear handoff flag
    if (project.currentPhase === 'DONE') {
      updates.handoffGenerated = false;
    }

    // Update project in database
    await db.update(projects)
      .set(updates)
      .where(eq(projects.id, project.id));

    // Keep metadata.json (R2 / filesystem) in sync with DB so the UI reflects the reverted phase.
    // The UI reads project state via GET /api/projects/[slug] -> getProjectMetadata(), which prefers R2/filesystem.
    const existingMetadata = await getProjectMetadata(slug, session.user.id);
    const nowIso = new Date().toISOString();

    const baseMetadata: ProjectMetadata = existingMetadata ?? {
      id: project.id,
      slug: project.slug,
      name: project.name,
      description: project.description,
      current_phase: project.currentPhase,
      phases_completed: project.phasesCompleted,
      stack_choice: project.stackChoice,
      stack_approved: project.stackApproved,
      created_by_id: session.user.id,
      created_at: project.createdAt?.toISOString?.(),
      updated_at: project.updatedAt?.toISOString?.(),
    };

    const updatedMetadata: ProjectMetadata = {
      ...baseMetadata,
      created_by_id: baseMetadata.created_by_id || session.user.id,
      current_phase: targetPhase,
      phases_completed: completedPhases,
      updated_at: nowIso,
    };

    // Mirror the DB reset logic into metadata
    if (targetPhaseIndex <= PHASE_ORDER.indexOf('STACK_SELECTION')) {
      updatedMetadata.stack_choice = null;
      updatedMetadata.stack_approved = false;
    }

    if (targetPhase === 'ANALYSIS') {
      updatedMetadata.clarification_state = undefined;
    }

    if (project.currentPhase === 'DONE') {
      updatedMetadata.handoff_generated = false;
      updatedMetadata.handoff_generated_at = undefined;
    }

    await saveProjectMetadata(slug, updatedMetadata);

    // Delete local filesystem artifacts for cleared phases
    for (const phase of phasesToClear) {
      try {
        const phaseDir = resolve(getProjectsPath(), slug, 'specs', phase);
        if (existsSync(phaseDir)) {
          rmSync(phaseDir, { recursive: true, force: true });
          logger.debug('Deleted local phase directory', { slug, phase });
        }
      } catch (fsError) {
        const err = fsError instanceof Error ? fsError : new Error(String(fsError));
        logger.warn('Failed to delete local phase artifacts', { slug, phase, error: err.message });
      }
    }

    // Delete R2 artifacts for cleared phases (if R2 is configured)
    for (const phase of phasesToClear) {
      try {
        const r2Artifacts = await listR2Artifacts(slug, phase);
        for (const artifact of r2Artifacts) {
          await deleteFromR2(slug, phase, artifact.name);
        }
        logger.debug('Deleted R2 phase artifacts', { slug, phase, count: r2Artifacts.length });
      } catch (r2Error) {
        // R2 might not be configured - that's okay
        const err = r2Error instanceof Error ? r2Error : new Error(String(r2Error));
        logger.debug('R2 cleanup skipped or failed', { slug, phase, error: err.message });
      }
    }

    logger.info('Project reverted to phase', { slug, targetPhase, userId: session.user.id });

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
});
