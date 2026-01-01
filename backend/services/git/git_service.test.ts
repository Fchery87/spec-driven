import { describe, it, expect, vi } from 'vitest';
import { GitService, GitMode } from './git_service';
import { simpleGit } from 'simple-git';

vi.mock('simple-git', () => ({
  simpleGit: vi.fn(() => ({})),
}));

describe('GitService', () => {
  describe('initialization', () => {
    it('should detect Git availability and set mode to full_integration', async () => {
      const mockGit = {
        checkIsRepo: vi.fn().mockResolvedValue(true),
        getRemotes: vi.fn().mockResolvedValue([{ name: 'origin' }]),
      };
      (simpleGit as any).mockReturnValue(mockGit);

      const service = new GitService('/test/project/path');
      await service.initialize();

      expect(service.getMode()).toBe('full_integration');
    });

    it('should fallback to local_only if no remote', async () => {
      const mockGit = {
        checkIsRepo: vi.fn().mockResolvedValue(true),
        getRemotes: vi.fn().mockResolvedValue([]),
      };
      (simpleGit as any).mockReturnValue(mockGit);

      const service = new GitService('/test/project/path');
      await service.initialize();

      expect(service.getMode()).toBe('local_only');
    });

    it('should fallback to disabled if not a git repo', async () => {
      const mockGit = {
        checkIsRepo: vi.fn().mockResolvedValue(false),
      };
      (simpleGit as any).mockReturnValue(mockGit);

      const service = new GitService('/test/project/path');
      await service.initialize();

      expect(service.getMode()).toBe('disabled');
    });
  });

  describe('createSpecBranch', () => {
    it('should create spec branch for project', async () => {
      const mockGit = {
        checkIsRepo: vi.fn().mockResolvedValue(true),
        getRemotes: vi.fn().mockResolvedValue([{ name: 'origin' }]),
        checkoutLocalBranch: vi.fn().mockResolvedValue(undefined),
        branchLocal: vi.fn().mockResolvedValue({ all: [] }),
      };
      (simpleGit as any).mockReturnValue(mockGit);

      const service = new GitService('/test/project');
      await service.initialize();
      await service.createSpecBranch('test-project');

      expect(mockGit.checkoutLocalBranch).toHaveBeenCalledWith('spec/test-project');
    });
  });

  describe('commitPhaseArtifacts', () => {
    it('should commit artifacts with standard message format', async () => {
      const mockGit = {
        checkIsRepo: vi.fn().mockResolvedValue(true),
        getRemotes: vi.fn().mockResolvedValue([{ name: 'origin' }]),
        add: vi.fn().mockResolvedValue(undefined),
        commit: vi.fn().mockResolvedValue({ commit: 'abc123' }),
      };
      (simpleGit as any).mockReturnValue(mockGit);

      const service = new GitService('/test/project');
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
