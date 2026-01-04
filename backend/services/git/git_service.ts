import simpleGit, { SimpleGit, SimpleGitOptions } from 'simple-git';
import { logger } from '@/lib/logger';
import { GitMode, GitConfig, DEFAULT_GIT_CONFIG } from './git_config';
import * as fs from 'fs/promises';
import * as path from 'path';

export type { GitMode } from './git_config';

export interface CommitPhaseOptions {
  projectSlug: string;
  phase: string;
  artifacts: string[];
  agent: string;
  durationMs: number;
}

export interface CommitResult {
  success: boolean;
  commitHash?: string;
  branch?: string;
  error?: string;
  mode: GitMode;
}

export interface TagResult {
  success: boolean;
  tag?: string;
  error?: string;
}

export class GitService {
  private git: SimpleGit;
  private mode: GitMode = 'disabled';
  private projectPath: string;
  private config: GitConfig;
  private initialized = false;

  /**
   * Create a GitService instance
   * @param projectPath - Path to the git repository
   * @param config - Optional configuration overrides
   * @param gitInstance - Optional SimpleGit instance for testing (internal use)
   */
  constructor(projectPath: string, config: Partial<GitConfig> = {}, gitInstance?: SimpleGit) {
    this.projectPath = projectPath;
    this.config = { ...DEFAULT_GIT_CONFIG, ...config };

    if (gitInstance) {
      // Use provided instance (for testing)
      this.git = gitInstance;
    } else {
      const options: Partial<SimpleGitOptions> = {
        baseDir: projectPath,
        binary: 'git',
        maxConcurrentProcesses: 6,
      };
      this.git = simpleGit(options);
    }
  }

  /**
   * Initialize Git service and detect mode
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Check if directory is a git repo
      const isRepo = await this.git.checkIsRepo();

      if (!isRepo) {
        logger.info('[GitService] Not a Git repository, mode: disabled');
        this.mode = 'disabled';
        this.initialized = true;
        return;
      }

      // Check if remote exists
      const remotes = await this.git.getRemotes(false);
      const hasRemote = remotes.length > 0;

      if (hasRemote) {
        // Try to test remote connectivity
        try {
          await this.git.listRemote(['--heads']);
          this.mode = 'full_integration';
          logger.info('[GitService] Git mode: full_integration (remote accessible)');
        } catch (error) {
          this.mode = 'local_only';
          logger.warn('[GitService] Git mode: local_only (remote not accessible)', {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      } else {
        this.mode = 'local_only';
        logger.info('[GitService] Git mode: local_only (no remote configured)');
      }
    } catch (error) {
      logger.error('[GitService] Initialization error, mode: disabled', {
        error: error instanceof Error ? error.message : String(error),
      } as any);
      this.mode = 'disabled';
    }

    this.initialized = true;
  }

  /**
   * Get current Git mode
   */
  getMode(): GitMode {
    return this.mode;
  }

