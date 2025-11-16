import { NextRequest, NextResponse } from 'next/server';
import { getProjectMetadata, saveProjectMetadata, saveArtifact, persistProjectToDB } from '@/app/api/lib/project-utils';
import { HandoffGenerator } from '@/backend/services/file_system/handoff_generator';
import { ProjectDBService } from '@/backend/services/database/project_db_service';

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

    // Only generate handoff in DONE phase
    if (metadata.current_phase !== 'DONE') {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot generate handoff in ${metadata.current_phase} phase. Project must be in DONE phase.`
        },
        { status: 400 }
      );
    }

    // Generate HANDOFF.md
    const generator = new HandoffGenerator();
    const handoffContent = generator.generateHandoff(slug, metadata);

    // Save HANDOFF.md artifact
    saveArtifact(slug, 'DONE', 'HANDOFF.md', handoffContent);

    // Log artifact to database
    try {
      const dbService = new ProjectDBService();
      const project = await dbService.getProjectBySlug(slug);
      if (project) {
        await dbService.saveArtifact(project.id, 'DONE', 'HANDOFF.md', handoffContent);
      }
    } catch (dbError) {
      console.error('Warning: Failed to log HANDOFF.md to database:', dbError);
      // Don't fail the request if database logging fails
    }

    // Update metadata to mark handoff as generated
    const updated = {
      ...metadata,
      handoff_generated: true,
      handoff_generated_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    saveProjectMetadata(slug, updated);
    await persistProjectToDB(slug, updated);

    return NextResponse.json({
      success: true,
      data: {
        message: 'HANDOFF.md generated successfully',
        slug,
        size_bytes: handoffContent.length,
        phases_included: ['ANALYSIS', 'STACK_SELECTION', 'SPEC', 'DEPENDENCIES', 'SOLUTIONING'],
        ready_for_download: true
      }
    });
  } catch (error) {
    console.error('Error generating handoff:', error);
    return NextResponse.json(
      {
        success: false,
        error: `Failed to generate handoff: ${
          error instanceof Error ? error.message : String(error)
        }`
      },
      { status: 500 }
    );
  }
}
