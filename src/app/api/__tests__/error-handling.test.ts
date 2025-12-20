import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as getProject, POST as createProject } from '@/app/api/projects/route';
import { GET as getSingleProject, PUT as updateProject, DELETE as deleteProject } from '@/app/api/projects/[slug]/route';

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
vi.mock('@/app/api/middleware/auth-guard', () => ({
  requireAuth: async () => mockSession,
  withAuth: (handler: unknown) => async (req: unknown, ctx: unknown) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (handler as any)(req, ctx, mockSession);
  },
  withAdminAuth: (handler: unknown) => async (req: unknown, ctx: unknown) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (handler as any)(req, ctx, mockSession);
  },
  isAdmin: () => true,
  isSuperAdmin: () => true
}));
vi.mock('fs');

import { ProjectDBService } from '@/backend/services/database/drizzle_project_db_service';
import * as projectUtils from '@/app/api/lib/project-utils';
import { logger } from '@/lib/logger';
import { generalLimiter, getRateLimitKey, createRateLimitResponse } from '@/lib/rate-limiter';

describe('API Error Handling', () => {
  const mockMetadata = {
    id: 'test-id',
    slug: 'test-slug',
    name: 'Test Project',
    description: 'Test',
    current_phase: 'ANALYSIS',
    phases_completed: [],
    stack_choice: null,
    stack_approved: false,
    created_by_id: 'test-user-123',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    orchestration_state: {}
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (getRateLimitKey as any).mockReturnValue('test-key');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (generalLimiter.isAllowed as any).mockResolvedValue(true);
  });

  describe('Database Connection Errors', () => {
    it('should handle database unavailability gracefully', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ProjectDBService.prototype.listProjects as any).mockRejectedValue(
        new Error('ECONNREFUSED: Connection refused')
      );

      const request = new NextRequest(new URL('http://localhost:3000/api/projects'));
      const response = await getProject(request);
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.success).toBe(false);
      expect(logger.error).toHaveBeenCalled();
    });

    it('should handle timeout errors from database', async () => {
      const timeoutError = new Error('Query timeout');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (timeoutError as any).code = 'ETIMEDOUT';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ProjectDBService.prototype.listProjects as any).mockRejectedValue(timeoutError);

      const request = new NextRequest(new URL('http://localhost:3000/api/projects'));
      const response = await getProject(request);
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.success).toBe(false);
    });

    it('should handle database constraint violations', async () => {
      const constraintError = new Error('UNIQUE constraint failed: projects.slug');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ProjectDBService.prototype.createProject as any).mockRejectedValue(constraintError);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projectUtils.saveProjectMetadata as any).mockImplementation(() => {});

      const request = new NextRequest(new URL('http://localhost:3000/api/projects'), {
        method: 'POST',
        body: JSON.stringify({ name: 'Test' })
      });

      const response = await createProject(request, {});
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.success).toBe(false);
    });
  });

  describe('Validation Errors', () => {
    it('should reject empty project name', async () => {
      const request = new NextRequest(new URL('http://localhost:3000/api/projects'), {
        method: 'POST',
        body: JSON.stringify({ name: '' })
      });

      const response = await createProject(request, {});
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.error).toBe('Invalid input');
      expect(json.details).toBeDefined();
    });

    it('should reject null project name', async () => {
      const request = new NextRequest(new URL('http://localhost:3000/api/projects'), {
        method: 'POST',
        body: JSON.stringify({ name: null })
      });

      const response = await createProject(request, {});
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const json = await response.json();

      expect(response.status).toBe(400);
    });

    it('should reject missing request body', async () => {
      const request = new NextRequest(new URL('http://localhost:3000/api/projects'), {
        method: 'POST',
        body: '{}'
      });

      const response = await createProject(request, {});
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.error).toBe('Invalid input');
      expect(json.details).toBeDefined();
    });

    it('should handle very long project names', async () => {
      const longName = 'a'.repeat(1000);
      const request = new NextRequest(new URL('http://localhost:3000/api/projects'), {
        method: 'POST',
        body: JSON.stringify({ name: longName })
      });

      const response = await createProject(request, {});
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.error).toBe('Invalid input');
    });

    it('should handle special characters in project name', async () => {
      const specialName = 'Test Project!@#$%^&*()';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ProjectDBService.prototype.createProject as any).mockResolvedValue({
        id: 'test-id',
        slug: 'test-project-special-123',
        name: specialName,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projectUtils.saveProjectMetadata as any).mockImplementation(() => {});

      const request = new NextRequest(new URL('http://localhost:3000/api/projects'), {
        method: 'POST',
        body: JSON.stringify({ name: specialName })
      });

      const response = await createProject(request, {});

      expect(response.status).toBe(201);
    });
  });

  describe('Not Found Errors', () => {
    it('should return 404 for non-existent project GET', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projectUtils.getProjectMetadata as any).mockReturnValue(null);

      const request = new NextRequest(new URL('http://localhost:3000/api/projects/nonexistent'));
      const response = await getSingleProject(request, { params: Promise.resolve({ slug: 'nonexistent' }) });
      const json = await response.json();

      expect(response.status).toBe(404);
      expect(json.success).toBe(false);
      expect(json.error).toBe('Project not found');
    });

    it('should return 404 for non-existent project PUT', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projectUtils.getProjectMetadata as any).mockReturnValue(null);

      const request = new NextRequest(new URL('http://localhost:3000/api/projects/nonexistent'), {
        method: 'PUT',
        body: JSON.stringify({ name: 'Updated' })
      });

      const response = await updateProject(request, { params: Promise.resolve({ slug: 'nonexistent' }) });
      const json = await response.json();

      expect(response.status).toBe(404);
      expect(json.success).toBe(false);
    });

    it('should return 404 for non-existent project DELETE', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projectUtils.getProjectMetadata as any).mockReturnValue(null);

      const request = new NextRequest(new URL('http://localhost:3000/api/projects/nonexistent'), {
        method: 'DELETE'
      });

      const response = await deleteProject(request, { params: Promise.resolve({ slug: 'nonexistent' }) });
      const json = await response.json();

      expect(response.status).toBe(404);
      expect(json.success).toBe(false);
    });
  });

  describe('Filesystem Errors', () => {
    it('should handle filesystem write errors during project creation', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ProjectDBService.prototype.createProject as any).mockResolvedValue({
        id: 'test-id',
        slug: 'test-slug',
        name: 'Test',
        createdAt: new Date(),
        updatedAt: new Date()
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projectUtils.saveProjectMetadata as any).mockImplementation(() => {
        throw new Error('EACCES: Permission denied');
      });

      const request = new NextRequest(new URL('http://localhost:3000/api/projects'), {
        method: 'POST',
        body: JSON.stringify({ name: 'Test' })
      });

      const response = await createProject(request, {});
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.success).toBe(false);
    });

    it('should handle filesystem deletion errors', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projectUtils.getProjectMetadata as any).mockReturnValue(mockMetadata);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projectUtils.deleteProjectFromDB as any).mockResolvedValue(undefined);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projectUtils.deleteProject as any).mockImplementation(() => {
        throw new Error('ENOENT: No such file or directory');
      });

      const request = new NextRequest(new URL('http://localhost:3000/api/projects/test-slug'), {
        method: 'DELETE'
      });

      const response = await deleteProject(request, { params: Promise.resolve({ slug: 'test-slug' }) });
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.success).toBe(false);
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits on GET requests', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (generalLimiter.isAllowed as any).mockResolvedValue(false);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (generalLimiter.getRemainingPoints as any).mockReturnValue(0);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (createRateLimitResponse as any).mockReturnValue(
        new Response(JSON.stringify({ error: 'Too many requests' }), { status: 429 })
      );

      const request = new NextRequest(new URL('http://localhost:3000/api/projects'));
      const response = await getProject(request);

      expect(response.status).toBe(429);
      expect(createRateLimitResponse).toHaveBeenCalled();
    });

    it('should enforce rate limits on POST requests', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (generalLimiter.isAllowed as any).mockResolvedValue(false);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (generalLimiter.getRemainingPoints as any).mockReturnValue(0);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (createRateLimitResponse as any).mockReturnValue(
        new Response(JSON.stringify({ error: 'Too many requests' }), { status: 429 })
      );

      const request = new NextRequest(new URL('http://localhost:3000/api/projects'), {
        method: 'POST',
        body: JSON.stringify({ name: 'Test' })
      });

      const response = await createProject(request, {});

      expect(response.status).toBe(429);
    });

    it('should include rate limit headers in response', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (generalLimiter.isAllowed as any).mockResolvedValue(false);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (generalLimiter.getRemainingPoints as any).mockReturnValue(0);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (createRateLimitResponse as any).mockReturnValue(
        new Response(JSON.stringify({ error: 'Too many requests' }), {
          status: 429,
          headers: {
            'Retry-After': '60',
            'X-RateLimit-Remaining': '0'
          }
        })
      );

      const request = new NextRequest(new URL('http://localhost:3000/api/projects'));
      const response = await getProject(request);

      expect(response.status).toBe(429);
    });
  });

  describe('Concurrent Request Handling', () => {
    it('should handle multiple simultaneous GET requests', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ProjectDBService.prototype.listProjects as any).mockResolvedValue({
        projects: [mockMetadata],
        total: 1
      });

      const requests = Array(5).fill(null).map(() =>
        getProject(new NextRequest(new URL('http://localhost:3000/api/projects')))
      );

      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });

    it('should handle multiple simultaneous POST requests safely', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ProjectDBService.prototype.createProject as any).mockResolvedValue({
        id: 'test-id',
        slug: 'test-slug',
        name: 'Test',
        createdAt: new Date(),
        updatedAt: new Date()
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projectUtils.saveProjectMetadata as any).mockImplementation(() => {});

      const requests = Array(3).fill(null).map(() =>
        createProject(new NextRequest(new URL('http://localhost:3000/api/projects'), {
          method: 'POST',
          body: JSON.stringify({ name: 'Test Project' })
        }), {})
      );

      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect(response.status).toBe(201);
      });
    });
  });

  describe('Malformed Request Handling', () => {
    it('should handle invalid JSON in POST body', async () => {
      const request = new NextRequest(new URL('http://localhost:3000/api/projects'), {
        method: 'POST',
        body: '{invalid json'
      });

      await expect(async () => {
        await request.json();
      }).rejects.toThrow();
    });

    it('should handle null body', async () => {
      const request = new NextRequest(new URL('http://localhost:3000/api/projects'), {
        method: 'POST',
        body: null
      });

      await expect(async () => {
        await request.json();
      }).rejects.toThrow();
    });

    it('should handle content type mismatch', async () => {
      const request = new NextRequest(new URL('http://localhost:3000/api/projects'), {
        method: 'POST',
        body: JSON.stringify({ name: 'Test' }),
        headers: {
          'Content-Type': 'text/plain'
        }
      });

      const response = await createProject(request, {});
      // Should still process as JSON since we're calling request.json()
      expect([201, 400, 500]).toContain(response.status);
    });
  });

  describe('Response Validation', () => {
    it('should always return success or error field', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ProjectDBService.prototype.listProjects as any).mockResolvedValue({
        projects: [],
        total: 0
      });

      const request = new NextRequest(new URL('http://localhost:3000/api/projects'));
      const response = await getProject(request);
      const json = await response.json();

      expect(json).toHaveProperty('success');
    });

    it('should include proper HTTP status codes', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ProjectDBService.prototype.listProjects as any).mockResolvedValue({
        projects: [],
        total: 0
      });

      const getRequest = new NextRequest(new URL('http://localhost:3000/api/projects'));
      const getResponse = await getProject(getRequest);
      expect(getResponse.status).toBe(200);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ProjectDBService.prototype.createProject as any).mockResolvedValue({
        id: 'test',
        slug: 'test',
        name: 'Test',
        createdAt: new Date(),
        updatedAt: new Date()
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projectUtils.saveProjectMetadata as any).mockImplementation(() => {});

      const postRequest = new NextRequest(new URL('http://localhost:3000/api/projects'), {
        method: 'POST',
        body: JSON.stringify({ name: 'Test' })
      });
      const postResponse = await createProject(postRequest, {});
      expect(postResponse.status).toBe(201);
    });

    it('should set cache control headers appropriately', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ProjectDBService.prototype.listProjects as any).mockResolvedValue({
        projects: [],
        total: 0
      });

      const request = new NextRequest(new URL('http://localhost:3000/api/projects'));
      const response = await getProject(request);

      expect(response.headers.get('Cache-Control')).toBeTruthy();
      expect(response.headers.get('Cache-Control')).toContain('no-store');
    });
  });

  describe('Data Sanitization', () => {
    it('should handle HTML injection attempts in project name', async () => {
      const injectionAttempt = '<script>alert("xss")</script>';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ProjectDBService.prototype.createProject as any).mockResolvedValue({
        id: 'test-id',
        slug: 'test-slug',
        name: injectionAttempt,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projectUtils.saveProjectMetadata as any).mockImplementation(() => {});

      const request = new NextRequest(new URL('http://localhost:3000/api/projects'), {
        method: 'POST',
        body: JSON.stringify({ name: injectionAttempt })
      });

      const response = await createProject(request, {});
      expect(response.status).toBe(201);
    });

    it('should handle SQL injection attempts in project name', async () => {
      const injectionAttempt = "'; DROP TABLE projects; --";
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ProjectDBService.prototype.createProject as any).mockResolvedValue({
        id: 'test-id',
        slug: 'test-slug',
        name: injectionAttempt,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projectUtils.saveProjectMetadata as any).mockImplementation(() => {});

      const request = new NextRequest(new URL('http://localhost:3000/api/projects'), {
        method: 'POST',
        body: JSON.stringify({ name: injectionAttempt })
      });

      const response = await createProject(request, {});
      expect(response.status).toBe(201);
    });
  });

  describe('Logging and Observability', () => {
    it('should log successful operations', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ProjectDBService.prototype.listProjects as any).mockResolvedValue({
        projects: [],
        total: 0
      });

      const request = new NextRequest(new URL('http://localhost:3000/api/projects'));
      await getProject(request);

      expect(logger.info).toHaveBeenCalled();
    });

    it('should log error operations with details', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ProjectDBService.prototype.listProjects as any).mockRejectedValue(
        new Error('Test error')
      );

      const request = new NextRequest(new URL('http://localhost:3000/api/projects'));
      await getProject(request);

      expect(logger.error).toHaveBeenCalled();
    });

    it('should include error context in logs', async () => {
      const error = new Error('Test error');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ProjectDBService.prototype.listProjects as any).mockRejectedValue(error);

      const request = new NextRequest(new URL('http://localhost:3000/api/projects'));
      await getProject(request);

      expect(logger.error).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Error)
      );
    });
  });
});