  /**
   * Create spec branch for project (spec/{project-slug})
   */
  async createSpecBranch(projectSlug: string): Promise<CommitResult> {
    await this.initialize();

    if (this.mode === 'disabled') {
      return {
        success: false,
        error: 'Git disabled - not a repository',
        mode: this.mode,
      };
    }

    const branchName = `${this.config.branch_prefix}${projectSlug}`;

    try {
      // Check if branch exists
      const branches = await this.git.branchLocal();
      const branchExists = branches.all.includes(branchName);

      if (branchExists) {
        logger.info(`[GitService] Branch ${branchName} already exists`);
        await this.git.checkout(branchName);
      } else {
        await this.git.checkoutLocalBranch(branchName);
        logger.info(`[GitService] Created and checked out branch: ${branchName}`);
      }

      // Create .specignore if it doesn't exist
      const specIgnorePath = path.join(this.projectPath, 'specs', '.specignore');
      try {
        await fs.access(specIgnorePath);
      } catch {
        const specIgnoreContent = this.config.never_commit.join('\n');
        await fs.mkdir(path.dirname(specIgnorePath), { recursive: true });
        await fs.writeFile(specIgnorePath, specIgnoreContent);
        logger.info('[GitService] Created .specignore');
      }

      return {
        success: true,
        branch: branchName,
        mode: this.mode,
      };
    } catch (error) {
      logger.error('[GitService] Failed to create spec branch', {
        errorMessage: error instanceof Error ? error.message : String(error),
      } as any);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        mode: this.mode,
      };
    }
  }

  /**
   * Commit phase artifacts with standard message format
   */
  async commitPhaseArtifacts(options: CommitPhaseOptions): Promise<CommitResult> {
    await this.initialize();

    if (this.mode === 'disabled') {
      return {
        success: true, // Don't fail the workflow, just skip Git
        error: 'Git disabled - artifacts saved to filesystem only',
        mode: this.mode,
      };
    }

    const { projectSlug, phase, artifacts, agent, durationMs } = options;

    try {
      // Stage artifacts
      const artifactPaths = artifacts.map(a => `specs/${phase}/v1/${a}`);
      await this.git.add(artifactPaths);

      // Generate commit message
      const message = this.formatCommitMessage({
        phase,
        artifacts,
        projectSlug,
        agent,
        durationMs,
      });

      // Commit
      const commitResult = await this.git.commit(message);
      const commitHash = commitResult.commit;

      logger.info('[GitService] Phase artifacts committed', {
        phase,
        commitHash,
        artifactCount: artifacts.length,
      });

      // Push if in full_integration mode
      if (this.mode === 'full_integration') {
        try {
          const branchName = `${this.config.branch_prefix}${projectSlug}`;
          await this.git.push('origin', branchName);
          logger.info('[GitService] Pushed to remote', { branch: branchName });
        } catch (pushError) {
          logger.warn('[GitService] Push failed, continuing locally', {
            error: pushError instanceof Error ? pushError.message : String(pushError),
          } as any);
          // Don't fail the commit if push fails
        }
      }

      return {
        success: true,
        commitHash,
        branch: `${this.config.branch_prefix}${projectSlug}`,
        mode: this.mode,
      };
    } catch (error) {
      logger.error('[GitService] Commit failed', {
        errorMessage: error instanceof Error ? error.message : String(error),
      } as any);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        mode: this.mode,
      };
    }
  }

  /**
   * Create tag for handoff completion
   */
  async createHandoffTag(projectSlug: string, version: string): Promise<TagResult> {
    await this.initialize();

    if (this.mode === 'disabled') {
      return {
        success: false,
        error: 'Git disabled',
      };
    }

    const tagName = `handoff-v${version}`;

    try {
      await this.git.addTag(tagName);
      logger.info('[GitService] Created handoff tag', { tag: tagName });

      if (this.mode === 'full_integration') {
        await this.git.pushTags('origin');
        logger.info('[GitService] Pushed tag to remote');
      }

      return {
        success: true,
        tag: tagName,
      };
    } catch (error) {
      logger.error('[GitService] Failed to create tag', {
        errorMessage: error instanceof Error ? error.message : String(error),
      } as any);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Format commit message using template
   */
  private formatCommitMessage(params: {
    phase: string;
    artifacts: string[];
    projectSlug: string;
    agent: string;
    durationMs: number;
  }): string {
    const { phase, artifacts, projectSlug, agent, durationMs } = params;

    const artifactList = artifacts.map(a => `- ${a}`).join('\n');
    const agentRoleMap: Record<string, string> = {
      analyst: 'Business Analyst',
      pm: 'Product Manager',
      architect: 'Software Architect',
      designer: 'UI/UX Designer',
      scrummaster: 'Scrum Master',
      devops: 'DevOps Engineer',
    };

    return this.config.commit_message_template
      .replace('{phase}', phase)
      .replace('{artifacts}', artifacts.join(', '))
      .replace('{project-name}', projectSlug)
      .replace('{phase-name}', phase)
      .replace('{owner}', agent)
      .replace('{duration}', durationMs.toString())
      .replace('{artifact-list}', artifactList)
      .replace('{agent-role}', agentRoleMap[agent] || agent);
  }
}
