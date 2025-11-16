import { NextRequest, NextResponse } from 'next/server';
import { getProjectMetadata, saveProjectMetadata, listArtifacts, persistProjectToDB } from '@/app/api/lib/project-utils';
import { logger } from '@/lib/logger';

const PHASES = ['ANALYSIS', 'STACK_SELECTION', 'SPEC', 'DEPENDENCIES', 'SOLUTIONING', 'DONE'];

const getPhaseOutputs = (phase: string): string[] => {
  const outputs: Record<string, string[]> = {
    ANALYSIS: ['constitution.md', 'project-brief.md', 'personas.md'],
    STACK_SELECTION: ['plan.md', 'README.md'],
    SPEC: ['PRD.md', 'data-model.md', 'api-spec.json'],
    DEPENDENCIES: ['DEPENDENCIES.md', 'dependency-proposal.md'],
    SOLUTIONING: ['architecture.md', 'epics.md', 'tasks.md'],
    DONE: ['HANDOFF.md']
  };
  return outputs[phase] || [];
};

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params;
    const body = await request.json();
    const { action } = body;

    const metadata = getProjectMetadata(slug);

    if (!metadata) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      );
    }

    if (action === 'validate') {
      const artifacts = listArtifacts(slug, metadata.current_phase);
      const requiredFiles = getPhaseOutputs(metadata.current_phase);
      const hasAllFiles = requiredFiles.every(file =>
        artifacts.some(a => a.name === file)
      );

      return NextResponse.json({
        success: true,
        data: {
          phase: metadata.current_phase,
          artifacts: artifacts,
          required: requiredFiles,
          is_complete: hasAllFiles
        }
      });
    }

    if (action === 'advance') {
      const currentPhaseIndex = PHASES.indexOf(metadata.current_phase);
      if (currentPhaseIndex === -1 || currentPhaseIndex >= PHASES.length - 1) {
        return NextResponse.json(
          { success: false, error: 'No next phase' },
          { status: 400 }
        );
      }

      const nextPhase = PHASES[currentPhaseIndex + 1];

      // Convert phases_completed to array for manipulation, then persistProjectToDB will convert to string
      const currentCompletedArray = Array.isArray(metadata.phases_completed)
        ? metadata.phases_completed
        : (metadata.phases_completed ? metadata.phases_completed.split(',').filter((p: string) => p) : []);

      const updated = {
        ...metadata,
        phases_completed: [...currentCompletedArray, metadata.current_phase],
        current_phase: nextPhase,
        updated_at: new Date().toISOString()
      };

      saveProjectMetadata(slug, updated);
      await persistProjectToDB(slug, updated);

      return NextResponse.json({
        success: true,
        data: {
          previous_phase: metadata.current_phase,
          new_phase: nextPhase,
          message: `Advanced to ${nextPhase} phase`
        }
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    logger.error('Error managing phase:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to manage phase' },
      { status: 500 }
    );
  }
}
