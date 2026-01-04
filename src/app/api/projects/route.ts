import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { ProjectDBService } from '@/backend/services/database/drizzle_project_db_service';
import { saveProjectMetadata } from '@/app/api/lib/project-utils';
import { uploadProjectIdea } from '@/lib/r2-storage';
import { logger } from '@/lib/logger';
import { withCorrelationId } from '@/lib/correlation-id';
import { generalLimiter, getRateLimitKey, createRateLimitResponse } from '@/lib/rate-limiter';
import { withAuth, type AuthSession } from '@/app/api/middleware/auth-guard';
import { CreateProjectSchema } from '@/app/api/schemas';

export const runtime = 'nodejs';

/**
 * GET /api/projects
 * List all projects from database
 */
const getHandler = withAuth(
  async (request: NextRequest, _context: unknown, session: AuthSession) => {
    // Rate limiting
    const rateLimitKey = getRateLimitKey(request);
    const isAllowed = await generalLimiter.isAllowed(rateLimitKey);

    if (!isAllowed) {
      const remaining = await generalLimiter.getRemainingPoints(rateLimitKey);
      return createRateLimitResponse(remaining, Date.now() + 60000, 60);
    }

    try {
      logger.debug('GET /api/projects - fetching projects list', {
        ownerId: session.user.id,
      });
      const dbService = new ProjectDBService();
      const result = await dbService.listProjects(0, 20, session.user.id);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const projectDetails = result.projects.map((project: any) => ({
        id: project.id,
        slug: project.slug,
        name: project.name,
        description: project.description,
        current_phase: project.currentPhase,
        stack_choice: project.stackChoice,
        stack_approved: project.stackApproved,
        project_type: project.projectType,
        scale_tier: project.scaleTier,
        recommended_stack: project.recommendedStack,
        workflow_version: project.workflowVersion,
        created_at: project.createdAt,
        updated_at: project.updatedAt,
        artifact_count: 0, // TODO: Add proper count from relations
        created_by_id: project.ownerId,
      }));

      logger.info('GET /api/projects - success', { count: result.total, ownerId: session.user.id });
      return NextResponse.json(
        {
          success: true,
          data: projectDetails,
          total: result.total
        },
        {
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
          }
        }
      );
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('GET /api/projects - failed', err);
      return NextResponse.json(
        { success: false, error: 'Failed to list projects' },
        { status: 500 }
      );
    }
  }
);

export const GET = withCorrelationId((request: NextRequest) => getHandler(request, {}));

const postHandler = withAuth(
  async (
    request: NextRequest,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    _context: any,
    session: AuthSession
  ) => {
    // Rate limiting
    const rateLimitKey = getRateLimitKey(request);
    const isAllowed = await generalLimiter.isAllowed(rateLimitKey);

    if (!isAllowed) {
      const remaining = await generalLimiter.getRemainingPoints(rateLimitKey);
      return createRateLimitResponse(remaining, Date.now() + 60000, 60);
    }

    try {
      logger.debug('POST /api/projects - creating new project', {
        userId: session.user.id,
      });

      const body = await request.json();

      // Validate input with Zod schema
      const validationResult = CreateProjectSchema.safeParse(body);
      if (!validationResult.success) {
        logger.warn('POST /api/projects - validation failed', {
          errors: validationResult.error.flatten(),
        });
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid input',
            details: validationResult.error.flatten().fieldErrors,
          },
          { status: 400 }
        );
      }

      const { name, description } = validationResult.data;

      // Generate slug from name with uniqueness suffix
      const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') +
        '-' +
        uuidv4().substring(0, 8);

      logger.debug('POST /api/projects - generated slug', { slug });

      // Create project in database with initialized orchestration state
      const dbService = new ProjectDBService();
      const dbProject =
        (await dbService.createProjectWithState({
        name,
        description: description || undefined,
        slug,
        ownerId: session.user.id,
      })) ||
        (await dbService.createProject({
          name,
          description: description || undefined,
          slug,
          ownerId: session.user.id,
        }));

      // Store the project idea as initial context for the Analyst agent in R2
      await uploadProjectIdea(slug, description || name);

      // Save project metadata to filesystem for retrieval
      const metadata = {
        id: dbProject.id,
        slug: dbProject.slug,
        name: dbProject.name,
        description: dbProject.description || null,
        current_phase: dbProject.currentPhase,
        phases_completed: dbProject.phasesCompleted,
        stack_choice: dbProject.stackChoice,
        stack_approved: dbProject.stackApproved,
        created_at: dbProject.createdAt.toISOString(),
        updated_at: dbProject.updatedAt.toISOString(),
        orchestration_state: dbProject.orchestrationState || {
          artifact_versions: {},
          phase_history: [],
          approval_gates: {},
        },
        created_by_id: session.user.id,
      };
      await saveProjectMetadata(slug, metadata);

      logger.info('POST /api/projects - project created successfully', {
        slug,
        projectId: dbProject.id,
        userId: session.user.id,
      });

      return NextResponse.json(
        {
          success: true,
          data: {
            id: dbProject.id,
            slug: dbProject.slug,
            name: dbProject.name,
            description: dbProject.description,
            current_phase: dbProject.currentPhase,
            phases_completed: dbProject.phasesCompleted,
            stack_choice: dbProject.stackChoice,
            stack_approved: dbProject.stackApproved,
            created_at: dbProject.createdAt,
            updated_at: dbProject.updatedAt,
          },
        },
        {
          status: 201,
          headers: {
            'Cache-Control':
              'no-store, no-cache, must-revalidate, proxy-revalidate',
          },
        }
      );
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('POST /api/projects - failed', err);
      return NextResponse.json(
        { success: false, error: 'Failed to create project' },
        { status: 500 }
      );
    }
  }
);

/**
 * POST /api/projects
 * Create a new project in database and filesystem
 * Requires authentication
 */
export const POST = postHandler;
