import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as createProject } from '@/app/api/projects/route';
import { POST as approveStack } from '@/app/api/projects/[slug]/approve-stack/route';

// Mock dependencies
vi.mock('@/backend/services/database/drizzle_project_db_service');
vi.mock('@/app/api/lib/project-utils');
vi.mock('@/lib/logger');
vi.mock('@/lib/rate-limiter');
vi.mock('@/lib/correlation-id');
vi.mock('@/app/api/middleware/auth-guard');

import { ProjectDBService } from '@/backend/services/database/drizzle_project_db_service';
import * as projectUtils from '@/app/api/lib/project-utils';
import { logger } from '@/lib/logger';
import { generalLimiter, getRateLimitKey } from '@/lib/rate-limiter';
import { withCorrelationId } from '@/lib/correlation-id';
import { withAuth } from '@/app/api/middleware/auth-guard';

describe('Integration: Auth → Validation → DB Flow', () => {
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

  const mockMetadata = {
    id: 'test-id-123',
    slug: 'test-project',
    name: 'Test Project',
    description: 'A test project',
    current_phase: 'STACK_SELECTION',
    phases_completed: [],
    stack_choice: null,
    stack_approved: false,
    dependencies_approved: false,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    orchestration_state: {}
  };

  const mockProjectData = {
    id: 'test-id-123',
    slug: 'test-project',
    name: 'Test Project',
    description: 'A test project',
    currentPhase: 'STACK_SELECTION',
    phasesCompleted: [],
    stackChoice: null,
    stackApproved: false,
    dependenciesApproved: false,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01')
  };

  beforeEach(() => {
    vi.clearAllMocks();
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

  describe('Complete Flow: Create Project → Validate Input → Persist to Database', () => {
    it('should complete full flow from authenticated request to database persistence', async () => {
      // Setup mocks for database operations
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ProjectDBService.prototype.createProject as any).mockResolvedValue({
        ...mockProjectData,
        name: 'My New Project',
        slug: 'my-new-project-abc123'
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projectUtils.saveProjectMetadata as any).mockImplementation(() => {});
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projectUtils.persistProjectToDB as any).mockResolvedValue(undefined);

      // Step 1: Make authenticated request with valid data
      const request = new NextRequest(new URL('http://localhost:3000/api/projects'), {
        method: 'POST',
        body: JSON.stringify({
          name: 'My New Project',
          description: 'A comprehensive test project'
        })
      });

      // Step 2: Call endpoint (auth guard should pass with mock session)
      const response = await createProject(request, {});

      // Step 3: Verify response indicates success
      expect(response.status).toBe(201);
      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.data.name).toBe('My New Project');

      // Step 4: Verify database operations were called
      expect(ProjectDBService.prototype.createProject).toHaveBeenCalled();
      expect(projectUtils.saveProjectMetadata).toHaveBeenCalled();
      expect(projectUtils.persistProjectToDB).toHaveBeenCalled();

      // Step 5: Verify logging occurred (audit trail)
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('project created successfully'),
        expect.objectContaining({
          userId: 'test-user-123',
          slug: expect.any(String)
        })
      );
    });

    it('should reject unauthenticated requests at auth layer', async () => {
      // Create a mock auth guard that returns 401
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (withAuth as any).mockImplementation(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
        (handler: (req: NextRequest, context: any, session: any) => Promise<Response>) =>
          async () => {
            const response = new Response(
              JSON.stringify({ success: false, error: 'Unauthorized' }),
              { status: 401 }
            );
            return response;
          }
      );

      const request = new NextRequest(new URL('http://localhost:3000/api/projects'), {
        method: 'POST',
        body: JSON.stringify({
          name: 'My New Project'
        })
      });

      const response = await createProject(request, {});

      expect(response.status).toBe(401);
      const json = await response.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe('Unauthorized');
    });

    it('should validate input before database operations', async () => {
      const request = new NextRequest(new URL('http://localhost:3000/api/projects'), {
        method: 'POST',
        body: JSON.stringify({
          // Missing required 'name' field
          description: 'Invalid project'
        })
      });

      const response = await createProject(request, {});

      // Should return 400 for validation error
      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.success).toBe(false);
      expect(json.error).toContain('Project name is required');

      // Database should NOT have been called
      expect(ProjectDBService.prototype.createProject).not.toHaveBeenCalled();
    });

    it('should sanitize long project names', async () => {
      const longName = 'a'.repeat(500); // Exceeds max length of 100

      const request = new NextRequest(new URL('http://localhost:3000/api/projects'), {
        method: 'POST',
        body: JSON.stringify({
          name: longName,
          description: 'Test'
        })
      });

      const response = await createProject(request, {});

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.success).toBe(false);
      expect(json.error).toContain('must not exceed');

      // Database should NOT have been called
      expect(ProjectDBService.prototype.createProject).not.toHaveBeenCalled();
    });

    it('should handle database errors gracefully after validation passes', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ProjectDBService.prototype.createProject as any).mockRejectedValue(
        new Error('Database connection failed')
      );

      const request = new NextRequest(new URL('http://localhost:3000/api/projects'), {
        method: 'POST',
        body: JSON.stringify({
          name: 'My New Project'
        })
      });

      const response = await createProject(request, {});

      expect(response.status).toBe(500);
      const json = await response.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe('Failed to create project');

      // Verify error was logged
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('Complete Flow: Approval → Validation → Artifact Persistence', () => {
    it('should complete approval flow with artifact persistence to database', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projectUtils.getProjectMetadata as any).mockReturnValue(mockMetadata);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projectUtils.saveProjectMetadata as any).mockImplementation(() => {});
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projectUtils.persistProjectToDB as any).mockResolvedValue(undefined);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projectUtils.writeArtifact as any).mockImplementation(() => {});
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ProjectDBService.prototype.getProjectBySlug as any).mockResolvedValue(mockProjectData);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ProjectDBService.prototype.saveArtifact as any).mockResolvedValue(undefined);

      const request = new NextRequest(
        new URL('http://localhost:3000/api/projects/test-project/approve-stack'),
        {
          method: 'POST',
          body: JSON.stringify({
            stack_choice: 'Node.js + React + PostgreSQL',
            reasoning: 'Best for scalability and performance',
            platform: 'cloud'
          })
        }
      );

      const response = await approveStack(request, { params: { slug: 'test-project' } });

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.data.stack_approved).toBe(true);

      // Verify artifacts were written to filesystem
      expect(projectUtils.writeArtifact).toHaveBeenCalledWith(
        'test-project',
        'STACK_SELECTION',
        'plan.md',
        expect.stringContaining('Node.js + React + PostgreSQL')
      );

      // Verify artifacts were persisted to database (DB-primary strategy)
      expect(ProjectDBService.prototype.saveArtifact).toHaveBeenCalledWith(
        mockProjectData.id,
        'STACK_SELECTION',
        'plan.md',
        expect.any(String)
      );

      // Verify metadata was updated and persisted
      expect(projectUtils.saveProjectMetadata).toHaveBeenCalledWith(
        'test-project',
        expect.objectContaining({
          stack_approved: true,
          stack_choice: 'Node.js + React + PostgreSQL'
        })
      );
    });

    it('should reject invalid stack approval data at validation layer', async () => {
      const request = new NextRequest(
        new URL('http://localhost:3000/api/projects/test-project/approve-stack'),
        {
          method: 'POST',
          body: JSON.stringify({
            // Missing required 'stack_choice' field
            reasoning: 'Some reasoning'
          })
        }
      );

      const response = await approveStack(request, { params: { slug: 'test-project' } });

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.success).toBe(false);
      expect(json.error).toContain('Stack choice is required');

      // Verify no artifacts or DB operations occurred
      expect(projectUtils.writeArtifact).not.toHaveBeenCalled();
      expect(ProjectDBService.prototype.saveArtifact).not.toHaveBeenCalled();
    });

    it('should handle database failures gracefully during artifact persistence', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projectUtils.getProjectMetadata as any).mockReturnValue(mockMetadata);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projectUtils.saveProjectMetadata as any).mockImplementation(() => {});
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

      const request = new NextRequest(
        new URL('http://localhost:3000/api/projects/test-project/approve-stack'),
        {
          method: 'POST',
          body: JSON.stringify({
            stack_choice: 'Node.js + React + PostgreSQL'
          })
        }
      );

      const response = await approveStack(request, { params: { slug: 'test-project' } });

      // Should still succeed (graceful degradation: filesystem write succeeds)
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);

      // Verify filesystem write still happened
      expect(projectUtils.writeArtifact).toHaveBeenCalled();

      // Verify error was logged but didn't fail the request
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to persist'),
        expect.any(Object)
      );
    });
  });

  describe('Authentication & Authorization', () => {
    it('should include user ID in logged operations for audit trail', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ProjectDBService.prototype.createProject as any).mockResolvedValue(mockProjectData);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projectUtils.saveProjectMetadata as any).mockImplementation(() => {});
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projectUtils.persistProjectToDB as any).mockResolvedValue(undefined);

      const request = new NextRequest(new URL('http://localhost:3000/api/projects'), {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test Project'
        })
      });

      await createProject(request, {});

      // Verify user ID from session appears in logs
      expect(logger.info).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          userId: 'test-user-123'
        })
      );
    });

    it('should maintain session information throughout request lifecycle', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ProjectDBService.prototype.createProject as any).mockResolvedValue(mockProjectData);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projectUtils.saveProjectMetadata as any).mockImplementation(() => {});
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projectUtils.persistProjectToDB as any).mockResolvedValue(undefined);

      const request = new NextRequest(new URL('http://localhost:3000/api/projects'), {
        method: 'POST',
        body: JSON.stringify({
          name: 'Secure Project'
        })
      });

      const response = await createProject(request, {});

      expect(response.status).toBe(201);

      // Verify all operations logged the authenticated user
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('creating new project'),
        expect.objectContaining({
          userId: 'test-user-123'
        })
      );
    });
  });

  describe('Validation Layer', () => {
    it('should reject requests with empty project names', async () => {
      const request = new NextRequest(new URL('http://localhost:3000/api/projects'), {
        method: 'POST',
        body: JSON.stringify({
          name: '   ', // Only whitespace
          description: 'Test'
        })
      });

      const response = await createProject(request, {});

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.success).toBe(false);
    });

    it('should reject requests with overly long descriptions', async () => {
      const longDescription = 'x'.repeat(2000);

      const request = new NextRequest(new URL('http://localhost:3000/api/projects'), {
        method: 'POST',
        body: JSON.stringify({
          name: 'Valid Name',
          description: longDescription
        })
      });

      const response = await createProject(request, {});

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.success).toBe(false);
    });
  });

  describe('Database Persistence', () => {
    it('should call database service with validated data', async () => {
      const createProjectSpy = vi.spyOn(ProjectDBService.prototype, 'createProject');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ProjectDBService.prototype.createProject as any).mockResolvedValue(mockProjectData);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projectUtils.saveProjectMetadata as any).mockImplementation(() => {});
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projectUtils.persistProjectToDB as any).mockResolvedValue(undefined);

      const request = new NextRequest(new URL('http://localhost:3000/api/projects'), {
        method: 'POST',
        body: JSON.stringify({
          name: 'Database Test Project',
          description: 'Testing database persistence'
        })
      });

      await createProject(request, {});

      expect(createProjectSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Database Test Project',
          description: 'Testing database persistence'
        })
      );
    });

    it('should persist metadata to both filesystem and database', async () => {
      const persistSpy = vi.spyOn(projectUtils, 'persistProjectToDB');
      const saveSpy = vi.spyOn(projectUtils, 'saveProjectMetadata');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ProjectDBService.prototype.createProject as any).mockResolvedValue(mockProjectData);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projectUtils.persistProjectToDB as any).mockResolvedValue(undefined);

      const request = new NextRequest(new URL('http://localhost:3000/api/projects'), {
        method: 'POST',
        body: JSON.stringify({
          name: 'Dual Persistence Project'
        })
      });

      await createProject(request, {});

      // Both filesystem and database persistence should be called
      expect(saveSpy).toHaveBeenCalled();
      expect(persistSpy).toHaveBeenCalled();
    });
  });
});
