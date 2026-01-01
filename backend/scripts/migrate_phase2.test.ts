import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runPhase2Migration } from './migrate_phase2';
import { db } from '@/backend/lib/drizzle';

vi.mock('@/backend/lib/drizzle');

// Mock ApprovalGateService class
const mockInitializeGates = vi.fn();
const mockGetProjectGates = vi.fn();

class MockApprovalGateService {
  async initializeGatesForProject(projectId: string): Promise<void> {
    return mockInitializeGates(projectId);
  }

  async getProjectGates(projectId: string): Promise<any[]> {
    return mockGetProjectGates(projectId);
  }
}

vi.mock('@/backend/services/approval/approval_gate_service', () => ({
  ApprovalGateService: MockApprovalGateService,
}));

describe('Phase 2 Migration Script', () => {
  const mockProjects = [
    { id: 'project-1', slug: 'test-1' },
    { id: 'project-2', slug: 'test-2' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockInitializeGates.mockReset();
    mockGetProjectGates.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('dry run mode', () => {
    it('should count projects and gates in dry run mode', async () => {
      const mockFindMany = vi.fn().mockResolvedValue(mockProjects);
      (db.query.projects.findMany as any) = mockFindMany;

      const result = await runPhase2Migration({ dryRun: true });

      expect(result.projectsProcessed).toBe(2);
      expect(result.gatesInitialized).toBe(8); // 4 gates per project
      expect(result.errors).toEqual([]);
    });

    it('should filter by projectIds in dry run mode', async () => {
      const mockFindMany = vi.fn().mockResolvedValue([mockProjects[0]]);
      (db.query.projects.findMany as any) = mockFindMany;

      const result = await runPhase2Migration({
        dryRun: true,
        projectIds: ['project-1'],
      });

      expect(result.projectsProcessed).toBe(1);
      expect(result.gatesInitialized).toBe(4);
      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.any(Function),
        })
      );
    });
  });

  describe('live migration mode', () => {
    it('should initialize gates for existing projects', async () => {
      const mockFindMany = vi.fn().mockResolvedValue(mockProjects);
      (db.query.projects.findMany as any) = mockFindMany;

      mockInitializeGates.mockResolvedValue(undefined);
      mockGetProjectGates.mockResolvedValue([]);

      const result = await runPhase2Migration({ dryRun: false });

      expect(result.projectsProcessed).toBe(2);
      expect(result.gatesInitialized).toBe(8);
      expect(mockInitializeGates).toHaveBeenCalledTimes(2);
      expect(mockInitializeGates).toHaveBeenCalledWith('project-1');
      expect(mockInitializeGates).toHaveBeenCalledWith('project-2');
    });

    it('should skip projects with existing gates', async () => {
      const mockFindMany = vi.fn().mockResolvedValue(mockProjects);
      (db.query.projects.findMany as any) = mockFindMany;

      mockInitializeGates.mockResolvedValue(undefined);
      mockGetProjectGates
        .mockResolvedValueOnce([{ id: 'gate-1', gateName: 'stack_approved' }]) // project-1 has gates
        .mockResolvedValueOnce([]); // project-2 has no gates

      const result = await runPhase2Migration({ dryRun: false });

      expect(result.projectsProcessed).toBe(1);
      expect(result.gatesInitialized).toBe(4);
      expect(mockInitializeGates).toHaveBeenCalledTimes(1);
      expect(mockInitializeGates).toHaveBeenCalledWith('project-2');
    });
  });

  describe('error handling', () => {
    it('should handle database errors gracefully', async () => {
      const mockFindMany = vi.fn().mockRejectedValue(new Error('DB error'));
      (db.query.projects.findMany as any) = mockFindMany;

      await expect(runPhase2Migration()).rejects.toThrow('DB error');
    });

    it('should collect errors for individual project failures', async () => {
      const mockFindMany = vi.fn().mockResolvedValue(mockProjects);
      (db.query.projects.findMany as any) = mockFindMany;

      mockInitializeGates
        .mockResolvedValueOnce(undefined) // project-1 succeeds
        .mockRejectedValueOnce(new Error('Migration failed for project-2')); // project-2 fails
      mockGetProjectGates.mockResolvedValue([]);

      const result = await runPhase2Migration({ dryRun: false });

      expect(result.projectsProcessed).toBe(1);
      expect(result.gatesInitialized).toBe(4);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Failed to migrate project test-2');
      expect(result.errors[0]).toContain('Migration failed for project-2');
    });
  });

  describe('edge cases', () => {
    it('should handle empty project list', async () => {
      const mockFindMany = vi.fn().mockResolvedValue([]);
      (db.query.projects.findMany as any) = mockFindMany;

      const result = await runPhase2Migration({ dryRun: true });

      expect(result.projectsProcessed).toBe(0);
      expect(result.gatesInitialized).toBe(0);
      expect(result.errors).toEqual([]);
    });

    it('should handle non-existent projectIds', async () => {
      const mockFindMany = vi.fn().mockResolvedValue([]);
      (db.query.projects.findMany as any) = mockFindMany;

      const result = await runPhase2Migration({
        dryRun: true,
        projectIds: ['non-existent-1', 'non-existent-2'],
      });

      expect(result.projectsProcessed).toBe(0);
      expect(result.gatesInitialized).toBe(0);
    });
  });
});
