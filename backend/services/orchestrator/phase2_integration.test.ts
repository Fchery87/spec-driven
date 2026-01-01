import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OrchestratorEngine } from './orchestrator_engine';
import { ApprovalGateService } from '../approval/approval_gate_service';
import { GitService } from '../git/git_service';
import { RollbackService } from '../rollback/rollback_service';
import { Project } from '@/types/orchestrator';

// Mock the agent executors module
vi.mock('../llm/agent_executors', () => ({
  getAnalystExecutor: vi.fn(),
  getPMExecutor: vi.fn(),
  getArchitectExecutor: vi.fn(),
  getScruMasterExecutor: vi.fn(),
  getDevOpsExecutor: vi.fn(),
  getDesignExecutor: vi.fn(),
  getStackSelectionExecutor: vi.fn(),
}));

// Import the mocked functions
const {
  getAnalystExecutor,
  getPMExecutor,
  getArchitectExecutor,
  getScruMasterExecutor,
  getDevOpsExecutor,
  getDesignExecutor,
  getStackSelectionExecutor,
} = await import('../llm/agent_executors');

describe('OrchestratorEngine - Phase 2 Integration', () => {
  let orchestrator: OrchestratorEngine;
  let mockProject: Project;

  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();

    orchestrator = new OrchestratorEngine();
    mockProject = {
      id: 'test-project-id',
      name: 'Test Project',
      slug: 'test-project',
      description: 'A test project',
      created_by_id: 'user-123',
      current_phase: 'ANALYSIS',
      phases_completed: [],
      stack_choice: 'nextjs',
      stack_approved: true,
      project_path: '/test/project',
      orchestration_state: {
        artifact_versions: {},
        phase_history: [],
        approval_gates: {},
      },
      created_at: new Date(),
      updated_at: new Date(),
    };
  });

  describe('Approval Gate Integration', () => {
    it('should check approval gates before phase execution', async () => {
      vi.spyOn(
        orchestrator['approvalGateService'],
        'canProceedFromPhase'
      ).mockResolvedValue(false);

      vi.spyOn(
        orchestrator['approvalGateService'],
        'getProjectGates'
      ).mockResolvedValue([]);

      await expect(
        orchestrator['runPhaseAgent'](mockProject, {})
      ).rejects.toThrow('pending approval gates');

      expect(
        orchestrator['approvalGateService'].canProceedFromPhase
      ).toHaveBeenCalledWith('test-project-id', 'ANALYSIS');
    });

    it('should retrieve pending blocking gates for error message', async () => {
      const pendingGates = [
        {
          id: 'gate-1',
          projectId: 'test-project-id',
          gateName: 'stack_selection' as any,
          phase: 'ANALYSIS',
          status: 'pending' as any,
          blocking: true,
          stakeholderRole: 'product_owner',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.spyOn(
        orchestrator['approvalGateService'],
        'canProceedFromPhase'
      ).mockResolvedValue(false);

      vi.spyOn(
        orchestrator['approvalGateService'],
        'getProjectGates'
      ).mockResolvedValue(pendingGates);

      await expect(
        orchestrator['runPhaseAgent'](mockProject, {})
      ).rejects.toThrow('stack_selection');

      expect(
        orchestrator['approvalGateService'].getProjectGates
      ).toHaveBeenCalledWith('test-project-id');
    });

    it('should proceed when approval gates are approved', async () => {
      vi.spyOn(
        orchestrator['approvalGateService'],
        'canProceedFromPhase'
      ).mockResolvedValue(true);

      vi.spyOn(orchestrator['approvalGateService'], 'getProjectGates').mockResolvedValue([]);

      // Mock the getAnalystExecutor function
      vi.mocked(getAnalystExecutor).mockResolvedValue({
        'project-brief.md': 'test content',
        'constitution.md': '---\ntitle: Test Constitution\n---\nThis is a test constitution with enough content to pass validation.',
        'project-classification.json': JSON.stringify({
          project_type: 'web_application',
          scale_tier: 'small',
        }),
        'personas.md': '# Test Personas\n\nThis is a test personas file.',
      });

      const mockGitService = {
        initialize: vi.fn().mockResolvedValue(undefined),
        getMode: vi.fn().mockReturnValue('disabled'),
        commitPhaseArtifacts: vi.fn().mockResolvedValue({
          success: true,
          mode: 'disabled' as const,
        }),
      };

      const mockRollbackService = {
        createSnapshot: vi.fn().mockResolvedValue({
          success: true,
          snapshotId: 'snapshot-1',
        }),
      };

      orchestrator['gitService'].set('test-project-id', mockGitService as any);
      orchestrator['rollbackService'].set('test-project-id', mockRollbackService as any);

      const result = await orchestrator['runPhaseAgent'](mockProject, {});

      expect(result.success).toBe(true);
      expect(
        orchestrator['approvalGateService'].canProceedFromPhase
      ).toHaveBeenCalledWith('test-project-id', 'ANALYSIS');
    });
  });

  describe('Service Initialization', () => {
    it('should initialize services in constructor', () => {
      expect(orchestrator['approvalGateService']).toBeInstanceOf(ApprovalGateService);
      expect(orchestrator['gitService']).toBeInstanceOf(Map);
      expect(orchestrator['rollbackService']).toBeInstanceOf(Map);
    });

    it('should lazily initialize gitService and rollbackService per project', () => {
      expect(orchestrator['gitService'].has('test-project-id')).toBe(false);
      expect(orchestrator['rollbackService'].has('test-project-id')).toBe(false);

      const mockGitService = {} as any;
      const mockRollbackService = {} as any;

      orchestrator['gitService'].set('test-project-id', mockGitService);
      orchestrator['rollbackService'].set('test-project-id', mockRollbackService);

      expect(orchestrator['gitService'].has('test-project-id')).toBe(true);
      expect(orchestrator['rollbackService'].has('test-project-id')).toBe(true);
    });
  });

  describe('Git and Rollback Integration Flow', () => {
    it('should track phase start time', async () => {
      const startTime = Date.now();

      vi.spyOn(
        orchestrator['approvalGateService'],
        'canProceedFromPhase'
      ).mockResolvedValue(true);

      // Mock the getAnalystExecutor function
      vi.mocked(getAnalystExecutor).mockResolvedValue({
        'project-brief.md': 'test content',
        'constitution.md': '---\ntitle: Test Constitution\n---\nThis is a test constitution with enough content to pass validation.',
        'project-classification.json': JSON.stringify({
          project_type: 'web_application',
          scale_tier: 'small',
        }),
        'personas.md': '# Test Personas\n\nThis is a test personas file.',
      });

      const mockGitService = {
        initialize: vi.fn().mockResolvedValue(undefined),
        getMode: vi.fn().mockReturnValue('local_only'),
        commitPhaseArtifacts: vi.fn().mockResolvedValue({
          success: true,
          commitHash: 'abc123',
          branch: 'spec/test-project',
          mode: 'local_only' as const,
        }),
      };

      const mockRollbackService = {
        createSnapshot: vi.fn().mockResolvedValue({
          success: true,
          snapshotId: 'snapshot-1',
        }),
      };

      orchestrator['gitService'].set('test-project-id', mockGitService as any);
      orchestrator['rollbackService'].set('test-project-id', mockRollbackService as any);

      await orchestrator['runPhaseAgent'](mockProject, {});

      const endTime = Date.now();
      const durationMs = endTime - startTime;

      expect(mockGitService.commitPhaseArtifacts).toHaveBeenCalledWith(
        expect.objectContaining({
          durationMs: expect.any(Number),
        })
      );

      // Verify duration is within reasonable bounds
      expect(durationMs).toBeLessThan(5000);
    });

    it('should create Git commit after successful artifact generation', async () => {
      vi.spyOn(
        orchestrator['approvalGateService'],
        'canProceedFromPhase'
      ).mockResolvedValue(true);

      // Mock the getAnalystExecutor function
      vi.mocked(getAnalystExecutor).mockResolvedValue({
        'project-brief.md': 'test content',
        'constitution.md': '---\ntitle: Test Constitution\n---\nThis is a test constitution with enough content to pass validation.',
        'project-classification.json': JSON.stringify({
          project_type: 'web_application',
          scale_tier: 'small',
        }),
        'personas.md': '# Test Personas\n\nThis is a test personas file.',
      });

      const mockGitService = {
        initialize: vi.fn().mockResolvedValue(undefined),
        getMode: vi.fn().mockReturnValue('local_only'),
        commitPhaseArtifacts: vi.fn().mockResolvedValue({
          success: true,
          commitHash: 'abc123',
          branch: 'spec/test-project',
          mode: 'local_only' as const,
        }),
      };

      const mockRollbackService = {
        createSnapshot: vi.fn().mockResolvedValue({
          success: true,
          snapshotId: 'snapshot-1',
        }),
      };

      orchestrator['gitService'].set('test-project-id', mockGitService as any);
      orchestrator['rollbackService'].set('test-project-id', mockRollbackService as any);

      await orchestrator['runPhaseAgent'](mockProject, {});

      expect(mockGitService.commitPhaseArtifacts).toHaveBeenCalledWith({
        projectSlug: 'Test Project',
        phase: 'ANALYSIS',
        artifacts: ['project-brief.md', 'constitution.md', 'project-classification.json', 'personas.md'],
        agent: 'analyst',
        durationMs: expect.any(Number),
      });
    });

    it('should create snapshot after Git commit', async () => {
      vi.spyOn(
        orchestrator['approvalGateService'],
        'canProceedFromPhase'
      ).mockResolvedValue(true);

      // Mock the getAnalystExecutor function
      vi.mocked(getAnalystExecutor).mockResolvedValue({
        'project-brief.md': 'test content',
        'constitution.md': '---\ntitle: Test Constitution\n---\nThis is a test constitution with enough content to pass validation.',
        'project-classification.json': JSON.stringify({
          project_type: 'web_application',
          scale_tier: 'small',
        }),
        'personas.md': '# Test Personas\n\nThis is a test personas file.',
      });

      const mockGitService = {
        initialize: vi.fn().mockResolvedValue(undefined),
        getMode: vi.fn().mockReturnValue('local_only'),
        commitPhaseArtifacts: vi.fn().mockResolvedValue({
          success: true,
          commitHash: 'abc123',
          branch: 'spec/test-project',
          mode: 'local_only' as const,
        }),
      };

      const mockRollbackService = {
        createSnapshot: vi.fn().mockResolvedValue({
          success: true,
          snapshotId: 'snapshot-1',
        }),
      };

      orchestrator['gitService'].set('test-project-id', mockGitService as any);
      orchestrator['rollbackService'].set('test-project-id', mockRollbackService as any);

      const result = await orchestrator['runPhaseAgent'](mockProject, {});

      expect(result.success).toBe(true);
      expect(mockRollbackService.createSnapshot).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: 'test-project-id',
          phaseName: 'ANALYSIS',
          artifacts: expect.objectContaining({
            'ANALYSIS/project-brief.md': 'test content',
            'ANALYSIS/constitution.md': '---\ntitle: Test Constitution\n---\nThis is a test constitution with enough content to pass validation.',
            'ANALYSIS/project-classification.json': JSON.stringify({
              project_type: 'web_application',
              scale_tier: 'small',
            }),
            'ANALYSIS/personas.md': '# Test Personas\n\nThis is a test personas file.',
          }),
          metadata: expect.objectContaining({
            agent: 'analyst',
            durationMs: expect.any(Number),
            stackChoice: 'nextjs',
          }),
          gitCommitHash: 'abc123',
          gitBranch: 'spec/test-project',
        })
      );
    });
  });
});
