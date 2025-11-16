import { NextRequest, NextResponse } from 'next/server';
import { getProjectMetadata, saveProjectMetadata, deleteProject, deleteProjectFromDB, persistProjectToDB } from '@/app/api/lib/project-utils';

export async function GET(
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

    return NextResponse.json({
      success: true,
      data: {
        ...metadata,
        stats: { total_artifacts: 0, total_size: 0 }
      }
    });
  } catch (error) {
    console.error('Error getting project:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get project' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params;
    const body = await request.json();

    const metadata = getProjectMetadata(slug);

    if (!metadata) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      );
    }

    const updated = {
      ...metadata,
      ...body,
      updated_at: new Date().toISOString()
    };

    saveProjectMetadata(slug, updated);

    // Persist changes to database
    await persistProjectToDB(slug, updated);

    return NextResponse.json({
      success: true,
      data: updated
    });
  } catch (error) {
    console.error('Error updating project:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update project' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params;

    // Verify project exists before deletion
    const metadata = getProjectMetadata(slug);
    if (!metadata) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      );
    }

    // Delete from database
    await deleteProjectFromDB(slug);

    // Delete the project directory and all its contents
    const deleted = deleteProject(slug);

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: 'Failed to delete project' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Project '${metadata.name}' has been successfully deleted`,
      data: {
        slug,
        name: metadata.name
      }
    });
  } catch (error) {
    console.error('Error deleting project:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete project' },
      { status: 500 }
    );
  }
}
