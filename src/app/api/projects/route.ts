import { NextRequest, NextResponse } from 'next/server';
import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { ProjectDBService } from '@/backend/services/database/project_db_service';
import { ProjectStorage } from '@/backend/services/file_system/project_storage';
import { saveProjectMetadata } from '@/app/api/lib/project-utils';
import { logger } from '@/lib/logger';
import { withCorrelationId } from '@/lib/correlation-id';
import { generalLimiter, getRateLimitKey, createRateLimitResponse } from '@/lib/rate-limiter';

/**
 * GET /api/projects
 * List all projects from database
 */
export const GET = withCorrelationId(async (request: NextRequest) => {
  // Rate limiting
  const rateLimitKey = getRateLimitKey(request);
  const isAllowed = await generalLimiter.isAllowed(rateLimitKey);

  if (!isAllowed) {
    const remaining = generalLimiter.getRemainingPoints(rateLimitKey);
    return createRateLimitResponse(remaining, Date.now() + 60000, 60);
  }

  try {
    logger.debug('GET /api/projects - fetching projects list');
    const dbService = new ProjectDBService();
    const result = await dbService.listProjects();

    const projectDetails = result.projects.map(project => ({
      id: project.id,
      slug: project.slug,
      name: project.name,
      description: project.description,
      current_phase: project.current_phase,
      stack_choice: project.stack_choice,
      stack_approved: project.stack_approved,
      dependencies_approved: project.dependencies_approved,
      created_at: project.created_at,
      updated_at: project.updated_at,
      artifact_count: project._count?.artifacts || 0
    }));

    logger.info('GET /api/projects - success', { count: result.total });
    return NextResponse.json({
      success: true,
      data: projectDetails,
      total: result.total
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('GET /api/projects - failed', err);
    return NextResponse.json(
      { success: false, error: 'Failed to list projects' },
      { status: 500 }
    );
  }
});

/**
 * POST /api/projects
 * Create a new project in database and filesystem
 */
export const POST = withCorrelationId(async (request: NextRequest) => {
  // Rate limiting
  const rateLimitKey = getRateLimitKey(request);
  const isAllowed = await generalLimiter.isAllowed(rateLimitKey);

  if (!isAllowed) {
    const remaining = generalLimiter.getRemainingPoints(rateLimitKey);
    return createRateLimitResponse(remaining, Date.now() + 60000, 60);
  }

  try {
    logger.debug('POST /api/projects - creating new project');
    const body = await request.json();
    const { name, description } = body;

    if (!name) {
      logger.warn('POST /api/projects - missing project name');
      return NextResponse.json(
        { success: false, error: 'Project name is required' },
        { status: 400 }
      );
    }

    // Generate slug from name
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') + '-' + uuidv4().substring(0, 8);

    logger.debug('POST /api/projects - generated slug', { slug });

    // Create project in database
    const dbService = new ProjectDBService();
    const dbProject = await dbService.createProject({
      name,
      description: description || undefined,
      slug
    });

    // Also create filesystem structure for artifacts
    const projectStorage = new ProjectStorage({ base_path: resolve(process.cwd(), 'projects') });
    projectStorage.createProjectDirectory(slug);

    // Store the project idea as initial context for the Analyst agent
    const projectIdeaPath = resolve(process.cwd(), 'projects', slug, 'project_idea.txt');
    writeFileSync(projectIdeaPath, description || name, 'utf8');

    // Save project metadata to filesystem for retrieval
    const metadata = {
      id: dbProject.id,
      slug: dbProject.slug,
      name: dbProject.name,
      description: dbProject.description || null,
      current_phase: dbProject.current_phase,
      phases_completed: dbProject.phases_completed,
      stack_choice: dbProject.stack_choice,
      stack_approved: dbProject.stack_approved,
      dependencies_approved: dbProject.dependencies_approved,
      created_at: dbProject.created_at,
      updated_at: dbProject.updated_at,
      orchestration_state: {}
    };
    saveProjectMetadata(slug, metadata);

    logger.info('POST /api/projects - project created successfully', { slug, projectId: dbProject.id });
    return NextResponse.json({
      success: true,
      data: {
        id: dbProject.id,
        slug: dbProject.slug,
        name: dbProject.name,
        description: dbProject.description,
        current_phase: dbProject.current_phase,
        phases_completed: dbProject.phases_completed,
        stack_choice: dbProject.stack_choice,
        stack_approved: dbProject.stack_approved,
        dependencies_approved: dbProject.dependencies_approved,
        created_at: dbProject.created_at,
        updated_at: dbProject.updated_at
      }
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('POST /api/projects - failed', err);
    return NextResponse.json(
      { success: false, error: 'Failed to create project' },
      { status: 500 }
    );
  }
});
