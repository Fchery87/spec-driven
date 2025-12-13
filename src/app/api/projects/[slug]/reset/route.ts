import { NextRequest, NextResponse } from 'next/server';
import { existsSync, rmSync } from 'fs';
import { resolve } from 'path';
import { db } from '@/backend/lib/drizzle';
import { projects, artifacts, phaseHistory, stackChoices, dependencyApprovals } from '@/backend/lib/schema';
import { and, eq } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { withAuth, type AuthSession } from '@/app/api/middleware/auth-guard';
import {
  getProjectMetadata,
  saveProjectMetadata,
  readArtifact,
  type ProjectMetadata,
  getProjectsPath,
} from '@/app/api/lib/project-utils';
import { deleteProjectFromR2, uploadProjectIdea } from '@/lib/r2-storage';

export const runtime = 'nodejs';

export const POST = withAuth(
  async (
    _request: NextRequest,
    { params }: { params: Promise<{ slug: string }> },
    session: AuthSession
  ) => {
    try {
      const { slug } = await params;

      // Find the project (scoped to owner)
      const project = await db.query.projects.findFirst({
        where: and(eq(projects.slug, slug), eq(projects.ownerId, session.user.id)),
      });

      if (!project) {
        return NextResponse.json(
          { success: false, error: 'Project not found' },
          { status: 404 }
        );
      }

      // Capture existing metadata + project idea so we can restore them after deleting artifacts.
      let existingMetadata: ProjectMetadata | null = null;
      try {
        existingMetadata = await getProjectMetadata(slug, session.user.id);
      } catch {
        existingMetadata = null;
      }

      let projectIdea = project.description || project.name;
      try {
        projectIdea = await readArtifact(slug, 'metadata', 'project_idea.txt');
      } catch {
        // Keep fallback
      }

      // Delete all related DB data
      await db.delete(artifacts).where(eq(artifacts.projectId, project.id));
      await db.delete(phaseHistory).where(eq(phaseHistory.projectId, project.id));
      await db.delete(stackChoices).where(eq(stackChoices.projectId, project.id));
      await db.delete(dependencyApprovals).where(eq(dependencyApprovals.projectId, project.id));

      // Reset project DB row to initial state
      await db.update(projects)
        .set({
          currentPhase: 'ANALYSIS',
          phasesCompleted: '',
          stackChoice: null,
          stackApproved: false,
          dependenciesApproved: false,
          handoffGenerated: false,
          handoffGeneratedAt: null,
          clarificationState: null,
          clarificationMode: 'hybrid',
          clarificationCompleted: false,
          updatedAt: new Date(),
        })
        .where(eq(projects.id, project.id));

      // Delete local generated artifacts (filesystem) so listArtifacts doesn't fall back to stale files.
      try {
        const specsDir = resolve(getProjectsPath(), slug, 'specs');
        if (existsSync(specsDir)) {
          rmSync(specsDir, { recursive: true, force: true });
        }
      } catch (fsError) {
        const err = fsError instanceof Error ? fsError : new Error(String(fsError));
        logger.warn('Failed to delete local project specs during reset', { slug, error: err.message });
      }

      // Delete remote artifacts (R2) and then restore metadata + project idea.
      // (Project metadata + idea are stored under the same prefix as specs artifacts.)
      try {
        await deleteProjectFromR2(slug);
      } catch (r2Error) {
        const err = r2Error instanceof Error ? r2Error : new Error(String(r2Error));
        logger.warn('Failed to delete project files from R2 during reset', { slug, error: err.message });
      }

      const nowIso = new Date().toISOString();
      const resetMetadata: ProjectMetadata = {
        ...(existingMetadata || {
          slug,
          name: project.name,
          description: project.description,
          created_by_id: session.user.id,
          created_at: project.createdAt?.toISOString?.() || nowIso,
          stack_approved: false,
          dependencies_approved: false,
          phases_completed: [],
          current_phase: 'ANALYSIS',
        }),
        slug,
        name: project.name,
        description: project.description,
        created_by_id: session.user.id,
        current_phase: 'ANALYSIS',
        phases_completed: [],
        stack_choice: null,
        stack_approved: false,
        dependencies_approved: false,
        handoff_generated: false,
        handoff_generated_at: undefined,
        orchestration_state: { artifact_versions: {}, phase_history: [], approval_gates: {} },
        clarification_state: undefined,
        updated_at: nowIso,
      };

      try {
        await saveProjectMetadata(slug, resetMetadata);
      } catch (metaError) {
        const err = metaError instanceof Error ? metaError : new Error(String(metaError));
        logger.warn('Failed to save reset metadata', { slug, error: err.message });
      }

      try {
        await uploadProjectIdea(slug, projectIdea);
      } catch {
        // Optional - if R2 isn't configured, execute-phase will fall back to description/name.
      }

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
);
