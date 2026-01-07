import { NextRequest, NextResponse } from 'next/server';
import {
  getProjectMetadata,
  saveProjectMetadata,
  listArtifacts,
  persistProjectToDB,
  writeArtifact,
  readArtifact,
} from '@/app/api/lib/project-utils';
import { OrchestratorEngine } from '@/backend/services/orchestrator/orchestrator_engine';
import { ProjectDBService } from '@/backend/services/database/drizzle_project_db_service';
import { resolve } from 'path';
import { logger } from '@/lib/logger';
import { getCorrelationId } from '@/lib/correlation-id';
import { withAuth, type AuthSession } from '@/app/api/middleware/auth-guard';

// Increase timeout for LLM operations (in seconds)
export const maxDuration = 300; // 5 minutes

export const runtime = 'nodejs';

const executePhaseHandler = withAuth(
  async (
    request: NextRequest,
     
    context: { params: Promise<{ slug: string }> },
     
    session: AuthSession
  ) => {
    try {
      const { slug } = await context.params;

      const metadata = await getProjectMetadata(slug, session.user.id);

      if (!metadata) {
        return NextResponse.json(
          { success: false, error: 'Project not found' },
          { status: 404 }
        );
      }
      if (metadata.created_by_id !== session.user.id) {
        return NextResponse.json(
          { success: false, error: 'Project not found' },
          { status: 404 }
        );
      }

      // Skip execution for user-driven phases
      if (metadata.current_phase === 'VALIDATE') {
        return NextResponse.json(
          {
            success: false,
            error:
              'Validation phase requires running checks. Use /validate endpoint instead.',
          },
          { status: 400 }
        );
      }

      if (metadata.current_phase === 'DONE') {
        return NextResponse.json(
          {
            success: false,
            error: 'Final phase. Use /generate-handoff endpoint instead.',
          },
          { status: 400 }
        );
      }

      // Collect artifacts from previous phases for context
      const previousArtifacts: Record<string, string | Buffer> = {};
      const allPhases = [
        'ANALYSIS',
        'STACK_SELECTION',
        'SPEC',
        'DEPENDENCIES',
        'SOLUTIONING',
        'VALIDATE',
        'DONE',
      ];
      const currentIndex = allPhases.indexOf(metadata.current_phase);

      // Read artifact content from R2 or filesystem for all completed phases
      for (let i = 0; i < currentIndex; i++) {
        const phaseArtifacts = await listArtifacts(slug, allPhases[i]);
        for (const artifact of phaseArtifacts) {
          try {
            const content = await readArtifact(
              slug,
              allPhases[i],
              artifact.name
            );
            previousArtifacts[`${allPhases[i]}/${artifact.name}`] = content;
          } catch (err) {
            logger.warn(
              `Failed to read artifact for context: ${
                err instanceof Error ? err.message : String(err)
              }`,
              {
                project: slug,
                phase: allPhases[i],
                artifact: artifact.name,
              }
            );
            previousArtifacts[`${allPhases[i]}/${artifact.name}`] = '';
          }
        }
      }

      // Add project idea for ANALYSIS phase (read from R2 if available, fallback to metadata)
      if (metadata.current_phase === 'ANALYSIS') {
        try {
          const projectIdea = await readArtifact(
            slug,
            'metadata',
            'project_idea.txt'
          );
          previousArtifacts['project_idea'] = projectIdea;
        } catch {
          // Fallback to description or name if project_idea not in R2
          previousArtifacts['project_idea'] =
            metadata.description || metadata.name;
        }
      }

      // Initialize orchestrator and run agent
      const orchestrator = new OrchestratorEngine();

      // Use actual database UUID if available, otherwise fall back to slug
      // This is critical because ApprovalGate table uses UUID for project_id
      const projectId = metadata.id || slug;

      const project = {
        id: projectId,
        slug,
        name: metadata.name,
        description: metadata.description || '',
        created_by_id: metadata.created_by_id || session.user.id,
        current_phase: metadata.current_phase,
        phases_completed: Array.isArray(metadata.phases_completed)
          ? metadata.phases_completed
          : metadata.phases_completed
          ? String(metadata.phases_completed).split(',').filter(Boolean)
          : [],
        stack_choice: metadata.stack_choice,
        stack_approved: metadata.stack_approved || false,
        stack_approval_date: metadata.stack_approval_date
          ? new Date(metadata.stack_approval_date)
          : undefined,
        created_at: metadata.created_at
          ? new Date(metadata.created_at)
          : new Date(),
        updated_at: metadata.updated_at
          ? new Date(metadata.updated_at)
          : new Date(),
        project_path: resolve(process.cwd(), 'projects', slug),
        orchestration_state: metadata.orchestration_state || {
          artifact_versions: {},
          phase_history: [],
        },
      } satisfies Parameters<OrchestratorEngine['runPhaseAgent']>[0];

      const result = await orchestrator.runPhaseAgent(
        project,
        previousArtifacts
      );

      if (!result.success) {
        // Record phase execution failure in database
        try {
          const dbService = new ProjectDBService();
          const dbProject = await dbService.getProjectBySlug(
            slug,
            session.user.id
          );
          if (dbProject) {
            await dbService.recordPhaseHistory(
              dbProject.id,
              metadata.current_phase,
              'failed',
              result.message
            );
          }
        } catch (dbError) {
          logger.warn(
            `Failed to record phase execution failure to database: ${
              dbError instanceof Error ? dbError.message : String(dbError)
            }`,
            {
              project: slug,
              phase: metadata.current_phase,
            }
          );
        }

        return NextResponse.json(
          { success: false, error: result.message },
          { status: 500 }
        );
      }

      // Save artifacts to R2 and database
      const dbService = new ProjectDBService();
      const dbProject = await dbService.getProjectBySlug(slug, session.user.id);

      logger.debug('Orchestrator result artifacts', {
        project: slug,
        phase: metadata.current_phase,
        artifactKeys: Object.keys(result.artifacts),
        artifactCount: Object.keys(result.artifacts).length,
      });

      if (dbProject) {
        try {
          // Persist all generated artifacts to R2 and database
          for (const [key, content] of Object.entries(result.artifacts)) {
            // Extract filename from key (e.g., "ANALYSIS/analysis_report.md" -> "analysis_report.md")
            const filename = key.split('/').pop() || key;

            logger.debug('Saving artifact', {
              project: slug,
              phase: metadata.current_phase,
              key,
              filename,
              contentLength: content.length,
            });

            // Save to R2 (with local filesystem fallback)
            await writeArtifact(
              slug,
              metadata.current_phase,
              filename,
              content
            );

            // Also persist to database for indexing and redundancy
            await dbService.saveArtifact(
              dbProject.id,
              metadata.current_phase,
              filename,
              content
            );
          }

          // Record phase execution success in database
          await dbService.recordPhaseHistory(
            dbProject.id,
            metadata.current_phase,
            'completed'
          );

          logger.info('Phase artifacts persisted to R2 and database', {
            project: slug,
            phase: metadata.current_phase,
            artifactCount: Object.keys(result.artifacts).length,
          });
        } catch (dbError) {
          logger.warn(
            `Failed to persist artifacts: ${
              dbError instanceof Error ? dbError.message : String(dbError)
            }`,
            {
              project: slug,
              phase: metadata.current_phase,
            }
          );
          // Don't fail the request; artifacts may still be in R2
        }
      }

      // Update project metadata with new artifact versions and orchestration state
      const mergedArtifacts = {
        ...previousArtifacts,
        ...result.artifacts,
      };

      const stackSelectionMetadata =
        metadata.current_phase === 'STACK_SELECTION'
          ? orchestrator.resolveStackSelectionMetadata(mergedArtifacts)
          : null;

      const updated = {
        ...metadata,
        project_type:
          stackSelectionMetadata?.projectType ?? metadata.project_type ?? null,
        scale_tier:
          stackSelectionMetadata?.scaleTier ?? metadata.scale_tier ?? null,
        recommended_stack:
          stackSelectionMetadata?.recommendedStack ??
          metadata.recommended_stack ??
          null,
        workflow_version:
          stackSelectionMetadata?.workflowVersion ?? metadata.workflow_version,
        orchestration_state: project.orchestration_state,
        updated_at: new Date().toISOString(),
      };

      await saveProjectMetadata(slug, updated);

      // Persist metadata to database
      await persistProjectToDB(slug, updated);

      return NextResponse.json({
        success: true,
        data: {
          phase: metadata.current_phase,
          message: result.message,
          artifacts: Object.keys(result.artifacts),
          artifact_count: Object.keys(result.artifacts).length,
        },
      });
    } catch (error) {
      const { slug: errorSlug } = await context.params;
      logger.error(
        'Error executing phase agent',
        error instanceof Error ? error : new Error(String(error)),
        {
          project: errorSlug,
          correlationId: getCorrelationId(),
        }
      );
      return NextResponse.json(
        {
          success: false,
          error: `Failed to execute phase agent: ${
            error instanceof Error ? error.message : String(error)
          }`,
        },
        { status: 500 }
      );
    }
  }
);

// Export handler directly - bypass middleware that don't support dynamic routes
// Rate limiting will be handled at the application level
export const POST = executePhaseHandler;
