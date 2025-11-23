// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as getProjects, POST as createProject } from '@/app/api/projects/route';
import { GET as getProject, PUT as updateProject, DELETE as deleteProject } from '@/app/api/projects/[slug]/route';
import { POST as approveStack } from '@/app/api/projects/[slug]/approve-stack/route';

// Mock dependencies
vi.mock('@/backend/services/database/drizzle_project_db_service');
vi.mock('@/backend/services/file_system/project_storage');
vi.mock('@/app/api/lib/project-utils');
vi.mock('@/lib/logger');
vi.mock('@/lib/rate-limiter');
vi.mock('@/lib/correlation-id');
vi.mock('@/app/api/middleware/auth-guard');

import { ProjectDBService } from '@/backend/services/database/drizzle_project_db_service';
import { ProjectStorage } from '@/backend/services/file_system/project_storage';
import * as projectUtils from '@/app/api/lib/project-utils';
import { generalLimiter, getRateLimitKey, createRateLimitResponse } from '@/lib/rate-limiter';
import { withCorrelationId } from '@/lib/correlation-id';
import { withAuth } from '@/app/api/middleware/auth-guard';

describe('Projects API Routes', () => {
  const mockProjectData = {
    id: 'test-id-123',
    slug: 'test-project-abc12345',
    name: 'Test Project',
    description: 'A test project',
    currentPhase: 'REQUIREMENTS',
    phasesCompleted: [],
    stackChoice: null,
    stackApproved: false,
    dependenciesApproved: false,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01')
  };

  const mockMetadata = {
    id: 'test-id-123',
    slug: 'test-project-abc12345',
    name: 'Test Project',
    description: 'A test project',
    current_phase: 'REQUIREMENTS',
    phases_completed: [],
    stack_choice: null,
    stack_approved: false,
    dependencies_approved: false,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    orchestration_state: {}
  };

  const mockSession = {
    user: {
      id: 'test-user-123',
      email: 'test@example.com',
      emailVerified: true,
      name: 'Test User',
      createdAt: new Date(),
      updatedAt: new Date()
    },
    session: {
      id: 'test-session-123',
      token: 'test-token',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      createdAt: new Date(),
      updatedAt: new Date()
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock implementations
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (getRateLimitKey as any).mockReturnValue('test-key');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (generalLimiter.isAllowed as any).mockResolvedValue(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (withCorrelationId as any).mockImplementation((fn: (req: NextRequest) => Promise<Response>) => fn);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (withAuth as any).mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (handler: (req: NextRequest, context: any, session: any) => Promise<Response>) =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async (req: NextRequest, context?: any) => handler(req, context, mockSession)
    );
  });

  describe('GET /api/projects - List all projects', () => {
    it('should return list of projects successfully', async () => {
      const mockListResult = {
        projects: [mockProjectData],
        total: 1
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ProjectDBService.prototype.listProjects as any).mockResolvedValue(mockListResult);

      const request = new NextRequest(new URL('http://localhost:3000/api/projects'));
      const response = await getProjects(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data).toHaveLength(1);
      expect(json.total).toBe(1);
      expect(json.data[0].slug).toBe('test-project-abc12345');
    });

    it('should handle empty project list', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ProjectDBService.prototype.listProjects as any).mockResolvedValue({
        projects: [],
        total: 0
      });

      const request = new NextRequest(new URL('http://localhost:3000/api/projects'));
      const response = await getProjects(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data).toHaveLength(0);
      expect(json.total).toBe(0);
    });

    it('should return 429 when rate limit exceeded', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (generalLimiter.isAllowed as any).mockResolvedValue(false);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (generalLimiter.getRemainingPoints as any).mockReturnValue(0);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (createRateLimitResponse as any).mockReturnValue(
        new Response(JSON.stringify({ error: 'Rate limit exceeded' }), { status: 429 })
      );

      const request = new NextRequest(new URL('http://localhost:3000/api/projects'));
      const response = await getProjects(request);

      expect(response.status).toBe(429);
    });

    it('should handle database errors gracefully', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ProjectDBService.prototype.listProjects as any).mockRejectedValue(
        new Error('Database connection failed')
      );

      const request = new NextRequest(new URL('http://localhost:3000/api/projects'));
      const response = await getProjects(request);
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.success).toBe(false);
      expect(json.error).toBe('Failed to list projects');
    });

    it('should include cache control headers', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ProjectDBService.prototype.listProjects as any).mockResolvedValue({
        projects: [mockProjectData],
        total: 1
      });

      const request = new NextRequest(new URL('http://localhost:3000/api/projects'));
      const response = await getProjects(request);

      expect(response.headers.get('Cache-Control')).toContain('no-store');
      expect(response.headers.get('Cache-Control')).toContain('no-cache');
    });
  });

  describe('POST /api/projects - Create project', () => {
    it('should create a new project successfully', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ProjectDBService.prototype.createProject as any).mockResolvedValue(mockProjectData);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projectUtils.saveProjectMetadata as any).mockImplementation(() => {});
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ProjectStorage.prototype.createProjectDirectory as any).mockImplementation(() => {});

      const request = new NextRequest(new URL('http://localhost:3000/api/projects'), {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test Project',
          description: 'A test project'
        })
      });

      const response = await createProject(request, {});
      const json = await response.json();

      expect(response.status).toBe(201);
      expect(json.success).toBe(true);
      expect(json.data.name).toBe('Test Project');
      expect(json.data.slug).toBe('test-project-abc12345');
    });

    it('should return 400 when project name is missing', async () => {
      const request = new NextRequest(new URL('http://localhost:3000/api/projects'), {
        method: 'POST',
        body: JSON.stringify({
          description: 'No name provided'
        })
      });

      const response = await createProject(request, {});
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.error).toContain('Project name is required');
    });

    it('should generate slug from project name', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ProjectDBService.prototype.createProject as any).mockResolvedValue({
        ...mockProjectData,
        name: 'My Awesome Project'
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projectUtils.saveProjectMetadata as any).mockImplementation(() => {});
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ProjectStorage.prototype.createProjectDirectory as any).mockImplementation(() => {});

      const request = new NextRequest(new URL('http://localhost:3000/api/projects'), {
        method: 'POST',
        body: JSON.stringify({
          name: 'My Awesome Project',
          description: 'Test'
        })
      });

      const response = await createProject(request, {});
      const json = await response.json();

      expect(response.status).toBe(201);
      expect(json.success).toBe(true);
      // Slug should be generated from name + UUID
      expect(json.data.slug).toContain('my-awesome-project');
    });

    it('should create project directory in filesystem', async () => {
      const createDirSpy = vi.spyOn(ProjectStorage.prototype, 'createProjectDirectory');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ProjectDBService.prototype.createProject as any).mockResolvedValue(mockProjectData);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projectUtils.saveProjectMetadata as any).mockImplementation(() => {});

      const request = new NextRequest(new URL('http://localhost:3000/api/projects'), {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test Project'
        })
      });

      await createProject(request, {});

      expect(createDirSpy).toHaveBeenCalled();
    });

    it('should save project metadata to filesystem', async () => {
      const saveMetadataSpy = vi.spyOn(projectUtils, 'saveProjectMetadata');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ProjectDBService.prototype.createProject as any).mockResolvedValue(mockProjectData);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ProjectStorage.prototype.createProjectDirectory as any).mockImplementation(() => {});

      const request = new NextRequest(new URL('http://localhost:3000/api/projects'), {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test Project',
          description: 'A test project'
        })
      });

      await createProject(request, {});

      expect(saveMetadataSpy).toHaveBeenCalled();
    });

    it('should handle database creation errors', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ProjectDBService.prototype.createProject as any).mockRejectedValue(
        new Error('Database error')
      );

      const request = new NextRequest(new URL('http://localhost:3000/api/projects'), {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test Project'
        })
      });

      const response = await createProject(request, {});
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.success).toBe(false);
      expect(json.error).toBe('Failed to create project');
    });

    it('should handle rate limiting', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (generalLimiter.isAllowed as any).mockResolvedValue(false);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (generalLimiter.getRemainingPoints as any).mockReturnValue(0);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (createRateLimitResponse as any).mockReturnValue(
        new Response(JSON.stringify({ error: 'Rate limit exceeded' }), { status: 429 })
      );

      const request = new NextRequest(new URL('http://localhost:3000/api/projects'), {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test Project'
        })
      });

      const response = await createProject(request, {});

      expect(response.status).toBe(429);
    });
  });

  describe('GET /api/projects/[slug] - Get single project', () => {
    it('should return project details successfully', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projectUtils.getProjectMetadata as any).mockReturnValue(mockMetadata);

      const request = new NextRequest(new URL('http://localhost:3000/api/projects/test-slug'));
      const response = await getProject(request, { params: { slug: 'test-slug' } });
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.name).toBe('Test Project');
      expect(json.data.slug).toBe('test-project-abc12345');
    });

    it('should return 404 when project not found', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projectUtils.getProjectMetadata as any).mockReturnValue(null);

      const request = new NextRequest(new URL('http://localhost:3000/api/projects/missing-slug'));
      const response = await getProject(request, { params: { slug: 'missing-slug' } });
      const json = await response.json();

      expect(response.status).toBe(404);
      expect(json.success).toBe(false);
      expect(json.error).toBe('Project not found');
    });

    it('should include project stats', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projectUtils.getProjectMetadata as any).mockReturnValue(mockMetadata);

      const request = new NextRequest(new URL('http://localhost:3000/api/projects/test-slug'));
      const response = await getProject(request, { params: { slug: 'test-slug' } });
      const json = await response.json();

      expect(json.data.stats).toBeDefined();
      expect(json.data.stats.total_artifacts).toBe(0);
      expect(json.data.stats.total_size).toBe(0);
    });
  });

  describe('PUT /api/projects/[slug] - Update project', () => {
    it('should update project successfully', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const updatedMetadata = {
        ...mockMetadata,
        current_phase: 'ARCHITECTURE',
        updated_at: new Date().toISOString()
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projectUtils.getProjectMetadata as any).mockReturnValue(mockMetadata);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projectUtils.saveProjectMetadata as any).mockImplementation(() => {});
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projectUtils.persistProjectToDB as any).mockResolvedValue(undefined);

      const request = new NextRequest(new URL('http://localhost:3000/api/projects/test-slug'), {
        method: 'PUT',
        body: JSON.stringify({
          current_phase: 'ARCHITECTURE'
        })
      });

      const response = await updateProject(request, { params: { slug: 'test-slug' } });
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(projectUtils.saveProjectMetadata).toHaveBeenCalled();
      expect(projectUtils.persistProjectToDB).toHaveBeenCalled();
    });

    it('should return 404 when updating non-existent project', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projectUtils.getProjectMetadata as any).mockReturnValue(null);

      const request = new NextRequest(new URL('http://localhost:3000/api/projects/missing-slug'), {
        method: 'PUT',
        body: JSON.stringify({
          current_phase: 'ARCHITECTURE'
        })
      });

      const response = await updateProject(request, { params: { slug: 'missing-slug' } });
      const json = await response.json();

      expect(response.status).toBe(404);
      expect(json.success).toBe(false);
      expect(json.error).toBe('Project not found');
    });

    it('should persist updates to database', async () => {
      const persistSpy = vi.spyOn(projectUtils, 'persistProjectToDB');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projectUtils.getProjectMetadata as any).mockReturnValue(mockMetadata);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projectUtils.saveProjectMetadata as any).mockImplementation(() => {});

      const request = new NextRequest(new URL('http://localhost:3000/api/projects/test-slug'), {
        method: 'PUT',
        body: JSON.stringify({
          current_phase: 'ARCHITECTURE'
        })
      });

      await updateProject(request, { params: { slug: 'test-slug' } });

      expect(persistSpy).toHaveBeenCalled();
    });

    it('should update timestamp', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projectUtils.getProjectMetadata as any).mockReturnValue(mockMetadata);
      const saveSpy = vi.spyOn(projectUtils, 'saveProjectMetadata');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projectUtils.persistProjectToDB as any).mockResolvedValue(undefined);

      const request = new NextRequest(new URL('http://localhost:3000/api/projects/test-slug'), {
        method: 'PUT',
        body: JSON.stringify({
          current_phase: 'ARCHITECTURE'
        })
      });

      await updateProject(request, { params: { slug: 'test-slug' } });

      expect(saveSpy).toHaveBeenCalledWith(
        'test-slug',
        expect.objectContaining({
          updated_at: expect.any(String)
        })
      );
    });
  });

  describe('DELETE /api/projects/[slug] - Delete project', () => {
    it('should delete project successfully', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projectUtils.getProjectMetadata as any).mockReturnValue(mockMetadata);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projectUtils.deleteProjectFromDB as any).mockResolvedValue(undefined);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projectUtils.deleteProject as any).mockReturnValue(true);

      const request = new NextRequest(new URL('http://localhost:3000/api/projects/test-slug'), {
        method: 'DELETE'
      });

      const response = await deleteProject(request, { params: { slug: 'test-slug' } });
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.message).toContain('successfully deleted');
    });

    it('should return 404 when deleting non-existent project', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projectUtils.getProjectMetadata as any).mockReturnValue(null);

      const request = new NextRequest(new URL('http://localhost:3000/api/projects/missing-slug'), {
        method: 'DELETE'
      });

      const response = await deleteProject(request, { params: { slug: 'missing-slug' } });
      const json = await response.json();

      expect(response.status).toBe(404);
      expect(json.success).toBe(false);
      expect(json.error).toBe('Project not found');
    });

    it('should delete from database', async () => {
      const deleteDBSpy = vi.spyOn(projectUtils, 'deleteProjectFromDB');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projectUtils.getProjectMetadata as any).mockReturnValue(mockMetadata);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projectUtils.deleteProject as any).mockReturnValue(true);

      const request = new NextRequest(new URL('http://localhost:3000/api/projects/test-slug'), {
        method: 'DELETE'
      });

      await deleteProject(request, { params: { slug: 'test-slug' } });

      expect(deleteDBSpy).toHaveBeenCalledWith('test-slug');
    });

    it('should delete project directory', async () => {
      const deleteSpy = vi.spyOn(projectUtils, 'deleteProject');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projectUtils.getProjectMetadata as any).mockReturnValue(mockMetadata);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projectUtils.deleteProjectFromDB as any).mockResolvedValue(undefined);

      const request = new NextRequest(new URL('http://localhost:3000/api/projects/test-slug'), {
        method: 'DELETE'
      });

      await deleteProject(request, { params: { slug: 'test-slug' } });

      expect(deleteSpy).toHaveBeenCalledWith('test-slug');
    });

    it('should return 500 when filesystem deletion fails', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projectUtils.getProjectMetadata as any).mockReturnValue(mockMetadata);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projectUtils.deleteProjectFromDB as any).mockResolvedValue(undefined);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projectUtils.deleteProject as any).mockReturnValue(false);

      const request = new NextRequest(new URL('http://localhost:3000/api/projects/test-slug'), {
        method: 'DELETE'
      });

      const response = await deleteProject(request, { params: { slug: 'test-slug' } });
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.success).toBe(false);
      expect(json.error).toBe('Failed to delete project');
    });

    it('should handle database deletion errors', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projectUtils.getProjectMetadata as any).mockReturnValue(mockMetadata);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projectUtils.deleteProjectFromDB as any).mockRejectedValue(
        new Error('Database error')
      );

      const request = new NextRequest(new URL('http://localhost:3000/api/projects/test-slug'), {
        method: 'DELETE'
      });

      const response = await deleteProject(request, { params: { slug: 'test-slug' } });
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.success).toBe(false);
    });
  });

  describe('POST /api/projects/[slug]/approve-stack - Approval Gate', () => {
    it('should approve stack successfully', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projectUtils.getProjectMetadata as any).mockReturnValue(mockMetadata);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projectUtils.saveProjectMetadata as any).mockImplementation(() => {});
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projectUtils.persistProjectToDB as any).mockResolvedValue(undefined);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projectUtils.writeArtifact as any).mockImplementation(() => {});
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ProjectDBService.prototype.getProjectBySlug as any).mockResolvedValue(mockProjectData);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ProjectDBService.prototype.saveArtifact as any).mockResolvedValue(undefined);

      const request = new NextRequest(new URL('http://localhost:3000/api/projects/test-slug/approve-stack'), {
        method: 'POST',
        body: JSON.stringify({
          stack_choice: 'Node.js + React + PostgreSQL',
          reasoning: 'Best for scalability',
          platform: 'cloud'
        })
      });

      const response = await approveStack(request, { params: { slug: 'test-slug' } });
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.stack_approved).toBe(true);
      expect(json.data.stack_choice).toBe('Node.js + React + PostgreSQL');
    });

    it('should return 400 when stack_choice is missing', async () => {
      const request = new NextRequest(new URL('http://localhost:3000/api/projects/test-slug/approve-stack'), {
        method: 'POST',
        body: JSON.stringify({
          reasoning: 'Some reasoning'
        })
      });

      const response = await approveStack(request, { params: { slug: 'test-slug' } });
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.error).toContain('Stack choice is required');
    });

    it('should return 404 when project not found', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projectUtils.getProjectMetadata as any).mockReturnValue(null);

      const request = new NextRequest(new URL('http://localhost:3000/api/projects/missing-slug/approve-stack'), {
        method: 'POST',
        body: JSON.stringify({
          stack_choice: 'Node.js + React + PostgreSQL'
        })
      });

      const response = await approveStack(request, { params: { slug: 'missing-slug' } });
      const json = await response.json();

      expect(response.status).toBe(404);
      expect(json.success).toBe(false);
      expect(json.error).toBe('Project not found');
    });

    it('should save artifacts to filesystem and database', async () => {
      const writeArtifactSpy = vi.spyOn(projectUtils, 'writeArtifact');
      const saveArtifactSpy = vi.spyOn(ProjectDBService.prototype, 'saveArtifact');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projectUtils.getProjectMetadata as any).mockReturnValue(mockMetadata);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projectUtils.saveProjectMetadata as any).mockImplementation(() => {});
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projectUtils.persistProjectToDB as any).mockResolvedValue(undefined);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ProjectDBService.prototype.getProjectBySlug as any).mockResolvedValue(mockProjectData);

      const request = new NextRequest(new URL('http://localhost:3000/api/projects/test-slug/approve-stack'), {
        method: 'POST',
        body: JSON.stringify({
          stack_choice: 'Node.js + React + PostgreSQL',
          reasoning: 'Best for scalability',
          platform: 'cloud'
        })
      });

      await approveStack(request, { params: { slug: 'test-slug' } });

      expect(writeArtifactSpy).toHaveBeenCalled();
      expect(saveArtifactSpy).toHaveBeenCalled();
    });

    it('should set stack_approved flag to true', async () => {
      const saveSpy = vi.spyOn(projectUtils, 'saveProjectMetadata');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projectUtils.getProjectMetadata as any).mockReturnValue(mockMetadata);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projectUtils.persistProjectToDB as any).mockResolvedValue(undefined);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projectUtils.writeArtifact as any).mockImplementation(() => {});
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ProjectDBService.prototype.getProjectBySlug as any).mockResolvedValue(mockProjectData);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ProjectDBService.prototype.saveArtifact as any).mockResolvedValue(undefined);

      const request = new NextRequest(new URL('http://localhost:3000/api/projects/test-slug/approve-stack'), {
        method: 'POST',
        body: JSON.stringify({
          stack_choice: 'Node.js + React + PostgreSQL'
        })
      });

      await approveStack(request, { params: { slug: 'test-slug' } });

      expect(saveSpy).toHaveBeenCalledWith(
        'test-slug',
        expect.objectContaining({
          stack_approved: true,
          stack_choice: 'Node.js + React + PostgreSQL'
        })
      );
    });

    it('should include approval timestamp', async () => {
      const saveSpy = vi.spyOn(projectUtils, 'saveProjectMetadata');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projectUtils.getProjectMetadata as any).mockReturnValue(mockMetadata);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projectUtils.persistProjectToDB as any).mockResolvedValue(undefined);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projectUtils.writeArtifact as any).mockImplementation(() => {});
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ProjectDBService.prototype.getProjectBySlug as any).mockResolvedValue(mockProjectData);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ProjectDBService.prototype.saveArtifact as any).mockResolvedValue(undefined);

      const request = new NextRequest(new URL('http://localhost:3000/api/projects/test-slug/approve-stack'), {
        method: 'POST',
        body: JSON.stringify({
          stack_choice: 'Node.js + React + PostgreSQL'
        })
      });

      await approveStack(request, { params: { slug: 'test-slug' } });

      expect(saveSpy).toHaveBeenCalledWith(
        'test-slug',
        expect.objectContaining({
          stack_approval_date: expect.any(String)
        })
      );
    });

    it('should handle database artifact logging errors gracefully', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projectUtils.getProjectMetadata as any).mockReturnValue(mockMetadata);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projectUtils.saveProjectMetadata as any).mockImplementation(() => {});
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projectUtils.persistProjectToDB as any).mockResolvedValue(undefined);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projectUtils.writeArtifact as any).mockImplementation(() => {});
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ProjectDBService.prototype.getProjectBySlug as any).mockResolvedValue(mockProjectData);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ProjectDBService.prototype.saveArtifact as any).mockRejectedValue(
        new Error('Database error')
      );

      const request = new NextRequest(new URL('http://localhost:3000/api/projects/test-slug/approve-stack'), {
        method: 'POST',
        body: JSON.stringify({
          stack_choice: 'Node.js + React + PostgreSQL'
        })
      });

      const response = await approveStack(request, { params: { slug: 'test-slug' } });
      const json = await response.json();

      // Should still succeed (graceful degradation)
      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid JSON in request body', async () => {
      const request = new NextRequest(new URL('http://localhost:3000/api/projects'), {
        method: 'POST',
        body: 'invalid json {'
      });

      // Request parsing error would be handled by Next.js
      expect(async () => {
        await request.json();
      }).rejects.toThrow();
    });

    it('should log errors to logger', async () => {
      const { logger } = await import('@/lib/logger');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ProjectDBService.prototype.listProjects as any).mockRejectedValue(
        new Error('Test error')
      );

      const request = new NextRequest(new URL('http://localhost:3000/api/projects'));
      await getProjects(request);

      expect(logger.error).toHaveBeenCalled();
    });
  });
});
