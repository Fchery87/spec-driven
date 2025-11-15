import { NextRequest, NextResponse } from 'next/server';
import { getProjectMetadata, saveProjectMetadata, listArtifacts } from '@/app/api/lib/project-utils';
import { OrchestratorEngine } from '@/backend/services/orchestrator/orchestrator_engine';

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params;

    const metadata = getProjectMetadata(slug);

    if (!metadata) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      );
    }

    // Skip execution for user-driven phases
    if (metadata.current_phase === 'STACK_SELECTION') {
      return NextResponse.json(
        {
          success: false,
          error: 'Stack selection phase requires user input. Use /approve-stack endpoint instead.'
        },
        { status: 400 }
      );
    }

    if (metadata.current_phase === 'DONE') {
      return NextResponse.json(
        {
          success: false,
          error: 'Final phase. Use /generate-handoff endpoint instead.'
        },
        { status: 400 }
      );
    }

    // Get current phase artifacts for context
    const artifacts = listArtifacts(slug, metadata.current_phase);
    const previousArtifacts: Record<string, string> = {};

    // Collect artifacts from previous phases for context
    const allPhases = ['ANALYSIS', 'STACK_SELECTION', 'SPEC', 'DEPENDENCIES', 'SOLUTIONING', 'DONE'];
    const currentIndex = allPhases.indexOf(metadata.current_phase);

    for (let i = 0; i < currentIndex; i++) {
      const phaseArtifacts = listArtifacts(slug, allPhases[i]);
      for (const artifact of phaseArtifacts) {
        previousArtifacts[`${allPhases[i]}/${artifact.name}`] = artifact.content || '';
      }
    }

    // Add project idea for ANALYSIS phase
    if (metadata.current_phase === 'ANALYSIS') {
      const fs = require('fs');
      const path = require('path');
      const projectIdeaPath = path.resolve(metadata.project_path, 'project_idea.txt');
      if (fs.existsSync(projectIdeaPath)) {
        previousArtifacts['project_idea'] = fs.readFileSync(projectIdeaPath, 'utf8');
      } else {
        // Fallback to description or name
        previousArtifacts['project_idea'] = metadata.description || metadata.name;
      }
    }

    // Initialize orchestrator and run agent
    const orchestrator = new OrchestratorEngine();

    const project = {
      id: slug,
      slug,
      name: metadata.name,
      current_phase: metadata.current_phase,
      phases_completed: metadata.phases_completed || [],
      stack_choice: metadata.stack_choice,
      stack_approved: metadata.stack_approved || false,
      dependencies_approved: metadata.dependencies_approved || false,
      created_at: metadata.created_at,
      updated_at: metadata.updated_at,
      orchestration_state: metadata.orchestration_state || {
        artifact_versions: {},
        phase_history: []
      }
    };

    const result = await orchestrator.runPhaseAgent(project, previousArtifacts);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.message },
        { status: 500 }
      );
    }

    // Update project metadata with new artifact versions
    const updated = {
      ...metadata,
      orchestration_state: project.orchestration_state,
      updated_at: new Date().toISOString()
    };

    saveProjectMetadata(slug, updated);

    return NextResponse.json({
      success: true,
      data: {
        phase: metadata.current_phase,
        message: result.message,
        artifacts: Object.keys(result.artifacts),
        artifact_count: Object.keys(result.artifacts).length
      }
    });
  } catch (error) {
    console.error('Error executing phase agent:', error);
    return NextResponse.json(
      {
        success: false,
        error: `Failed to execute phase agent: ${
          error instanceof Error ? error.message : String(error)
        }`
      },
      { status: 500 }
    );
  }
}
