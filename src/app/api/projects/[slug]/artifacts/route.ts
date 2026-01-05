import { NextRequest, NextResponse } from 'next/server';
import { getProjectMetadata, listArtifacts, readArtifact } from '@/app/api/lib/project-utils';
import { withAuth, type AuthSession } from '@/app/api/middleware/auth-guard';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

export const GET = withAuth(
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

    // Get artifacts for all phases (both completed and current)
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
      'AUTO_REMEDY',
      'DONE'
    ];
    const artifactsByPhase: Record<string, Array<{ name: string; size: number; content: string | null }>> = {};

    for (const phase of allPhases) {
      const phaseArtifacts = await listArtifacts(slug, phase);
      logger.info(`Phase ${phase} artifacts from listArtifacts`, { slug, phase, count: phaseArtifacts.length });

      // If artifacts exist for this phase, read their content from R2 or filesystem
      const artifactsWithContent = await Promise.all(
        phaseArtifacts.map(async (artifact: { name: string; size: number }) => {
          try {
            const content = await readArtifact(slug, phase, artifact.name);
            logger.info(`Read artifact content`, { slug, phase, name: artifact.name, contentLength: content.length });
            return {
              name: artifact.name,
              size: artifact.size,
              content
            };
          } catch (error) {
            logger.error(`Error reading artifact ${artifact.name} from phase ${phase}:`, error instanceof Error ? error : undefined);
            return {
              name: artifact.name,
              size: artifact.size,
              content: null
            };
          }
        })
      );

      // Only include phases that have artifacts
      if (artifactsWithContent.length > 0) {
        logger.info(`Including phase ${phase} in response`, { slug, phase, artifactCount: artifactsWithContent.length });
        artifactsByPhase[phase] = artifactsWithContent;
      }
    }

      logger.info('Final artifacts response', { slug, phases: Object.keys(artifactsByPhase), totalArtifacts: Object.values(artifactsByPhase).flat().length });

      return NextResponse.json(
        {
          success: true,
          data: {
            phase: metadata.current_phase,
            artifacts: artifactsByPhase
          }
        },
        {
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
          }
        }
      );
    } catch (error) {
      logger.error('Error listing artifacts:', error instanceof Error ? error : undefined);
      return NextResponse.json(
        {
          success: false,
          error: `Failed to list artifacts: ${
            error instanceof Error ? error.message : String(error)
          }`
        },
        { status: 500 }
      );
    }
  }
);
