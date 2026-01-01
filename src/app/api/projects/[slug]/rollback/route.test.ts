// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as rollback } from '@/app/api/projects/[slug]/rollback/route';
import { GET as previewRollback } from '@/app/api/projects/[slug]/rollback/preview/route';

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

vi.mock('@/app/api/lib/project-utils');
vi.mock('@/lib/logger');
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
}));

// Mock GitService to prevent RollbackService constructor from failing
vi.mock('@/backend/services/git/git_service', () => ({
  GitService: vi.fn().mockImplementation(() => ({
    initialize: vi.fn(),
    getMode: vi.fn().mockReturnValue('local_only'),
  })),
}));

// Mock RollbackService with proper function implementation
const mockRollbackToPhase = vi.fn();
const mockGetRollbackPreview = vi.fn();

vi.mock('@/backend/services/rollback/rollback_service', () => ({
  RollbackService: class MockRollbackService {
    constructor(projectPath: string) {}
    async rollbackToPhase(...args: unknown[]) {
      return mockRollbackToPhase(...args);
    }
    async getRollbackPreview(...args: unknown[]) {
      return mockGetRollbackPreview(...args);
    }
  },
}));

import * as projectUtils from '@/app/api/lib/project-utils';

describe('Rollback API Routes', () => {
  const mockProjectData = {
    id: 'test-id-123',
    slug: 'test-project-abc12345',
    name: 'Test Project',
    description: 'A test project',
    current_phase: 'SOLUTIONING',
    phases_completed: 'ANALYSIS,STACK_SELECTION,SPEC,DEPENDENCIES',
    created_by_id: 'test-user-123',
    project_path: '/projects/test-project-abc12345',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    orchestration_state: {}
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockRollbackToPhase.mockReset();
    mockGetRollbackPreview.mockReset();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (projectUtils.getProjectMetadata as any).mockResolvedValue(mockProjectData);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (projectUtils.saveProjectMetadata as any).mockResolvedValue(undefined);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (projectUtils.persistProjectToDB as any).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('POST /api/projects/[slug]/rollback', () => {
    it('should require confirmation parameter', async () => {
      const request = new NextRequest('http://localhost:3000/api/projects/test-project-abc12345/rollback', {
        method: 'POST',
        body: JSON.stringify({
          targetPhase: 'ANALYSIS'
        })
      });

      const response = await rollback(request, { params: Promise.resolve({ slug: 'test-project-abc12345' }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Confirmation required (confirm: true)');
    });

    it('should require targetPhase parameter', async () => {
      const request = new NextRequest('http://localhost:3000/api/projects/test-project-abc12345/rollback', {
        method: 'POST',
        body: JSON.stringify({
          confirm: true
        })
      });

      const response = await rollback(request, { params: Promise.resolve({ slug: 'test-project-abc12345' }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('targetPhase is required');
    });

    it('should execute rollback successfully', async () => {
      const mockRollbackResult = {
        success: true,
        snapshotId: 'snapshot-123',
        restoredArtifacts: ['ANALYSIS/analysis_report.md', 'ANALYSIS/requirements.md'],
        gitCommitHash: 'abc123'
      };

      mockRollbackToPhase.mockResolvedValue(mockRollbackResult);

      const request = new NextRequest('http://localhost:3000/api/projects/test-project-abc12345/rollback', {
        method: 'POST',
        body: JSON.stringify({
          targetPhase: 'ANALYSIS',
          confirm: true
        })
      });

      const response = await rollback(request, { params: Promise.resolve({ slug: 'test-project-abc12345' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.snapshotId).toBe('snapshot-123');
      expect(data.data.restoredArtifacts).toEqual(['ANALYSIS/analysis_report.md', 'ANALYSIS/requirements.md']);
      expect(data.data.gitCommitHash).toBe('abc123');
      expect(data.data.currentPhase).toBe('ANALYSIS');
      expect(data.data.phasesCompleted).toEqual(['STACK_SELECTION', 'SPEC', 'DEPENDENCIES']);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(projectUtils.saveProjectMetadata as any).toHaveBeenCalledWith(
        'test-project-abc12345',
        expect.objectContaining({
          current_phase: 'ANALYSIS',
          phases_completed: ['STACK_SELECTION', 'SPEC', 'DEPENDENCIES']
        })
      );
    });

    it('should return error for invalid phase not in completed phases', async () => {
      const request = new NextRequest('http://localhost:3000/api/projects/test-project-abc12345/rollback', {
        method: 'POST',
        body: JSON.stringify({
          targetPhase: 'VALIDATE',
          confirm: true
        })
      });

      const response = await rollback(request, { params: Promise.resolve({ slug: 'test-project-abc12345' }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Phase VALIDATE not found in completed phases');
    });

    it('should return error if rollback service fails', async () => {
      const mockRollbackResult = {
        success: false,
        error: 'Rollback depth exceeded maximum allowed'
      };

      mockRollbackToPhase.mockResolvedValue(mockRollbackResult);

      const request = new NextRequest('http://localhost:3000/api/projects/test-project-abc12345/rollback', {
        method: 'POST',
        body: JSON.stringify({
          targetPhase: 'ANALYSIS',
          confirm: true
        })
      });

      const response = await rollback(request, { params: Promise.resolve({ slug: 'test-project-abc12345' }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Rollback depth exceeded maximum allowed');
    });
  });

  describe('GET /api/projects/[slug]/rollback/preview', () => {
    it('should require targetPhase query parameter', async () => {
      const request = new NextRequest('http://localhost:3000/api/projects/test-project-abc12345/rollback/preview');

      const response = await previewRollback(request, { params: Promise.resolve({ slug: 'test-project-abc12345' }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('targetPhase query parameter is required');
    });

    it('should return preview with artifacts', async () => {
      const mockPreviewResult = {
        success: true,
        artifacts: ['ANALYSIS/analysis_report.md', 'ANALYSIS/requirements.md'],
        metadata: { version: 1, timestamp: '2025-01-01' },
        gitCommitHash: 'abc123'
      };

      mockGetRollbackPreview.mockResolvedValue(mockPreviewResult);

      const request = new NextRequest('http://localhost:3000/api/projects/test-project-abc12345/rollback/preview?targetPhase=ANALYSIS');

      const response = await previewRollback(request, { params: Promise.resolve({ slug: 'test-project-abc12345' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.artifacts).toEqual(['ANALYSIS/analysis_report.md', 'ANALYSIS/requirements.md']);
      expect(data.data.metadata).toEqual({ version: 1, timestamp: '2025-01-01' });
      expect(data.data.gitCommitHash).toBe('abc123');
    });

    it('should return error for invalid phase', async () => {
      const mockPreviewResult = {
        success: false,
        error: 'No snapshot found for phase INVALID_PHASE'
      };

      mockGetRollbackPreview.mockResolvedValue(mockPreviewResult);

      const request = new NextRequest('http://localhost:3000/api/projects/test-project-abc12345/rollback/preview?targetPhase=INVALID_PHASE');

      const response = await previewRollback(request, { params: Promise.resolve({ slug: 'test-project-abc12345' }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('No snapshot found for phase INVALID_PHASE');
    });

    it('should return error if project not found', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projectUtils.getProjectMetadata as any).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/projects/test-project-abc12345/rollback/preview?targetPhase=ANALYSIS');

      const response = await previewRollback(request, { params: Promise.resolve({ slug: 'test-project-abc12345' }) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Project not found');
    });
  });
});
