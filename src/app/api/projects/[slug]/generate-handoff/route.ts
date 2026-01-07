import { NextRequest, NextResponse } from 'next/server';
import {
  getProjectMetadata,
  saveProjectMetadata,
  saveArtifact,
  persistProjectToDB,
  listArtifacts,
  readArtifact,
} from '@/app/api/lib/project-utils';
import { HandoffGenerator } from '@/backend/services/file_system/handoff_generator';
import { ProjectDBService } from '@/backend/services/database/drizzle_project_db_service';
import { withAuth, type AuthSession } from '@/app/api/middleware/auth-guard';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

export const POST = withAuth(
  async (
    _request: NextRequest,
    { params }: { params: Promise<{ slug: string }> },
    session: AuthSession
  ) => {
    try {
      const { slug } = await params;

      const metadata = await getProjectMetadata(slug, session.user.id);

      if (!metadata || metadata.created_by_id !== session.user.id) {
        return NextResponse.json(
          { success: false, error: 'Project not found' },
          { status: 404 }
        );
      }

      // Only generate handoff in DONE phase
      if (metadata.current_phase !== 'DONE') {
        return NextResponse.json(
          {
            success: false,
            error: `Cannot generate handoff in ${metadata.current_phase} phase. Project must be in DONE phase.`,
          },
          { status: 400 }
        );
      }

      // Generate HANDOFF.md and README.md
      const generator = new HandoffGenerator(slug);
      const handoffContent = await generator.generateHandoff(slug, metadata);

      // Save HANDOFF.md artifact
      await saveArtifact(slug, 'DONE', 'HANDOFF.md', handoffContent);

      // Collect artifacts for README generation
      const allPhases = [
        'ANALYSIS',
        'STACK_SELECTION',
        'SPEC_PM',
        'SPEC_ARCHITECT',
        'SPEC_DESIGN_TOKENS',
        'SPEC_DESIGN_COMPONENTS',
        'FRONTEND_BUILD',
        'DEPENDENCIES',
        'SOLUTIONING',
        'VALIDATE',
      ];
      const artifacts: Record<string, string | Buffer> = {};
      for (const phase of allPhases) {
        try {
          const phaseArtifacts = await listArtifacts(slug, phase);
          for (const artifact of phaseArtifacts) {
            try {
              artifacts[`${phase}/${artifact.name}`] = await readArtifact(
                slug,
                phase,
                artifact.name
              );
            } catch {
              artifacts[`${phase}/${artifact.name}`] = '';
            }
          }
        } catch {
          // Continue even if some phases don't have artifacts
        }
      }

      // Generate and save README.md
      const readmeContent = await generator.generateReadme(
        slug,
        metadata,
        artifacts
      );
      await saveArtifact(slug, 'DONE', 'README.md', readmeContent);

      // Log artifacts to database
      try {
        const dbService = new ProjectDBService();
        const project = await dbService.getProjectBySlug(slug, session.user.id);
        if (project) {
          await dbService.saveArtifact(
            project.id,
            'DONE',
            'HANDOFF.md',
            handoffContent
          );
          await dbService.saveArtifact(
            project.id,
            'DONE',
            'README.md',
            readmeContent
          );
        }
      } catch (dbError) {
        const dbErr =
          dbError instanceof Error ? dbError : new Error(String(dbError));
        logger.error('Warning: Failed to log artifacts to database:', dbErr);
        // Don't fail the request if database logging fails
      }

      // Update metadata to mark handoff as generated
      const updated = {
        ...metadata,
        handoff_generated: true,
        handoff_generated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_by_id: metadata.created_by_id || session.user.id,
      };

      await saveProjectMetadata(slug, updated);
      await persistProjectToDB(slug, updated);

      return NextResponse.json({
        success: true,
        data: {
          message: 'HANDOFF.md and README.md generated successfully',
          slug,
          artifacts_generated: ['HANDOFF.md', 'README.md'],
          size_bytes: {
            handoff: handoffContent.length,
            readme: readmeContent.length,
          },
          phases_included: [
            'ANALYSIS',
            'STACK_SELECTION',
            'SPEC_PM',
            'SPEC_ARCHITECT',
            'SPEC_DESIGN_TOKENS',
            'SPEC_DESIGN_COMPONENTS',
            'FRONTEND_BUILD',
            'DEPENDENCIES',
            'SOLUTIONING',
            'VALIDATE',
          ],
          ready_for_download: true,
        },
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Error generating handoff:', err);
      return NextResponse.json(
        {
          success: false,
          error: `Failed to generate handoff: ${err.message}`,
        },
        { status: 500 }
      );
    }
  }
);
