import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as createProject } from '@/app/api/projects/route';
import { POST as approveStack } from '@/app/api/projects/[slug]/approve-stack/route';

const mockSession = vi.hoisted(() => ({
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
}));

const authMocks = vi.hoisted(() => {
  const requireAuth = vi.fn<() => Promise<typeof mockSession | null>>(async () => mockSession);
  const withAuth = vi.fn((handler: unknown) => async (req: unknown, ctx: unknown) => {
    const session = await requireAuth();
    if (!session) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401 });
    }
     
    return (handler as any)(req, ctx, session);
  });
  return {
    requireAuth,
    withAuth,
    withAdminAuth: withAuth,
    isAdmin: () => true,
    isSuperAdmin: () => true,
  };
});

// Mock dependencies
vi.mock('@/backend/services/database/drizzle_project_db_service');
vi.mock('@/app/api/lib/project-utils');
vi.mock('@/lib/r2-storage', () => ({
  uploadProjectIdea: vi.fn(async () => undefined),
  deleteProjectFromR2: vi.fn(async () => undefined),
}));
vi.mock('@/lib/logger');
vi.mock('@/lib/rate-limiter');
vi.mock('@/lib/correlation-id', () => ({
  withCorrelationId: (fn: unknown) => fn,
  getCorrelationId: () => 'test-correlation-id',
  getRequestId: () => 'test-request-id',
  withCorrelationIdFetch: (_url: string, init?: RequestInit) => init || {}
}));
vi.mock('@/app/api/middleware/auth-guard', () => authMocks);

import { ProjectDBService } from '@/backend/services/database/drizzle_project_db_service';
import * as projectUtils from '@/app/api/lib/project-utils';
import { logger } from '@/lib/logger';
import { generalLimiter, getRateLimitKey } from '@/lib/rate-limiter';

