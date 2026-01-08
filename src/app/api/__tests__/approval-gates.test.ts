import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
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
     
    return (handler as any)(req, ctx, mockSession);
  },
  withAdminAuth: (handler: unknown) => async (req: unknown, ctx: unknown) => {
     
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
    ownerId: 'test-user-123',
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01')
  };

  beforeEach(() => {
    vi.clearAllMocks();
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
       
      (projectUtils.getProjectMetadata as any).mockReturnValue(metadataStackSelection);
       
      (projectUtils.listArtifacts as any).mockReturnValue([]);
       
      (projectUtils.writeArtifact as any).mockImplementation(() => {});
       
      (projectUtils.saveProjectMetadata as any).mockImplementation(() => {});
       
      (projectUtils.persistProjectToDB as any).mockResolvedValue(undefined);
       
      (ProjectDBService.prototype.getProjectBySlug as any).mockResolvedValue(mockProjectData);
       
      (ProjectDBService.prototype.recordPhaseHistory as any).mockResolvedValue(undefined);
       
      (OrchestratorEngine.prototype.runPhaseAgent as any).mockResolvedValue({
        success: true,
        message: 'Stack selection executed',
        artifacts: { 'STACK_SELECTION/stack-analysis.md': 'content' }
      });
       
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
       
      (projectUtils.getProjectMetadata as any).mockReturnValue(metadataForSpec);
       
      (projectUtils.listArtifacts as any).mockReturnValue([]);
       
      (OrchestratorEngine.prototype.runPhaseAgent as any).mockResolvedValue({
        success: true,
        message: 'Phase executed',
        artifacts: {}
      });
       
      (projectUtils.saveProjectMetadata as any).mockImplementation(() => {});
       
      (projectUtils.persistProjectToDB as any).mockResolvedValue(undefined);
       
      (ProjectDBService.prototype.getProjectBySlug as any).mockResolvedValue(mockProjectData);
       
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
       
      (projectUtils.getProjectMetadata as any).mockReturnValue(metadataForAnalysis);
       
      (projectUtils.listArtifacts as any).mockReturnValue([]);
      runPhaseSpy.mockResolvedValue({
        success: true,
        message: 'Analysis phase executed',
        artifacts: { 'analysis.md': 'content' }
      });
       
      (projectUtils.saveProjectMetadata as any).mockImplementation(() => {});
       
      (projectUtils.persistProjectToDB as any).mockResolvedValue(undefined);
       
      (ProjectDBService.prototype.getProjectBySlug as any).mockResolvedValue(mockProjectData);
       
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
       
      (projectUtils.getProjectMetadata as any).mockReturnValue(metadataForAnalysis);
       
      (projectUtils.listArtifacts as any).mockReturnValue([]);
       
      (OrchestratorEngine.prototype.runPhaseAgent as any).mockResolvedValue({
        success: true,
        message: 'Phase executed',
        artifacts: {}
      });
       
      (projectUtils.saveProjectMetadata as any).mockImplementation(() => {});
       
      (projectUtils.persistProjectToDB as any).mockResolvedValue(undefined);
       
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
       
      (projectUtils.getProjectMetadata as any).mockReturnValue(metadataForAnalysis);
       
      (projectUtils.listArtifacts as any).mockReturnValue([]);
       
      (OrchestratorEngine.prototype.runPhaseAgent as any).mockResolvedValue({
        success: false,
        message: 'Phase execution failed',
        artifacts: {}
      });
       
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
       
      (projectUtils.getProjectMetadata as any).mockReturnValue(metadataForAnalysis);
       
      (projectUtils.listArtifacts as any).mockReturnValue([]);
       
      (OrchestratorEngine.prototype.runPhaseAgent as any).mockResolvedValue({
        success: true,
        message: 'Phase executed',
        artifacts
      });
       
      (projectUtils.saveProjectMetadata as any).mockImplementation(() => {});
       
      (projectUtils.persistProjectToDB as any).mockResolvedValue(undefined);
       
      (ProjectDBService.prototype.getProjectBySlug as any).mockResolvedValue(mockProjectData);
       
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
       
      (projectUtils.getProjectMetadata as any).mockReturnValue(metadataForAnalysis);
       
      (projectUtils.listArtifacts as any).mockReturnValue([]);
       
      (OrchestratorEngine.prototype.runPhaseAgent as any).mockRejectedValue(
        new Error('LLM API error')
      );
       
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
       
      (projectUtils.getProjectMetadata as any).mockReturnValue(metadataForAnalysis);
       
      (projectUtils.listArtifacts as any).mockReturnValue([]);
       
      (OrchestratorEngine.prototype.runPhaseAgent as any).mockResolvedValue({
        success: true,
        message: 'Phase executed',
        artifacts: {}
      });
       
      (projectUtils.persistProjectToDB as any).mockResolvedValue(undefined);
       
      (ProjectDBService.prototype.getProjectBySlug as any).mockResolvedValue(mockProjectData);
       
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

});
