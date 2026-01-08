import { NextRequest, NextResponse } from 'next/server';
import { getProjectMetadata, readArtifact } from '@/app/api/lib/project-utils';
import { withAuth, type AuthSession } from '@/app/api/middleware/auth-guard';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

export const GET = withAuth(
  async (
    _request: NextRequest,
    {
      params,
    }: { params: Promise<{ slug: string; phase: string; name: string }> },
    session: AuthSession
  ) => {
    try {
      const { slug, phase, name } = await params;

      const metadata = await getProjectMetadata(slug, session.user.id);

      if (!metadata || metadata.created_by_id !== session.user.id) {
        return NextResponse.json(
          { success: false, error: 'Project not found' },
          { status: 404 }
        );
      }

      // Read the artifact from R2 or local filesystem
      try {
        const content = await readArtifact(slug, phase, name);

        // Determine content type based on file extension
        let contentType = 'text/plain';
        if (name.endsWith('.json')) {
          contentType = 'application/json';
        } else if (name.endsWith('.md')) {
          contentType = 'text/markdown';
        } else if (name.endsWith('.zip')) {
          contentType = 'application/zip';
        }

        return new NextResponse(content as any, {
          status: 200,
          headers: {
            'Content-Type': contentType,
            'Content-Disposition': `inline; filename="${name}"`,
          },
        });
      } catch (fileErr) {
        logger.error(
          `Failed to read artifact file ${name}:`,
          fileErr instanceof Error ? fileErr : new Error(String(fileErr))
        );
        return NextResponse.json(
          { success: false, error: 'Artifact not found' },
          { status: 404 }
        );
      }
    } catch (error) {
      logger.error(
        'Error fetching artifact:',
        error instanceof Error ? error : undefined
      );
      return NextResponse.json(
        {
          success: false,
          error: `Failed to fetch artifact: ${
            error instanceof Error ? error.message : String(error)
          }`,
        },
        { status: 500 }
      );
    }
  }
);
