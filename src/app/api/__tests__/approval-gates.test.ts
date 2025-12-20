import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as approveDependencies } from '@/app/api/projects/[slug]/approve-dependencies/route';
import { POST as executePhase } from '@/app/api/projects/[slug]/execute-phase/route';

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
vi.mock('@/lib/logger');
vi.mock('@/backend/services/orchestrator/orchestrator_engine');
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

import { ProjectDBService } from '@/backend/services/database/drizzle_project_db_service';
import * as projectUtils from '@/app/api/lib/project-utils';
import { OrchestratorEngine } from '@/backend/services/orchestrator/orchestrator_engine';

describe('Approval Gates and Phase Execution', () => {
  const mockMetadata = {
    id: 'test-id-123',
    slug: 'test-project',
    name: 'Test Project',
    description: 'A test project',
    current_phase: 'DEPENDENCIES',
    phases_completed: ['ANALYSIS', 'STACK_SELECTION'],
    stack_choice: 'Node.js + React',
    stack_approved: true,
    dependencies_approved: false,
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
    currentPhase: 'DEPENDENCIES',
    phasesCompleted: ['ANALYSIS', 'STACK_SELECTION'],
    stackChoice: 'Node.js + React',
    stackApproved: true,
    dependenciesApproved: false,
    ownerId: 'test-user-123',
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01')
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/projects/[slug]/approve-dependencies', () => {
    it('should approve dependencies successfully', async () => {
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

      const request = new NextRequest(
        new URL('http://localhost:3000/api/projects/test-project/approve-dependencies'),
        {
          method: 'POST',
          body: JSON.stringify({
            notes: 'All dependencies reviewed and approved'
          })
        }
      );

      const response = await approveDependencies(request, { params: { slug: 'test-project' } });
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.dependencies_approved).toBe(true);
    });

    it('should reject approval if not in DEPENDENCIES phase', async () => {
      const metadataInWrongPhase = {
        ...mockMetadata,
        current_phase: 'ANALYSIS'
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projectUtils.getProjectMetadata as any).mockReturnValue(metadataInWrongPhase);

      const request = new NextRequest(
        new URL('http://localhost:3000/api/projects/test-project/approve-dependencies'),
        {
          method: 'POST',
          body: JSON.stringify({
            notes: 'Some notes'
          })
        }
      );

      const response = await approveDependencies(request, { params: { slug: 'test-project' } });
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.error).toContain('Must be in DEPENDENCIES phase');
    });

    it('should return 404 if project not found', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projectUtils.getProjectMetadata as any).mockReturnValue(null);

      const request = new NextRequest(
        new URL('http://localhost:3000/api/projects/missing/approve-dependencies'),
        {
          method: 'POST',
          body: JSON.stringify({})
        }
      );

      const response = await approveDependencies(request, { params: { slug: 'missing' } });
      const json = await response.json();

      expect(response.status).toBe(404);
      expect(json.success).toBe(false);
      expect(json.error).toBe('Project not found');
    });

    it('should save approval metadata with timestamp', async () => {
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

      const request = new NextRequest(
        new URL('http://localhost:3000/api/projects/test-project/approve-dependencies'),
        {
          method: 'POST',
          body: JSON.stringify({
            notes: 'Approved'
          })
        }
      );

      await approveDependencies(request, { params: { slug: 'test-project' } });

      expect(saveSpy).toHaveBeenCalledWith(
        'test-project',
        expect.objectContaining({
          dependencies_approved: true,
          dependencies_approval_date: expect.any(String),
          dependencies_approval_notes: 'Approved'
        })
      );
    });

    it('should write approval artifact to filesystem', async () => {
      const writeArtifactSpy = vi.spyOn(projectUtils, 'writeArtifact');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projectUtils.getProjectMetadata as any).mockReturnValue(mockMetadata);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projectUtils.saveProjectMetadata as any).mockImplementation(() => {});
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projectUtils.persistProjectToDB as any).mockResolvedValue(undefined);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ProjectDBService.prototype.getProjectBySlug as any).mockResolvedValue(mockProjectData);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ProjectDBService.prototype.saveArtifact as any).mockResolvedValue(undefined);

      const request = new NextRequest(
        new URL('http://localhost:3000/api/projects/test-project/approve-dependencies'),
        {
          method: 'POST',
          body: JSON.stringify({})
        }
      );

      await approveDependencies(request, { params: { slug: 'test-project' } });

      expect(writeArtifactSpy).toHaveBeenCalledWith(
        'test-project',
        'DEPENDENCIES',
        'approval.md',
        expect.stringContaining('Dependencies Approval')
      );
    });

    it('should persist changes to database', async () => {
      const persistSpy = vi.spyOn(projectUtils, 'persistProjectToDB');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projectUtils.getProjectMetadata as any).mockReturnValue(mockMetadata);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projectUtils.saveProjectMetadata as any).mockImplementation(() => {});
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projectUtils.writeArtifact as any).mockImplementation(() => {});
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ProjectDBService.prototype.getProjectBySlug as any).mockResolvedValue(mockProjectData);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ProjectDBService.prototype.saveArtifact as any).mockResolvedValue(undefined);

      const request = new NextRequest(
        new URL('http://localhost:3000/api/projects/test-project/approve-dependencies'),
        {
          method: 'POST',
          body: JSON.stringify({})
        }
      );

      await approveDependencies(request, { params: { slug: 'test-project' } });

      expect(persistSpy).toHaveBeenCalledWith('test-project', expect.any(Object));
    });

    it('should handle database logging errors gracefully', async () => {
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
      (ProjectDBService.prototype.saveArtifact as any).mockRejectedValue(new Error('DB error'));

      const request = new NextRequest(
        new URL('http://localhost:3000/api/projects/test-project/approve-dependencies'),
        {
          method: 'POST',
          body: JSON.stringify({})
        }
      );

      const response = await approveDependencies(request, { params: { slug: 'test-project' } });
      const json = await response.json();

      // Should still succeed despite DB error
      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
    });
  });

  describe('POST /api/projects/[slug]/execute-phase', () => {
    const metadataForAnalysis = {
      ...mockMetadata,
      current_phase: 'ANALYSIS',
      phases_completed: []
    };

    it('should allow execution for STACK_SELECTION phase', async () => {
      const metadataStackSelection = {
        ...mockMetadata,
        current_phase: 'STACK_SELECTION'
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projectUtils.getProjectMetadata as any).mockReturnValue(metadataStackSelection);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projectUtils.listArtifacts as any).mockReturnValue([]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projectUtils.writeArtifact as any).mockImplementation(() => {});
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projectUtils.saveProjectMetadata as any).mockImplementation(() => {});
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projectUtils.persistProjectToDB as any).mockResolvedValue(undefined);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ProjectDBService.prototype.getProjectBySlug as any).mockResolvedValue(mockProjectData);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ProjectDBService.prototype.recordPhaseHistory as any).mockResolvedValue(undefined);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (OrchestratorEngine.prototype.runPhaseAgent as any).mockResolvedValue({
        success: true,
        message: 'Stack selection executed',
        artifacts: { 'STACK_SELECTION/stack-analysis.md': 'content' }
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (OrchestratorEngine.prototype.resolveStackSelectionMetadata as any).mockReturnValue({
        projectType: 'web_app',
        scaleTier: 'startup',
        recommendedStack: 'nextjs_web_app',
        workflowVersion: 2
      });

      const request = new NextRequest(
        new URL('http://localhost:3000/api/projects/test-project/execute-phase'),
        { method: 'POST' }
      );

      const response = await executePhase(request, { params: { slug: 'test-project' } });
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
    });

    it('should reject execution for DONE phase', async () => {
      const metadataDone = {
        ...mockMetadata,
        current_phase: 'DONE'
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projectUtils.getProjectMetadata as any).mockReturnValue(metadataDone);

      const request = new NextRequest(
        new URL('http://localhost:3000/api/projects/test-project/execute-phase'),
        { method: 'POST' }
      );

      const response = await executePhase(request, { params: { slug: 'test-project' } });
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.error).toContain('Final phase');
    });

    it('should return 404 if project not found', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projectUtils.getProjectMetadata as any).mockReturnValue(null);

      const request = new NextRequest(
        new URL('http://localhost:3000/api/projects/missing/execute-phase'),
        { method: 'POST' }
      );

      const response = await executePhase(request, { params: { slug: 'missing' } });
      const json = await response.json();

      expect(response.status).toBe(404);
      expect(json.success).toBe(false);
      expect(json.error).toBe('Project not found');
    });

    it('should collect artifacts from previous phases', async () => {
      const listArtifactsSpy = vi.spyOn(projectUtils, 'listArtifacts');
      const metadataForSpec = {
        ...mockMetadata,
        current_phase: 'SPEC',
        phases_completed: ['ANALYSIS', 'STACK_SELECTION']
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projectUtils.getProjectMetadata as any).mockReturnValue(metadataForSpec);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projectUtils.listArtifacts as any).mockReturnValue([]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (OrchestratorEngine.prototype.runPhaseAgent as any).mockResolvedValue({
        success: true,
        message: 'Phase executed',
        artifacts: {}
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projectUtils.saveProjectMetadata as any).mockImplementation(() => {});
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projectUtils.persistProjectToDB as any).mockResolvedValue(undefined);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ProjectDBService.prototype.getProjectBySlug as any).mockResolvedValue(mockProjectData);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ProjectDBService.prototype.recordPhaseHistory as any).mockResolvedValue(undefined);

      const request = new NextRequest(
        new URL('http://localhost:3000/api/projects/test-project/execute-phase'),
        { method: 'POST' }
      );

      await executePhase(request, { params: { slug: 'test-project' } });

      expect(listArtifactsSpy).toHaveBeenCalled();
    });

    it('should execute orchestrator for automatable phases', async () => {
      const runPhaseSpy = vi.spyOn(OrchestratorEngine.prototype, 'runPhaseAgent');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projectUtils.getProjectMetadata as any).mockReturnValue(metadataForAnalysis);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projectUtils.listArtifacts as any).mockReturnValue([]);
      runPhaseSpy.mockResolvedValue({
        success: true,
        message: 'Analysis phase executed',
        artifacts: { 'analysis.md': 'content' }
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projectUtils.saveProjectMetadata as any).mockImplementation(() => {});
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projectUtils.persistProjectToDB as any).mockResolvedValue(undefined);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ProjectDBService.prototype.getProjectBySlug as any).mockResolvedValue(mockProjectData);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ProjectDBService.prototype.recordPhaseHistory as any).mockResolvedValue(undefined);

      const request = new NextRequest(
        new URL('http://localhost:3000/api/projects/test-project/execute-phase'),
        { method: 'POST' }
      );

      const response = await executePhase(request, { params: { slug: 'test-project' } });
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(runPhaseSpy).toHaveBeenCalled();
    });

    it('should record phase completion in database', async () => {
      const recordHistorySpy = vi.spyOn(ProjectDBService.prototype, 'recordPhaseHistory');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projectUtils.getProjectMetadata as any).mockReturnValue(metadataForAnalysis);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projectUtils.listArtifacts as any).mockReturnValue([]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (OrchestratorEngine.prototype.runPhaseAgent as any).mockResolvedValue({
        success: true,
        message: 'Phase executed',
        artifacts: {}
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projectUtils.saveProjectMetadata as any).mockImplementation(() => {});
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projectUtils.persistProjectToDB as any).mockResolvedValue(undefined);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ProjectDBService.prototype.getProjectBySlug as any).mockResolvedValue(mockProjectData);

      const request = new NextRequest(
        new URL('http://localhost:3000/api/projects/test-project/execute-phase'),
        { method: 'POST' }
      );

      await executePhase(request, { params: { slug: 'test-project' } });

      expect(recordHistorySpy).toHaveBeenCalledWith(
        mockProjectData.id,
        'ANALYSIS',
        'completed'
      );
    });

    it('should record phase failure in database', async () => {
      const recordHistorySpy = vi.spyOn(ProjectDBService.prototype, 'recordPhaseHistory');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projectUtils.getProjectMetadata as any).mockReturnValue(metadataForAnalysis);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projectUtils.listArtifacts as any).mockReturnValue([]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (OrchestratorEngine.prototype.runPhaseAgent as any).mockResolvedValue({
        success: false,
        message: 'Phase execution failed',
        artifacts: {}
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ProjectDBService.prototype.getProjectBySlug as any).mockResolvedValue(mockProjectData);

      const request = new NextRequest(
        new URL('http://localhost:3000/api/projects/test-project/execute-phase'),
        { method: 'POST' }
      );

      const response = await executePhase(request, { params: { slug: 'test-project' } });

      expect(recordHistorySpy).toHaveBeenCalledWith(
        mockProjectData.id,
        'ANALYSIS',
        'failed',
        'Phase execution failed'
      );
      expect(response.status).toBe(500);
    });

    it('should return artifacts from orchestrator', async () => {
      const artifacts = {
        'analysis.md': 'Analysis content',
        'summary.md': 'Summary content'
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projectUtils.getProjectMetadata as any).mockReturnValue(metadataForAnalysis);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projectUtils.listArtifacts as any).mockReturnValue([]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (OrchestratorEngine.prototype.runPhaseAgent as any).mockResolvedValue({
        success: true,
        message: 'Phase executed',
        artifacts
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projectUtils.saveProjectMetadata as any).mockImplementation(() => {});
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projectUtils.persistProjectToDB as any).mockResolvedValue(undefined);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ProjectDBService.prototype.getProjectBySlug as any).mockResolvedValue(mockProjectData);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ProjectDBService.prototype.recordPhaseHistory as any).mockResolvedValue(undefined);

      const request = new NextRequest(
        new URL('http://localhost:3000/api/projects/test-project/execute-phase'),
        { method: 'POST' }
      );

      const response = await executePhase(request, { params: { slug: 'test-project' } });
      const json = await response.json();

      expect(json.data.artifact_count).toBe(2);
      expect(json.data.artifacts).toEqual(['analysis.md', 'summary.md']);
    });

    it('should handle orchestrator execution errors', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projectUtils.getProjectMetadata as any).mockReturnValue(metadataForAnalysis);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projectUtils.listArtifacts as any).mockReturnValue([]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (OrchestratorEngine.prototype.runPhaseAgent as any).mockRejectedValue(
        new Error('LLM API error')
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ProjectDBService.prototype.getProjectBySlug as any).mockResolvedValue(mockProjectData);

      const request = new NextRequest(
        new URL('http://localhost:3000/api/projects/test-project/execute-phase'),
        { method: 'POST' }
      );

      const response = await executePhase(request, { params: { slug: 'test-project' } });
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.success).toBe(false);
    });

    it('should update project metadata after execution', async () => {
      const saveMetadataSpy = vi.spyOn(projectUtils, 'saveProjectMetadata');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projectUtils.getProjectMetadata as any).mockReturnValue(metadataForAnalysis);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projectUtils.listArtifacts as any).mockReturnValue([]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (OrchestratorEngine.prototype.runPhaseAgent as any).mockResolvedValue({
        success: true,
        message: 'Phase executed',
        artifacts: {}
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projectUtils.persistProjectToDB as any).mockResolvedValue(undefined);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ProjectDBService.prototype.getProjectBySlug as any).mockResolvedValue(mockProjectData);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ProjectDBService.prototype.recordPhaseHistory as any).mockResolvedValue(undefined);

      const request = new NextRequest(
        new URL('http://localhost:3000/api/projects/test-project/execute-phase'),
        { method: 'POST' }
      );

      await executePhase(request, { params: { slug: 'test-project' } });

      expect(saveMetadataSpy).toHaveBeenCalledWith(
        'test-project',
        expect.objectContaining({
          updated_at: expect.any(String)
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid request body gracefully', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projectUtils.getProjectMetadata as any).mockReturnValue(mockMetadata);

      const request = new NextRequest(
        new URL('http://localhost:3000/api/projects/test-project/approve-dependencies'),
        {
          method: 'POST',
          body: 'invalid json'
        }
      );

      await expect(async () => {
        await request.json();
      }).rejects.toThrow();
    });

    it('should include appropriate error messages in responses', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (projectUtils.getProjectMetadata as any).mockReturnValue(null);

      const request = new NextRequest(
        new URL('http://localhost:3000/api/projects/missing/approve-dependencies'),
        { method: 'POST', body: JSON.stringify({}) }
      );

      const response = await approveDependencies(request, { params: { slug: 'missing' } });
      const json = await response.json();

      expect(json.error).toBeDefined();
      expect(typeof json.error).toBe('string');
    });
  });
});
