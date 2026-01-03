import { describe, it, expect, vi } from 'vitest';
import { GitService, GitMode } from './git_service';
import simpleGit from 'simple-git';

// Mock simple-git module - used by tests that don't need the gitInstance parameter
vi.mock('simple-git', () => {
  const mockSimpleGit = vi.fn(() => ({
    checkIsRepo: vi.fn().mockResolvedValue(true),
    getRemotes: vi.fn().mockResolvedValue([{ name: 'origin' }]),
    listRemote: vi.fn().mockResolvedValue([]),
    add: vi.fn().mockResolvedValue(undefined),
    commit: vi.fn().mockResolvedValue({ commit: 'abc123' }),
    checkoutLocalBranch: vi.fn().mockResolvedValue(undefined),
    branchLocal: vi.fn().mockResolvedValue({ all: [] }),
    init: vi.fn().mockResolvedValue(undefined),
  }));
  return {
    default: mockSimpleGit,
  };
});

// Create a mock git instance that can be passed to GitService constructor
function createMockGit(overrides: Record<string, unknown> = {}) {
  const defaultMock = {
    checkIsRepo: vi.fn().mockResolvedValue(true),
    getRemotes: vi.fn().mockResolvedValue([{ name: 'origin', url: 'https://github.com/test/repo.git' }]),
    listRemote: vi.fn().mockResolvedValue(''),
    add: vi.fn().mockResolvedValue(''),
    commit: vi.fn().mockResolvedValue({ commit: 'abc123', summary: { changes: 1, insertions: 1, deletions: 0 } }),
    checkoutLocalBranch: vi.fn().mockResolvedValue(undefined),
    branchLocal: vi.fn().mockResolvedValue({ all: ['main', 'spec/test'], current: 'main' }),
    init: vi.fn().mockResolvedValue(''),
  };
  return { ...defaultMock, ...overrides } as Record<string, unknown>;
}

describe('GitService', () => {
  describe('initialization', () => {
    it('should detect Git availability and set mode to full_integration', async () => {
      // Pass mock git instance directly to constructor - this bypasses ES module mocking issues
      const mockGit = createMockGit({
        checkIsRepo: vi.fn().mockResolvedValue(true),
        getRemotes: vi.fn().mockResolvedValue([{ name: 'origin', url: 'https://github.com/test/repo.git' }]),
        listRemote: vi.fn().mockResolvedValue('abc123\n'), // Success - remote is accessible
      });

      const service = new GitService('/test/project/path', {}, mockGit);
      await service.initialize();

      expect(service.getMode()).toBe('full_integration');
    });

    it('should fallback to local_only if no remote', async () => {
      const mockGit = createMockGit({
        getRemotes: vi.fn().mockResolvedValue([]), // No remotes
      });

      const service = new GitService('/test/project/path', {}, mockGit);
      await service.initialize();

      expect(service.getMode()).toBe('local_only');
    });

    it('should fallback to disabled if not a git repo', async () => {
      const mockGit = createMockGit({
        checkIsRepo: vi.fn().mockResolvedValue(false), // Not a git repo
      });

      const service = new GitService('/test/project/path', {}, mockGit);
      await service.initialize();

      expect(service.getMode()).toBe('disabled');
    });
  });

  describe('createSpecBranch', () => {
    it('should create spec branch for project', async () => {
      const mockGit = createMockGit({
        checkoutLocalBranch: vi.fn().mockResolvedValue(undefined),
      });

      const service = new GitService('/test/project', {}, mockGit);
      await service.initialize();
      await service.createSpecBranch('test-project');

      expect(mockGit.checkoutLocalBranch).toHaveBeenCalledWith('spec/test-project');
    });
  });

  describe('commitPhaseArtifacts', () => {
    it('should commit artifacts with standard message format', async () => {
      const mockGit = createMockGit({
        commit: vi.fn().mockResolvedValue({ commit: 'abc123', summary: { changes: 1, insertions: 1, deletions: 0 } }),
      });

      const service = new GitService('/test/project', {}, mockGit);
      await service.initialize();

      const result = await service.commitPhaseArtifacts({
        projectSlug: 'test-project',
        phase: 'ANALYSIS',
        artifacts: ['project-brief.md', 'personas.md'],
        agent: 'analyst',
        durationMs: 45000,
      });

      expect(result.success).toBe(true);
      expect(result.commitHash).toBe('abc123');
      expect(mockGit.commit).toHaveBeenCalledWith(
        expect.stringContaining('ANALYSIS: Generate project-brief.md, personas.md')
      );
    });
  });
});