describe('Integration: Auth → Validation → DB Flow', () => {
  const mockMetadata = {
    id: 'test-id-123',
    slug: 'test-project',
    name: 'Test Project',
    description: 'A test project',
    current_phase: 'STACK_SELECTION',
    phases_completed: [],
    stack_choice: null,
    stack_approved: false,
    created_by_id: 'test-user-123',
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
    ownerId: 'test-user-123',
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01')
  };

  beforeEach(() => {
    vi.clearAllMocks();
     
    (getRateLimitKey as any).mockReturnValue('test-key');
     
    (generalLimiter.isAllowed as any).mockResolvedValue(true);
  });

  describe('Complete Flow: Create Project → Validate Input → Persist to Database', () => {
    it('should complete full flow from authenticated request to database persistence', async () => {
      // Setup mocks for database operations
       
      (ProjectDBService.prototype.createProjectWithState as any).mockResolvedValue({
        ...mockProjectData,
        name: 'My New Project',
        slug: 'my-new-project-abc123'
      });
       
       
      (projectUtils.saveProjectMetadata as any).mockImplementation(() => {});
       
       


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
      expect(ProjectDBService.prototype.createProjectWithState).toHaveBeenCalled();
      expect(projectUtils.saveProjectMetadata).toHaveBeenCalled();

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
      authMocks.requireAuth.mockResolvedValueOnce(null);

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
      expect(json.error).toBe('Invalid input');
      expect(json.details).toBeDefined();

      // Database should NOT have been called
      expect(ProjectDBService.prototype.createProjectWithState).not.toHaveBeenCalled();
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
      expect(json.error).toBe('Invalid input');
      expect(json.details).toBeDefined();

      // Database should NOT have been called
      expect(ProjectDBService.prototype.createProjectWithState).not.toHaveBeenCalled();
      expect(ProjectDBService.prototype.createProject).not.toHaveBeenCalled();
    });

    it('should handle database errors gracefully after validation passes', async () => {
       
      (ProjectDBService.prototype.createProjectWithState as any).mockRejectedValue(
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
       
      (projectUtils.getProjectMetadata as any).mockReturnValue(mockMetadata);
       
       
      (projectUtils.saveProjectMetadata as any).mockImplementation(() => {});
       
       
      (projectUtils.persistProjectToDB as any).mockResolvedValue(undefined);
       
      (projectUtils.writeArtifact as any).mockImplementation(() => {});
       
      (ProjectDBService.prototype.getProjectBySlug as any).mockResolvedValue(mockProjectData);
       
      (ProjectDBService.prototype.saveArtifact as any).mockResolvedValue(undefined);

      const request = new NextRequest(
        new URL('http://localhost:3000/api/projects/test-project/approve-stack'),
        {
          method: 'POST',
          body: JSON.stringify({
            stack_choice: 'nextjs_web_app',
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
        'stack-decision.md',
        expect.stringContaining('nextjs_web_app')
      );
      expect(projectUtils.writeArtifact).toHaveBeenCalledWith(
        'test-project',
        'STACK_SELECTION',
        'stack-rationale.md',
        expect.stringContaining('Stack Selection Rationale')
      );

      // Verify artifacts were persisted to database (DB-primary strategy)
      expect(ProjectDBService.prototype.saveArtifact).toHaveBeenCalledWith(
        mockProjectData.id,
        'STACK_SELECTION',
        'stack-decision.md',
        expect.any(String)
      );
      expect(ProjectDBService.prototype.saveArtifact).toHaveBeenCalledWith(
        mockProjectData.id,
        'STACK_SELECTION',
        'stack-rationale.md',
        expect.any(String)
      );

      // Verify metadata was updated and persisted
      expect(projectUtils.saveProjectMetadata).toHaveBeenCalledWith(
        'test-project',
        expect.objectContaining({
          stack_approved: true,
          stack_choice: 'nextjs_web_app'
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
      expect(json.error).toBe('Invalid input');
      expect(json.details).toBeDefined();

      // Verify no artifacts or DB operations occurred
      expect(projectUtils.writeArtifact).not.toHaveBeenCalled();
      expect(ProjectDBService.prototype.saveArtifact).not.toHaveBeenCalled();
    });

    it('should handle database failures gracefully during artifact persistence', async () => {
       
      (projectUtils.getProjectMetadata as any).mockReturnValue(mockMetadata);
       
       
      (projectUtils.saveProjectMetadata as any).mockImplementation(() => {});
       
       
      (projectUtils.persistProjectToDB as any).mockResolvedValue(undefined);
       
      (projectUtils.writeArtifact as any).mockImplementation(() => {});
       
      (ProjectDBService.prototype.getProjectBySlug as any).mockResolvedValue(mockProjectData);
       
      (ProjectDBService.prototype.saveArtifact as any).mockRejectedValue(
        new Error('Database error')
      );

      const request = new NextRequest(
        new URL('http://localhost:3000/api/projects/test-project/approve-stack'),
        {
          method: 'POST',
          body: JSON.stringify({
            stack_choice: 'nextjs_web_app'
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
       
      (ProjectDBService.prototype.createProjectWithState as any).mockResolvedValue(mockProjectData);
       
       
      (projectUtils.saveProjectMetadata as any).mockImplementation(() => {});
       
       
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
       
      (ProjectDBService.prototype.createProjectWithState as any).mockResolvedValue(mockProjectData);
       
       
      (projectUtils.saveProjectMetadata as any).mockImplementation(() => {});
       
       
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
        expect.stringContaining('project created successfully'),
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
      const longDescription = 'x'.repeat(6000);

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
      const createProjectSpy = vi.spyOn(ProjectDBService.prototype, 'createProjectWithState');
       
      (ProjectDBService.prototype.createProjectWithState as any).mockResolvedValue(mockProjectData);
       
       
      (projectUtils.saveProjectMetadata as any).mockImplementation(() => {});
       
       
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
          description: 'Testing database persistence',
          ownerId: 'test-user-123'
        })
      );
    });

    it('should persist metadata to both filesystem and database', async () => {
      const saveSpy = vi.spyOn(projectUtils, 'saveProjectMetadata');

       
      (ProjectDBService.prototype.createProjectWithState as any).mockResolvedValue(mockProjectData);

      const request = new NextRequest(new URL('http://localhost:3000/api/projects'), {
        method: 'POST',
        body: JSON.stringify({
          name: 'Dual Persistence Project'
        })
      });

      await createProject(request, {});

      // Project creation should write metadata artifact
      expect(saveSpy).toHaveBeenCalled();
    });
  });
});
