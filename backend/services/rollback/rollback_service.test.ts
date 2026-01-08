import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RollbackService } from './rollback_service';
import { setDbForTesting } from '@/backend/lib/drizzle';

// Create a real class that can be used as a mock constructor
class MockGitServiceClass {
  initialize = vi.fn();
  getMode = vi.fn().mockReturnValue('local_only');
}

// Mock the git_service module - vi.mock is hoisted so we can't reference MockGitServiceClass directly
// Instead, we use vi.doMock in beforeEach or use a different approach
vi.mock('@/backend/services/git/git_service');

// Shared mock db instance for all tests
const mockDb = {
  insert: vi.fn().mockReturnValue({
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([{ id: 'new-snapshot-id' }]),
    }),
  }),
  update: vi.fn().mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([]),
    }),
  }),
  delete: vi.fn().mockReturnValue({
    where: vi.fn().mockResolvedValue([]),
  }),
  select: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([]),
    }),
  }),
  query: {
    phaseSnapshots: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
  },
};

describe('RollbackService', () => {
  let service: RollbackService;
  const mockProjectId = 'test-project-123';
  const mockProjectPath = '/test/project';
  let GitServiceMock: typeof MockGitServiceClass;

  beforeEach(async () => {
    // Clear all mocks before each test
    vi.clearAllMocks();
    
    // Reset mock functions
    mockDb.insert = vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'new-snapshot-id' }]),
      }),
    });
    mockDb.query.phaseSnapshots.findFirst = vi.fn();
    mockDb.query.phaseSnapshots.findMany = vi.fn();
    
    // Set up the mock db
    setDbForTesting(mockDb);
    
    // Import the mocked module and set up the mock
    const gitServiceModule = await import('@/backend/services/git/git_service');
    GitServiceMock = gitServiceModule.GitService as unknown as typeof MockGitServiceClass;
    
    // Replace the mock with our class
    Object.assign(GitServiceMock, MockGitServiceClass);
    
    // Create a new instance for each test
    service = new RollbackService(mockProjectPath);
  });

  describe('createSnapshot', () => {
    it('should create snapshot with artifacts and metadata', async () => {
      const mockInsert = vi.fn().mockResolvedValue([{ id: 'snapshot-123' }]);
      
      // Mock db.query.phaseSnapshots.findMany (for getting existing snapshots)
      mockDb.query.phaseSnapshots.findMany = vi.fn().mockResolvedValue([]);
      
      // Mock db.insert chain: insert().values().returning()
      // drizzle-orm pattern: insert(table).values(...).returning()
      mockDb.insert = vi.fn().mockImplementation(() => ({
        values: vi.fn().mockReturnValue({
          returning: mockInsert,
        }),
      }));

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
        { id: '2', snapshotNumber: 2, phaseName: 'ANALYSIS' },
        { id: '1', snapshotNumber: 1, phaseName: 'ANALYSIS' },
      ];
      mockDb.query.phaseSnapshots.findMany = vi.fn().mockResolvedValue(mockSnapshots);

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

      mockDb.query.phaseSnapshots.findFirst = vi.fn().mockResolvedValue(mockSnapshot);

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
