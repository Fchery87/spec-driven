import { NextRequest, NextResponse } from 'next/server';
import { getProjectMetadata } from '@/app/api/lib/project-utils';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { logger } from '@/lib/logger';

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string; phase: string; name: string } }
) {
  try {
    const { slug, phase, name } = params;

    const metadata = getProjectMetadata(slug);

    if (!metadata) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      );
    }

    // Construct the artifact file path
    const artifactPath = resolve(process.cwd(), 'projects', slug, 'specs', phase, 'v1', name);

    // Read the artifact file
    try {
      const content = readFileSync(artifactPath, 'utf8');

      // Determine content type based on file extension
      let contentType = 'text/plain';
      if (name.endsWith('.json')) {
        contentType = 'application/json';
      } else if (name.endsWith('.md')) {
        contentType = 'text/markdown';
      }

      return new NextResponse(content, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Content-Disposition': `inline; filename="${name}"`
        }
      });
    } catch (fileErr) {
      logger.error(`Failed to read artifact file ${name}:`, fileErr);
      return NextResponse.json(
        { success: false, error: 'Artifact not found' },
        { status: 404 }
      );
    }
  } catch (error) {
    logger.error('Error fetching artifact:', error);
    return NextResponse.json(
      {
        success: false,
        error: `Failed to fetch artifact: ${
          error instanceof Error ? error.message : String(error)
        }`
      },
      { status: 500 }
    );
  }
}
