import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RollbackService } from './rollback_service';
import { GitService } from '../git/git_service';
import { db } from '@/backend/lib/drizzle';

vi.mock('@/backend/lib/drizzle');
vi.mock('../git/git_service');

describe('RollbackService', () => {
  let service: RollbackService;
  let mockGitService: any;
  const mockProjectId = 'test-project-123';
  const mockProjectPath = '/test/project';

  beforeEach(() => {
    mockGitService = {
      initialize: vi.fn(),
      getMode: vi.fn().mockReturnValue('local_only'),
    };
    (GitService as any).mockImplementation(() => mockGitService);

    service = new RollbackService(mockProjectPath);
    vi.clearAllMocks();
  });

  describe('createSnapshot', () => {
    it('should create snapshot with artifacts and metadata', async () => {
      const mockInsert = vi.fn().mockResolvedValue([{ id: 'snapshot-123' }]);
      (db.insert as any).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: mockInsert,
        }),
      });

      const result = await service.createSnapshot({
        projectId: mockProjectId,
        phaseName: 'ANALYSIS',
        artifacts: {
          'project-brief.md': 'content1',
          'personas.md': 'content2',
        },
        metadata: {
          agent: 'analyst',
          durationMs: 45000,
        },
        gitCommitHash: 'abc123',
      });

      expect(result.success).toBe(true);
      expect(result.snapshotId).toBe('snapshot-123');
      expect(mockInsert).toHaveBeenCalled();
    });
  });

  describe('getSnapshotsForPhase', () => {
    it('should retrieve snapshots ordered by snapshot number', async () => {
      const mockSnapshots = [
        { id: '1', snapshotNumber: 1, phaseName: 'ANALYSIS' },
        { id: '2', snapshotNumber: 2, phaseName: 'ANALYSIS' },
      ];
      (db.query.phaseSnapshots.findMany as any).mockResolvedValue(mockSnapshots);

      const snapshots = await service.getSnapshotsForPhase(mockProjectId, 'ANALYSIS');

      expect(snapshots).toHaveLength(2);
      expect(snapshots[0].snapshotNumber).toBe(2); // Latest first
    });
  });

  describe('canRollback', () => {
    it('should allow rollback if within max depth (3 phases)', () => {
      const phasesCompleted = ['ANALYSIS', 'STACK_SELECTION', 'SPEC', 'DEPENDENCIES'];
      const result = service.canRollback('ANALYSIS', phasesCompleted);

      expect(result.canRollback).toBe(true);
    });

    it('should disallow rollback if exceeds max depth', () => {
      const phasesCompleted = ['ANALYSIS', 'STACK_SELECTION', 'SPEC', 'DEPENDENCIES', 'SOLUTIONING'];
      const result = service.canRollback('ANALYSIS', phasesCompleted);

      expect(result.canRollback).toBe(false);
      expect(result.reason).toContain('exceeds maximum rollback depth');
    });
  });

  describe('rollbackToPhase', () => {
    it('should restore artifacts from snapshot', async () => {
      const mockSnapshot = {
        id: 'snapshot-123',
        artifactsJson: JSON.stringify({
          'project-brief.md': 'old content',
        }),
        metadata: JSON.stringify({ agent: 'analyst' }),
        gitCommitHash: 'abc123',
      };

      (db.query.phaseSnapshots.findFirst as any).mockResolvedValue(mockSnapshot);

      const result = await service.rollbackToPhase({
        projectId: mockProjectId,
        targetPhase: 'ANALYSIS',
        phasesCompleted: ['ANALYSIS', 'STACK_SELECTION', 'SPEC'],
        confirmDangerousOperation: true,
      });

      expect(result.success).toBe(true);
      expect(result.restoredArtifacts).toEqual(['project-brief.md']);
    });

    it('should fail if confirmation not provided', async () => {
      const result = await service.rollbackToPhase({
        projectId: mockProjectId,
        targetPhase: 'ANALYSIS',
        phasesCompleted: ['ANALYSIS', 'STACK_SELECTION'],
        confirmDangerousOperation: false,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('confirmation required');
    });
  });
});
