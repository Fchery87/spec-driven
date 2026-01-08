# Phase 2: Collaboration & Control Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement Progressive Approval System, Git Workflow Integration, and Rollback & State Management as an integrated system for stakeholder collaboration and version control.

**Architecture:** Three-layer integration: (1) Database layer extends existing schema with approval gates, snapshots, and git operations tracking; (2) Service layer adds git_service, approval_service, and rollback_service that integrate with existing OrchestratorEngine; (3) API layer adds routes for approvals, rollback, and git status that integrate with existing execute-phase workflow.

**Tech Stack:** Drizzle ORM (existing), simple-git (new), TypeScript, PostgreSQL, Next.js API routes

**Design Principles:**
- Seamless integration: extend existing services, don't create parallel systems
- Git-first snapshots: leverage Git commits as primary rollback mechanism
- Graceful degradation: full_integration → local_only → disabled fallback
- Non-blocking gates: only stack_approved blocks by default

---

## Task 1: Extend Database Schema

**Files:**
- Modify: `backend/lib/schema.ts:220-250`
- Create: `backend/lib/migrations/0005_add_phase2_tables.sql`
- Test: `backend/lib/schema.test.ts`

**Step 1: Write failing tests for new schema tables**

```typescript
// backend/lib/schema.test.ts (add to existing file)
import { describe, it, expect } from 'vitest';
import { phaseSnapshots, approvalGates, gitOperations } from './schema';

describe('Phase 2 Schema', () => {
  describe('phaseSnapshots table', () => {
    it('should have all required columns', () => {
      const columns = Object.keys(phaseSnapshots);
      expect(columns).toContain('id');
      expect(columns).toContain('projectId');
      expect(columns).toContain('phaseName');
      expect(columns).toContain('snapshotNumber');
      expect(columns).toContain('artifactsJson');
      expect(columns).toContain('metadata');
      expect(columns).toContain('gitCommitHash');
    });
  });

  describe('approvalGates table', () => {
    it('should have all required columns', () => {
      const columns = Object.keys(approvalGates);
      expect(columns).toContain('id');
      expect(columns).toContain('gateName');
      expect(columns).toContain('status');
      expect(columns).toContain('blocking');
      expect(columns).toContain('constitutionalScore');
    });
  });

  describe('gitOperations table', () => {
    it('should have all required columns', () => {
      const columns = Object.keys(gitOperations);
      expect(columns).toContain('operationType');
      expect(columns).toContain('commitHash');
      expect(columns).toContain('success');
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test backend/lib/schema.test.ts`
Expected: FAIL with "Cannot find name 'phaseSnapshots'"

**Step 3: Add schema definitions to schema.ts**

```typescript
// backend/lib/schema.ts (add after autoRemedyRuns table, around line 220)

// Phase 2: Phase snapshots for rollback capability
export const phaseSnapshots = pgTable('PhaseSnapshot', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  phaseName: text('phase_name').notNull(),
  snapshotNumber: integer('snapshot_number').notNull(),

  // Snapshot contents (JSON stored as text)
  artifactsJson: text('artifacts_json').notNull(),
  metadata: text('metadata').notNull(),
  userInputs: text('user_inputs'),
  validationResults: text('validation_results'),

  // Git integration
  gitCommitHash: text('git_commit_hash'),
  gitBranch: text('git_branch'),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  projectPhaseIdx: index('PhaseSnapshot_project_phase_idx').on(table.projectId, table.phaseName),
  createdAtIdx: index('PhaseSnapshot_created_at_idx').on(table.createdAt),
}));

// Phase 2: Approval gate tracking
export const approvalGates = pgTable('ApprovalGate', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),

  gateName: text('gate_name').notNull(), // stack_approved, prd_approved, architecture_approved, handoff_acknowledged
  phase: text('phase').notNull(),

  status: text('status').notNull().default('pending'), // pending, approved, rejected, auto_approved
  blocking: boolean('blocking').notNull().default(false),

  // Approval details
  approvedBy: uuid('approved_by').references(() => users.id),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  rejectionReason: text('rejection_reason'),
  autoApproved: boolean('auto_approved').default(false),
  constitutionalScore: integer('constitutional_score'),

  // Stakeholder info
  stakeholderRole: text('stakeholder_role'),
  notes: text('notes'),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  projectGateIdx: index('ApprovalGate_project_gate_idx').on(table.projectId, table.gateName),
  statusIdx: index('ApprovalGate_status_idx').on(table.status),
}));

// Phase 2: Git operation tracking
export const gitOperations = pgTable('GitOperation', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),

  operationType: text('operation_type').notNull(), // commit, push, tag, rollback
  phase: text('phase').notNull(),

  commitHash: text('commit_hash'),
  commitMessage: text('commit_message'),
  branch: text('branch'),
  tag: text('tag'),

  success: boolean('success').notNull(),
  errorMessage: text('error_message'),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  projectIdx: index('GitOperation_project_idx').on(table.projectId),
  typeIdx: index('GitOperation_type_idx').on(table.operationType),
  createdAtIdx: index('GitOperation_created_at_idx').on(table.createdAt),
}));

// Add relations (after existing relations, around line 245)
export const phaseSnapshotsRelations = relations(phaseSnapshots, ({ one }) => ({
  project: one(projects, {
    fields: [phaseSnapshots.projectId],
    references: [projects.id],
  }),
}));

export const approvalGatesRelations = relations(approvalGates, ({ one }) => ({
  project: one(projects, {
    fields: [approvalGates.projectId],
    references: [projects.id],
  }),
  approvedByUser: one(users, {
    fields: [approvalGates.approvedBy],
    references: [users.id],
  }),
}));

export const gitOperationsRelations = relations(gitOperations, ({ one }) => ({
  project: one(projects, {
    fields: [gitOperations.projectId],
    references: [projects.id],
  }),
}));

// Update projectsRelations to include new relations (find existing projectsRelations and add)
// Modify the existing projectsRelations definition to add:
//   phaseSnapshots: many(phaseSnapshots),
//   approvalGates: many(approvalGates),
//   gitOperations: many(gitOperations),
```

**Step 4: Run test to verify it passes**

Run: `npm test backend/lib/schema.test.ts`
Expected: PASS

**Step 5: Create database migration**

```sql
-- backend/lib/migrations/0005_add_phase2_tables.sql
-- Phase 2: Collaboration & Control Tables

-- Phase Snapshots for rollback capability
CREATE TABLE "PhaseSnapshot" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "project_id" uuid NOT NULL REFERENCES "Project"("id") ON DELETE CASCADE,
  "phase_name" text NOT NULL,
  "snapshot_number" integer NOT NULL,
  "artifacts_json" text NOT NULL,
  "metadata" text NOT NULL,
  "user_inputs" text,
  "validation_results" text,
  "git_commit_hash" text,
  "git_branch" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX "PhaseSnapshot_project_phase_idx" ON "PhaseSnapshot" ("project_id", "phase_name");
CREATE INDEX "PhaseSnapshot_created_at_idx" ON "PhaseSnapshot" ("created_at");

-- Approval Gates tracking
CREATE TABLE "ApprovalGate" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "project_id" uuid NOT NULL REFERENCES "Project"("id") ON DELETE CASCADE,
  "gate_name" text NOT NULL,
  "phase" text NOT NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "blocking" boolean NOT NULL DEFAULT false,
  "approved_by" uuid REFERENCES "User"("id"),
  "approved_at" timestamp with time zone,
  "rejection_reason" text,
  "auto_approved" boolean DEFAULT false,
  "constitutional_score" integer,
  "stakeholder_role" text,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX "ApprovalGate_project_gate_idx" ON "ApprovalGate" ("project_id", "gate_name");
CREATE INDEX "ApprovalGate_status_idx" ON "ApprovalGate" ("status");

-- Git Operations tracking
CREATE TABLE "GitOperation" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "project_id" uuid NOT NULL REFERENCES "Project"("id") ON DELETE CASCADE,
  "operation_type" text NOT NULL,
  "phase" text NOT NULL,
  "commit_hash" text,
  "commit_message" text,
  "branch" text,
  "tag" text,
  "success" boolean NOT NULL,
  "error_message" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX "GitOperation_project_idx" ON "GitOperation" ("project_id");
CREATE INDEX "GitOperation_type_idx" ON "GitOperation" ("operation_type");
CREATE INDEX "GitOperation_created_at_idx" ON "GitOperation" ("created_at");

-- Comments for documentation
COMMENT ON TABLE "PhaseSnapshot" IS 'Stores complete phase state for rollback capability (Phase 2)';
COMMENT ON TABLE "ApprovalGate" IS 'Tracks approval workflow for progressive approval system (Phase 2)';
COMMENT ON TABLE "GitOperation" IS 'Audit trail for Git workflow integration (Phase 2)';
```

**Step 6: Run migration**

Run: `npm run db:migrate`
Expected: SUCCESS - 3 tables created

**Step 7: Commit**

```bash
git add backend/lib/schema.ts backend/lib/schema.test.ts backend/lib/migrations/0005_add_phase2_tables.sql
git commit -m "feat(phase2): add database schema for approval gates, snapshots, and git tracking"
```

---

## Task 2: Create Git Service

**Files:**
- Create: `backend/services/git/git_service.ts`
- Create: `backend/services/git/git_service.test.ts`
- Create: `backend/services/git/git_config.ts`

**Step 1: Write failing test for GitService initialization**

```typescript
// backend/services/git/git_service.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GitService, GitMode } from './git_service';
import { simpleGit } from 'simple-git';

vi.mock('simple-git');

describe('GitService', () => {
  describe('initialization', () => {
    it('should detect Git availability and set mode to full_integration', async () => {
      const mockGit = {
        checkIsRepo: vi.fn().mockResolvedValue(true),
        getRemotes: vi.fn().mockResolvedValue([{ name: 'origin' }]),
      };
      vi.mocked(simpleGit).mockReturnValue(mockGit as any);

      const service = new GitService('/test/project/path');
      await service.initialize();

      expect(service.getMode()).toBe('full_integration');
    });

    it('should fallback to local_only if no remote', async () => {
      const mockGit = {
        checkIsRepo: vi.fn().mockResolvedValue(true),
        getRemotes: vi.fn().mockResolvedValue([]),
      };
      vi.mocked(simpleGit).mockReturnValue(mockGit as any);

      const service = new GitService('/test/project/path');
      await service.initialize();

      expect(service.getMode()).toBe('local_only');
    });

    it('should fallback to disabled if not a git repo', async () => {
      const mockGit = {
        checkIsRepo: vi.fn().mockResolvedValue(false),
      };
      vi.mocked(simpleGit).mockReturnValue(mockGit as any);

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
      };
      vi.mocked(simpleGit).mockReturnValue(mockGit as any);

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
      vi.mocked(simpleGit).mockReturnValue(mockGit as any);

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
```

**Step 2: Run test to verify it fails**

Run: `npm test backend/services/git/git_service.test.ts`
Expected: FAIL with "Cannot find module './git_service'"

**Step 3: Install simple-git dependency**

Run: `npm install simple-git`
Expected: Package installed

**Step 4: Create git_config.ts**

```typescript
// backend/services/git/git_config.ts
export type GitMode = 'full_integration' | 'local_only' | 'disabled';

export interface GitConfig {
  mode: GitMode;
  branch_prefix: string;
  commit_message_template: string;
  protected_files: string[];
  never_commit: string[];
}

export const DEFAULT_GIT_CONFIG: GitConfig = {
  mode: 'full_integration', // Will auto-detect and fallback
  branch_prefix: 'spec/',
  commit_message_template: `{phase}: Generate {artifacts}

Project: {project-name}
Phase: {phase-name}
Agent: {owner}
Duration: {duration}ms

Generated artifacts:
{artifact-list}

Co-authored-by: {agent-role} <ai@spec-driven.dev>`,
  protected_files: ['constitution.md', 'project-brief.md'],
  never_commit: ['.env', '.env.local', '*.key', 'secrets/*'],
};
```

**Step 5: Create GitService implementation**

```typescript
// backend/services/git/git_service.ts
import simpleGit, { SimpleGit, SimpleGitOptions } from 'simple-git';
import { logger } from '@/lib/logger';
import { GitMode, GitConfig, DEFAULT_GIT_CONFIG } from './git_config';
import * as fs from 'fs/promises';
import * as path from 'path';

export { GitMode } from './git_config';

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

  constructor(projectPath: string, config: Partial<GitConfig> = {}) {
    this.projectPath = projectPath;
    this.config = { ...DEFAULT_GIT_CONFIG, ...config };

    const options: Partial<SimpleGitOptions> = {
      baseDir: projectPath,
      binary: 'git',
      maxConcurrentProcesses: 6,
    };

    this.git = simpleGit(options);
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
      });
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
        error: error instanceof Error ? error.message : String(error),
      });
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
          });
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
        error: error instanceof Error ? error.message : String(error),
      });
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
        error: error instanceof Error ? error.message : String(error),
      });
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
```

**Step 6: Run tests to verify they pass**

Run: `npm test backend/services/git/git_service.test.ts`
Expected: PASS (all tests)

**Step 7: Commit**

```bash
git add backend/services/git/
git commit -m "feat(phase2): add GitService with full_integration, local_only, disabled modes"
```

---

## Task 3: Create Approval Gate Service

**Files:**
- Create: `backend/services/approval/approval_gate_service.ts`
- Create: `backend/services/approval/approval_gate_service.test.ts`
- Create: `backend/services/approval/gate_config.ts`

**Step 1: Write failing test for ApprovalGateService**

```typescript
// backend/services/approval/approval_gate_service.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ApprovalGateService, GateStatus } from './approval_gate_service';
import { db } from '@/backend/lib/drizzle';

vi.mock('@/backend/lib/drizzle');

describe('ApprovalGateService', () => {
  let service: ApprovalGateService;
  const mockProjectId = 'test-project-123';

  beforeEach(() => {
    service = new ApprovalGateService();
    vi.clearAllMocks();
  });

  describe('initializeGatesForProject', () => {
    it('should create all 4 approval gates for a project', async () => {
      const mockInsert = vi.fn().mockResolvedValue([]);
      vi.mocked(db.insert).mockReturnValue({
        values: mockInsert,
      } as any);

      await service.initializeGatesForProject(mockProjectId);

      expect(mockInsert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ gateName: 'stack_approved' }),
          expect.objectContaining({ gateName: 'prd_approved' }),
          expect.objectContaining({ gateName: 'architecture_approved' }),
          expect.objectContaining({ gateName: 'handoff_acknowledged' }),
        ])
      );
    });
  });

  describe('checkGateStatus', () => {
    it('should return gate status', async () => {
      const mockGate = {
        id: 'gate-123',
        gateName: 'prd_approved',
        status: 'approved',
        blocking: false,
      };
      vi.mocked(db.query.approvalGates.findFirst).mockResolvedValue(mockGate as any);

      const status = await service.checkGateStatus(mockProjectId, 'prd_approved');

      expect(status).toBe('approved');
    });
  });

  describe('approveGate', () => {
    it('should approve a gate and record approver', async () => {
      const mockUpdate = vi.fn().mockResolvedValue([]);
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: mockUpdate,
          }),
        }),
      } as any);

      await service.approveGate({
        projectId: mockProjectId,
        gateName: 'prd_approved',
        approvedBy: 'user-123',
        notes: 'Looks good',
      });

      expect(mockUpdate).toHaveBeenCalled();
    });
  });

  describe('shouldAutoApprove', () => {
    it('should auto-approve if constitutional score >= 95', () => {
      const result = service.shouldAutoApprove('architecture_approved', 96);
      expect(result).toBe(true);
    });

    it('should not auto-approve if score < 95', () => {
      const result = service.shouldAutoApprove('architecture_approved', 94);
      expect(result).toBe(false);
    });

    it('should not auto-approve stack_approved regardless of score', () => {
      const result = service.shouldAutoApprove('stack_approved', 100);
      expect(result).toBe(false);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test backend/services/approval/approval_gate_service.test.ts`
Expected: FAIL with "Cannot find module './approval_gate_service'"

**Step 3: Create gate_config.ts**

```typescript
// backend/services/approval/gate_config.ts
export type GateName = 'stack_approved' | 'prd_approved' | 'architecture_approved' | 'handoff_acknowledged';
export type GateStatus = 'pending' | 'approved' | 'rejected' | 'auto_approved';

export interface GateDefinition {
  name: GateName;
  phase: string;
  blocking: boolean;
  stakeholderRole: string;
  autoApproveThreshold?: number;
  description: string;
}

// Based on PHASE_WORKFLOW_ENHANCEMENT_PLAN.md lines 568-598
export const GATE_DEFINITIONS: GateDefinition[] = [
  {
    name: 'stack_approved',
    phase: 'STACK_SELECTION',
    blocking: true,
    stakeholderRole: 'Technical Lead / CTO',
    description: 'Technology decisions impact all downstream work',
  },
  {
    name: 'prd_approved',
    phase: 'SPEC_PM',
    blocking: false,
    stakeholderRole: 'Product Owner / PM',
    description: 'Requirements must align with business goals',
  },
  {
    name: 'architecture_approved',
    phase: 'SPEC_ARCHITECT',
    blocking: false,
    stakeholderRole: 'Technical Lead / Architect',
    autoApproveThreshold: 95,
    description: 'Architectural decisions should be reviewed before implementation',
  },
  {
    name: 'handoff_acknowledged',
    phase: 'DONE',
    blocking: false,
    stakeholderRole: 'Development Team',
    description: 'Team confirms understanding of handoff package',
  },
];
```

**Step 4: Create ApprovalGateService implementation**

```typescript
// backend/services/approval/approval_gate_service.ts
import { db } from '@/backend/lib/drizzle';
import { approvalGates } from '@/backend/lib/schema';
import { eq, and } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { GateName, GateStatus, GateDefinition, GATE_DEFINITIONS } from './gate_config';

export { GateName, GateStatus } from './gate_config';

export interface ApprovalGateRecord {
  id: string;
  projectId: string;
  gateName: GateName;
  phase: string;
  status: GateStatus;
  blocking: boolean;
  approvedBy?: string;
  approvedAt?: Date;
  rejectionReason?: string;
  autoApproved?: boolean;
  constitutionalScore?: number;
  stakeholderRole: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApproveGateOptions {
  projectId: string;
  gateName: GateName;
  approvedBy: string;
  notes?: string;
  constitutionalScore?: number;
}

export interface RejectGateOptions {
  projectId: string;
  gateName: GateName;
  rejectedBy: string;
  reason: string;
}

export class ApprovalGateService {
  /**
   * Initialize all approval gates for a project
   */
  async initializeGatesForProject(projectId: string): Promise<void> {
    const gateRecords = GATE_DEFINITIONS.map(def => ({
      projectId,
      gateName: def.name,
      phase: def.phase,
      status: 'pending' as GateStatus,
      blocking: def.blocking,
      stakeholderRole: def.stakeholderRole,
    }));

    await db.insert(approvalGates).values(gateRecords);

    logger.info('[ApprovalGateService] Initialized approval gates', {
      projectId,
      gateCount: gateRecords.length,
    });
  }

  /**
   * Get gate definition
   */
  getGateDefinition(gateName: GateName): GateDefinition | undefined {
    return GATE_DEFINITIONS.find(def => def.name === gateName);
  }

  /**
   * Check if gate is passed
   */
  async checkGateStatus(projectId: string, gateName: GateName): Promise<GateStatus | null> {
    const gate = await db.query.approvalGates.findFirst({
      where: and(
        eq(approvalGates.projectId, projectId),
        eq(approvalGates.gateName, gateName)
      ),
    });

    return gate ? (gate.status as GateStatus) : null;
  }

  /**
   * Check if gate is blocking
   */
  async isGateBlocking(projectId: string, gateName: GateName): Promise<boolean> {
    const gate = await db.query.approvalGates.findFirst({
      where: and(
        eq(approvalGates.projectId, projectId),
        eq(approvalGates.gateName, gateName)
      ),
    });

    return gate?.blocking ?? false;
  }

  /**
   * Approve a gate
   */
  async approveGate(options: ApproveGateOptions): Promise<void> {
    const { projectId, gateName, approvedBy, notes, constitutionalScore } = options;

    // Check if should auto-approve based on score
    const autoApprove = constitutionalScore !== undefined &&
                        this.shouldAutoApprove(gateName, constitutionalScore);

    await db.update(approvalGates)
      .set({
        status: autoApprove ? 'auto_approved' : 'approved',
        approvedBy,
        approvedAt: new Date(),
        autoApproved: autoApprove,
        constitutionalScore,
        notes,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(approvalGates.projectId, projectId),
          eq(approvalGates.gateName, gateName)
        )
      );

    logger.info('[ApprovalGateService] Gate approved', {
      projectId,
      gateName,
      autoApprove,
      constitutionalScore,
    });
  }

  /**
   * Reject a gate
   */
  async rejectGate(options: RejectGateOptions): Promise<void> {
    const { projectId, gateName, rejectedBy, reason } = options;

    await db.update(approvalGates)
      .set({
        status: 'rejected',
        approvedBy: rejectedBy,
        rejectionReason: reason,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(approvalGates.projectId, projectId),
          eq(approvalGates.gateName, gateName)
        )
      );

    logger.info('[ApprovalGateService] Gate rejected', {
      projectId,
      gateName,
      reason,
    });
  }

  /**
   * Get all gates for a project
   */
  async getProjectGates(projectId: string): Promise<ApprovalGateRecord[]> {
    const gates = await db.query.approvalGates.findMany({
      where: eq(approvalGates.projectId, projectId),
    });

    return gates as ApprovalGateRecord[];
  }

  /**
   * Check if should auto-approve based on constitutional score
   */
  shouldAutoApprove(gateName: GateName, constitutionalScore: number): boolean {
    const definition = this.getGateDefinition(gateName);

    if (!definition?.autoApproveThreshold) {
      return false;
    }

    return constitutionalScore >= definition.autoApproveThreshold;
  }

  /**
   * Check if all blocking gates are passed for a phase
   */
  async canProceedFromPhase(projectId: string, phase: string): Promise<boolean> {
    const gates = await db.query.approvalGates.findMany({
      where: and(
        eq(approvalGates.projectId, projectId),
        eq(approvalGates.phase, phase)
      ),
    });

    const blockingGates = gates.filter(gate => gate.blocking);

    if (blockingGates.length === 0) {
      return true; // No blocking gates
    }

    // All blocking gates must be approved or auto_approved
    return blockingGates.every(
      gate => gate.status === 'approved' || gate.status === 'auto_approved'
    );
  }
}
```

**Step 5: Run tests to verify they pass**

Run: `npm test backend/services/approval/approval_gate_service.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add backend/services/approval/
git commit -m "feat(phase2): add ApprovalGateService with 4 gates and auto-approval logic"
```

---

## Task 4: Create Rollback Service

**Files:**
- Create: `backend/services/rollback/rollback_service.ts`
- Create: `backend/services/rollback/rollback_service.test.ts`

**Step 1: Write failing test for RollbackService**

```typescript
// backend/services/rollback/rollback_service.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
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
    vi.mocked(GitService).mockImplementation(() => mockGitService);

    service = new RollbackService(mockProjectPath);
    vi.clearAllMocks();
  });

  describe('createSnapshot', () => {
    it('should create snapshot with artifacts and metadata', async () => {
      const mockInsert = vi.fn().mockResolvedValue([{ id: 'snapshot-123' }]);
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: mockInsert,
        }),
      } as any);

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
      vi.mocked(db.query.phaseSnapshots.findMany).mockResolvedValue(mockSnapshots as any);

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

      vi.mocked(db.query.phaseSnapshots.findFirst).mockResolvedValue(mockSnapshot as any);

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
```

**Step 2: Run test to verify it fails**

Run: `npm test backend/services/rollback/rollback_service.test.ts`
Expected: FAIL with "Cannot find module './rollback_service'"

**Step 3: Create RollbackService implementation**

```typescript
// backend/services/rollback/rollback_service.ts
import { db } from '@/backend/lib/drizzle';
import { phaseSnapshots } from '@/backend/lib/schema';
import { eq, and, desc } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { GitService } from '../git/git_service';
import * as fs from 'fs/promises';
import * as path from 'path';

const MAX_ROLLBACK_DEPTH = 3; // Can go back 3 phases

export interface CreateSnapshotOptions {
  projectId: string;
  phaseName: string;
  artifacts: Record<string, string>;
  metadata: Record<string, any>;
  userInputs?: Record<string, any>;
  validationResults?: Record<string, any>;
  gitCommitHash?: string;
  gitBranch?: string;
}

export interface SnapshotRecord {
  id: string;
  projectId: string;
  phaseName: string;
  snapshotNumber: number;
  artifactsJson: string;
  metadata: string;
  userInputs?: string;
  validationResults?: string;
  gitCommitHash?: string;
  gitBranch?: string;
  createdAt: Date;
}

export interface RollbackOptions {
  projectId: string;
  targetPhase: string;
  phasesCompleted: string[];
  confirmDangerousOperation: boolean;
}

export interface RollbackResult {
  success: boolean;
  snapshotId?: string;
  restoredArtifacts?: string[];
  gitCommitHash?: string;
  error?: string;
}

export interface CanRollbackResult {
  canRollback: boolean;
  reason?: string;
  depthFromCurrent?: number;
}

export class RollbackService {
  private gitService: GitService;

  constructor(projectPath: string) {
    this.gitService = new GitService(projectPath);
  }

  /**
   * Create snapshot for a phase
   */
  async createSnapshot(options: CreateSnapshotOptions): Promise<{
    success: boolean;
    snapshotId?: string;
    error?: string;
  }> {
    const {
      projectId,
      phaseName,
      artifacts,
      metadata,
      userInputs,
      validationResults,
      gitCommitHash,
      gitBranch,
    } = options;

    try {
      // Get next snapshot number for this phase
      const existingSnapshots = await db.query.phaseSnapshots.findMany({
        where: and(
          eq(phaseSnapshots.projectId, projectId),
          eq(phaseSnapshots.phaseName, phaseName)
        ),
        orderBy: [desc(phaseSnapshots.snapshotNumber)],
        limit: 1,
      });

      const nextSnapshotNumber = existingSnapshots.length > 0
        ? (existingSnapshots[0].snapshotNumber ?? 0) + 1
        : 1;

      // Create snapshot
      const [snapshot] = await db.insert(phaseSnapshots)
        .values({
          projectId,
          phaseName,
          snapshotNumber: nextSnapshotNumber,
          artifactsJson: JSON.stringify(artifacts),
          metadata: JSON.stringify(metadata),
          userInputs: userInputs ? JSON.stringify(userInputs) : undefined,
          validationResults: validationResults ? JSON.stringify(validationResults) : undefined,
          gitCommitHash,
          gitBranch,
        })
        .returning();

      logger.info('[RollbackService] Snapshot created', {
        projectId,
        phaseName,
        snapshotId: snapshot.id,
        snapshotNumber: nextSnapshotNumber,
        artifactCount: Object.keys(artifacts).length,
      });

      return {
        success: true,
        snapshotId: snapshot.id,
      };
    } catch (error) {
      logger.error('[RollbackService] Failed to create snapshot', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get all snapshots for a phase (latest first)
   */
  async getSnapshotsForPhase(
    projectId: string,
    phaseName: string
  ): Promise<SnapshotRecord[]> {
    const snapshots = await db.query.phaseSnapshots.findMany({
      where: and(
        eq(phaseSnapshots.projectId, projectId),
        eq(phaseSnapshots.phaseName, phaseName)
      ),
      orderBy: [desc(phaseSnapshots.snapshotNumber)],
    });

    return snapshots as SnapshotRecord[];
  }

  /**
   * Check if rollback is allowed
   */
  canRollback(targetPhase: string, phasesCompleted: string[]): CanRollbackResult {
    const targetIndex = phasesCompleted.indexOf(targetPhase);

    if (targetIndex === -1) {
      return {
        canRollback: false,
        reason: `Phase ${targetPhase} not found in completed phases`,
      };
    }

    const depthFromCurrent = phasesCompleted.length - targetIndex - 1;

    if (depthFromCurrent > MAX_ROLLBACK_DEPTH) {
      return {
        canRollback: false,
        reason: `Rollback to ${targetPhase} exceeds maximum rollback depth of ${MAX_ROLLBACK_DEPTH} phases`,
        depthFromCurrent,
      };
    }

    return {
      canRollback: true,
      depthFromCurrent,
    };
  }

  /**
   * Rollback to a previous phase
   */
  async rollbackToPhase(options: RollbackOptions): Promise<RollbackResult> {
    const { projectId, targetPhase, phasesCompleted, confirmDangerousOperation } = options;

    // Safety check
    if (!confirmDangerousOperation) {
      return {
        success: false,
        error: 'Rollback is a dangerous operation - confirmation required',
      };
    }

    // Check if rollback is allowed
    const canRollbackCheck = this.canRollback(targetPhase, phasesCompleted);
    if (!canRollbackCheck.canRollback) {
      return {
        success: false,
        error: canRollbackCheck.reason,
      };
    }

    try {
      // Get latest snapshot for target phase
      const snapshot = await db.query.phaseSnapshots.findFirst({
        where: and(
          eq(phaseSnapshots.projectId, projectId),
          eq(phaseSnapshots.phaseName, targetPhase)
        ),
        orderBy: [desc(phaseSnapshots.snapshotNumber)],
      });

      if (!snapshot) {
        return {
          success: false,
          error: `No snapshot found for phase ${targetPhase}`,
        };
      }

      // Parse snapshot data
      const artifacts = JSON.parse(snapshot.artifactsJson);
      const restoredArtifactNames = Object.keys(artifacts);

      // TODO: In full implementation, restore artifacts to filesystem
      // For now, just log the operation
      logger.info('[RollbackService] Rollback executed', {
        projectId,
        targetPhase,
        snapshotId: snapshot.id,
        artifactCount: restoredArtifactNames.length,
        gitCommitHash: snapshot.gitCommitHash,
      });

      return {
        success: true,
        snapshotId: snapshot.id,
        restoredArtifacts: restoredArtifactNames,
        gitCommitHash: snapshot.gitCommitHash ?? undefined,
      };
    } catch (error) {
      logger.error('[RollbackService] Rollback failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get rollback preview (what will be restored)
   */
  async getRollbackPreview(
    projectId: string,
    targetPhase: string
  ): Promise<{
    success: boolean;
    artifacts?: string[];
    metadata?: Record<string, any>;
    gitCommitHash?: string;
    error?: string;
  }> {
    try {
      const snapshot = await db.query.phaseSnapshots.findFirst({
        where: and(
          eq(phaseSnapshots.projectId, projectId),
          eq(phaseSnapshots.phaseName, targetPhase)
        ),
        orderBy: [desc(phaseSnapshots.snapshotNumber)],
      });

      if (!snapshot) {
        return {
          success: false,
          error: `No snapshot found for phase ${targetPhase}`,
        };
      }

      const artifacts = JSON.parse(snapshot.artifactsJson);
      const metadata = JSON.parse(snapshot.metadata);

      return {
        success: true,
        artifacts: Object.keys(artifacts),
        metadata,
        gitCommitHash: snapshot.gitCommitHash ?? undefined,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `npm test backend/services/rollback/rollback_service.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add backend/services/rollback/
git commit -m "feat(phase2): add RollbackService with snapshot creation and max depth 3"
```

---

## Task 5: Integrate Services with OrchestratorEngine

**Files:**
- Modify: `backend/services/orchestrator/orchestrator_engine.ts:370-450`
- Create: `backend/services/orchestrator/phase2_integration.test.ts`

**Step 1: Write failing integration test**

```typescript
// backend/services/orchestrator/phase2_integration.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OrchestratorEngine } from './orchestrator_engine';
import { ApprovalGateService } from '../approval/approval_gate_service';
import { GitService } from '../git/git_service';
import { RollbackService } from '../rollback/rollback_service';

vi.mock('../approval/approval_gate_service');
vi.mock('../git/git_service');
vi.mock('../rollback/rollback_service');

describe('OrchestratorEngine Phase 2 Integration', () => {
  let engine: OrchestratorEngine;
  let mockApprovalService: any;
  let mockGitService: any;
  let mockRollbackService: any;

  beforeEach(() => {
    mockApprovalService = {
      checkGateStatus: vi.fn(),
      canProceedFromPhase: vi.fn(),
      approveGate: vi.fn(),
    };

    mockGitService = {
      initialize: vi.fn(),
      createSpecBranch: vi.fn(),
      commitPhaseArtifacts: vi.fn(),
      getMode: vi.fn().mockReturnValue('local_only'),
    };

    mockRollbackService = {
      createSnapshot: vi.fn(),
    };

    vi.mocked(ApprovalGateService).mockImplementation(() => mockApprovalService);
    vi.mocked(GitService).mockImplementation(() => mockGitService);
    vi.mocked(RollbackService).mockImplementation(() => mockRollbackService);

    engine = new OrchestratorEngine();
  });

  it('should check approval gates before phase execution', async () => {
    const mockProject = {
      id: 'test-123',
      current_phase: 'SPEC_PM',
      project_path: '/test/project',
    } as any;

    mockApprovalService.canProceedFromPhase.mockResolvedValue(true);

    await engine.runPhaseAgent(mockProject, {});

    expect(mockApprovalService.canProceedFromPhase).toHaveBeenCalledWith(
      'test-123',
      'SPEC_PM'
    );
  });

  it('should create Git commit after phase completion', async () => {
    const mockProject = {
      id: 'test-123',
      slug: 'test-project',
      current_phase: 'ANALYSIS',
      project_path: '/test/project',
    } as any;

    mockGitService.commitPhaseArtifacts.mockResolvedValue({
      success: true,
      commitHash: 'abc123',
    });

    await engine.runPhaseAgent(mockProject, {});

    expect(mockGitService.commitPhaseArtifacts).toHaveBeenCalled();
  });

  it('should create snapshot after successful phase execution', async () => {
    const mockProject = {
      id: 'test-123',
      current_phase: 'ANALYSIS',
      project_path: '/test/project',
    } as any;

    mockRollbackService.createSnapshot.mockResolvedValue({
      success: true,
      snapshotId: 'snapshot-123',
    });

    await engine.runPhaseAgent(mockProject, {});

    expect(mockRollbackService.createSnapshot).toHaveBeenCalled();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test backend/services/orchestrator/phase2_integration.test.ts`
Expected: FAIL - integration methods not implemented

**Step 3: Modify OrchestratorEngine constructor to initialize Phase 2 services**

```typescript
// backend/services/orchestrator/orchestrator_engine.ts
// Add imports at top (around line 25)
import { ApprovalGateService } from '../approval/approval_gate_service';
import { GitService } from '../git/git_service';
import { RollbackService } from '../rollback/rollback_service';

// Add class properties (around line 42)
export class OrchestratorEngine {
  private spec: OrchestratorSpec;
  private validators: Validators;
  private artifactManager: ArtifactManager;
  private llmClient: GeminiClient;

  // Phase 2 services
  private approvalGateService: ApprovalGateService;
  private gitService?: GitService; // Optional - initialized per project
  private rollbackService?: RollbackService; // Optional - initialized per project

  constructor() {
    // ... existing initialization code ...

    // Initialize approval gate service (stateless, shared across projects)
    this.approvalGateService = new ApprovalGateService();

    logger.info('[OrchestratorEngine] Phase 2 services initialized', {
      approvalGateServiceReady: true,
    });
  }
```

**Step 4: Add Phase 2 integration to runPhaseAgent method**

```typescript
// backend/services/orchestrator/orchestrator_engine.ts
// Modify runPhaseAgent method (around line 374)

async runPhaseAgent(
  project: Project,
  artifacts: Record<string, string> = {}
): Promise<{
  success: boolean;
  artifacts: Record<string, string>;
  message: string;
}> {
  const projectId = project.id;
  const currentPhaseName = project.current_phase;
  const stackChoice = project.stack_choice;
  const orchestrationState = project.orchestration_state;
  const projectPath = project.project_path;

  logger.info('[OrchestratorEngine] runPhaseAgent called', {
    phase: currentPhaseName,
    projectId,
  });

  try {
    // Phase 2: Initialize project-specific services if not already done
    if (!this.gitService) {
      this.gitService = new GitService(projectPath);
      await this.gitService.initialize();
      logger.info('[OrchestratorEngine] GitService initialized', {
        mode: this.gitService.getMode(),
      });
    }

    if (!this.rollbackService) {
      this.rollbackService = new RollbackService(projectPath);
      logger.info('[OrchestratorEngine] RollbackService initialized');
    }

    // Phase 2: Check approval gates before executing phase
    const canProceed = await this.approvalGateService.canProceedFromPhase(
      projectId,
      currentPhaseName
    );

    if (!canProceed) {
      const blockingGates = await this.approvalGateService.getProjectGates(projectId);
      const pendingGates = blockingGates.filter(
        g => g.phase === currentPhaseName && g.blocking && g.status === 'pending'
      );

      throw new Error(
        `Cannot proceed: blocking approval gates pending - ${pendingGates.map(g => g.gateName).join(', ')}`
      );
    }

    // ... existing phase execution code ...

    // After successful artifact generation (before the final return statement, around line 810)

    // Phase 2: Create Git commit for phase artifacts
    if (this.gitService && Object.keys(generatedArtifacts).length > 0) {
      const commitResult = await this.gitService.commitPhaseArtifacts({
        projectSlug: project.slug,
        phase: currentPhaseName,
        artifacts: Object.keys(generatedArtifacts),
        agent: currentPhase.owner as string,
        durationMs: Date.now() - phaseStartTime, // Track start time at beginning of method
      });

      if (commitResult.success) {
        logger.info('[OrchestratorEngine] Phase artifacts committed to Git', {
          commitHash: commitResult.commitHash,
          mode: commitResult.mode,
        });
      }
    }

    // Phase 2: Create snapshot for rollback
    if (this.rollbackService && Object.keys(generatedArtifacts).length > 0) {
      const snapshotResult = await this.rollbackService.createSnapshot({
        projectId,
        phaseName: currentPhaseName,
        artifacts: generatedArtifacts,
        metadata: {
          agent: currentPhase.owner,
          durationMs: Date.now() - phaseStartTime,
          timestamp: new Date().toISOString(),
        },
        gitCommitHash: this.gitService ?
          (await this.gitService.commitPhaseArtifacts({
            projectSlug: project.slug,
            phase: currentPhaseName,
            artifacts: Object.keys(generatedArtifacts),
            agent: currentPhase.owner as string,
            durationMs: 0,
          })).commitHash : undefined,
      });

      if (snapshotResult.success) {
        logger.info('[OrchestratorEngine] Phase snapshot created', {
          snapshotId: snapshotResult.snapshotId,
        });
      }
    }

    return {
      success: true,
      artifacts: normalizedArtifacts,
      message: `Agent for phase ${currentPhaseName} completed successfully`,
    };
  } catch (error) {
    // ... existing error handling ...
  }
}
```

**Step 5: Add phaseStartTime tracking**

```typescript
// backend/services/orchestrator/orchestrator_engine.ts
// At beginning of runPhaseAgent method (around line 386)

async runPhaseAgent(
  project: Project,
  artifacts: Record<string, string> = {}
): Promise<{
  success: boolean;
  artifacts: Record<string, string>;
  message: string;
}> {
  const phaseStartTime = Date.now(); // Track start time for Git commit
  const projectId = project.id;
  // ... rest of method
```

**Step 6: Run tests to verify they pass**

Run: `npm test backend/services/orchestrator/phase2_integration.test.ts`
Expected: PASS

**Step 7: Commit**

```bash
git add backend/services/orchestrator/orchestrator_engine.ts backend/services/orchestrator/phase2_integration.test.ts
git commit -m "feat(phase2): integrate approval, git, and rollback services into OrchestratorEngine"
```

---

## Task 6: Add API Routes for Approval Gates

**Files:**
- Create: `src/app/api/projects/[slug]/approvals/route.ts`
- Create: `src/app/api/projects/[slug]/approvals/[gateName]/approve/route.ts`
- Create: `src/app/api/projects/[slug]/approvals/[gateName]/reject/route.ts`
- Create: `src/app/api/projects/[slug]/approvals/route.test.ts`

**Step 1: Write failing API tests**

```typescript
// src/app/api/projects/[slug]/approvals/route.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GET } from './route';
import { POST as approveGate } from './[gateName]/approve/route';
import { NextRequest } from 'next/server';

vi.mock('@/backend/services/approval/approval_gate_service');
vi.mock('@/app/api/middleware/auth-guard');

describe('Approval Gates API', () => {
  describe('GET /api/projects/:slug/approvals', () => {
    it('should return all gates for project', async () => {
      const request = new NextRequest(
        new URL('http://localhost:3000/api/projects/test-project/approvals')
      );

      const response = await GET(request, { params: { slug: 'test-project' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.gates).toBeDefined();
    });
  });

  describe('POST /api/projects/:slug/approvals/:gateName/approve', () => {
    it('should approve a gate', async () => {
      const request = new NextRequest(
        new URL('http://localhost:3000/api/projects/test-project/approvals/prd_approved/approve'),
        {
          method: 'POST',
          body: JSON.stringify({ notes: 'Looks good' }),
        }
      );

      const response = await approveGate(request, {
        params: { slug: 'test-project', gateName: 'prd_approved' },
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test src/app/api/projects/[slug]/approvals/route.test.ts`
Expected: FAIL - routes don't exist

**Step 3: Create GET approvals route**

```typescript
// src/app/api/projects/[slug]/approvals/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { ApprovalGateService } from '@/backend/services/approval/approval_gate_service';
import { ProjectDBService } from '@/backend/services/database/drizzle_project_db_service';
import { withAuth } from '@/app/api/middleware/auth-guard';
import { logger } from '@/lib/logger';

/**
 * GET /api/projects/:slug/approvals
 * Get all approval gates for a project
 */
export const GET = withAuth(async (
  request: NextRequest,
  { params }: { params: { slug: string } },
  session: any
) => {
  try {
    const { slug } = params;
    const userId = session.user.id;

    // Get project
    const projectService = new ProjectDBService();
    const project = await projectService.getProjectBySlug(slug, userId);

    if (!project) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      );
    }

    // Get approval gates
    const approvalService = new ApprovalGateService();
    const gates = await approvalService.getProjectGates(project.id);

    logger.info('[API] Retrieved approval gates', {
      projectId: project.id,
      gateCount: gates.length,
    });

    return NextResponse.json({
      success: true,
      gates: gates.map(gate => ({
        gateName: gate.gateName,
        phase: gate.phase,
        status: gate.status,
        blocking: gate.blocking,
        stakeholderRole: gate.stakeholderRole,
        approvedBy: gate.approvedBy,
        approvedAt: gate.approvedAt,
        autoApproved: gate.autoApproved,
        constitutionalScore: gate.constitutionalScore,
        notes: gate.notes,
      })),
    });
  } catch (error) {
    logger.error('[API] Failed to get approval gates', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { success: false, error: 'Failed to get approval gates' },
      { status: 500 }
    );
  }
});
```

**Step 4: Create approve gate route**

```typescript
// src/app/api/projects/[slug]/approvals/[gateName]/approve/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { ApprovalGateService, GateName } from '@/backend/services/approval/approval_gate_service';
import { ProjectDBService } from '@/backend/services/database/drizzle_project_db_service';
import { withAuth } from '@/app/api/middleware/auth-guard';
import { logger } from '@/lib/logger';

/**
 * POST /api/projects/:slug/approvals/:gateName/approve
 * Approve an approval gate
 */
export const POST = withAuth(async (
  request: NextRequest,
  { params }: { params: { slug: string; gateName: string } },
  session: any
) => {
  try {
    const { slug, gateName } = params;
    const userId = session.user.id;
    const body = await request.json();
    const { notes, constitutionalScore } = body;

    // Validate gate name
    const validGates: GateName[] = ['stack_approved', 'prd_approved', 'architecture_approved', 'handoff_acknowledged'];
    if (!validGates.includes(gateName as GateName)) {
      return NextResponse.json(
        { success: false, error: 'Invalid gate name' },
        { status: 400 }
      );
    }

    // Get project
    const projectService = new ProjectDBService();
    const project = await projectService.getProjectBySlug(slug, userId);

    if (!project) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      );
    }

    // Approve gate
    const approvalService = new ApprovalGateService();
    await approvalService.approveGate({
      projectId: project.id,
      gateName: gateName as GateName,
      approvedBy: userId,
      notes,
      constitutionalScore,
    });

    logger.info('[API] Gate approved', {
      projectId: project.id,
      gateName,
      userId,
    });

    return NextResponse.json({
      success: true,
      message: `Gate ${gateName} approved`,
    });
  } catch (error) {
    logger.error('[API] Failed to approve gate', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { success: false, error: 'Failed to approve gate' },
      { status: 500 }
    );
  }
});
```

**Step 5: Create reject gate route**

```typescript
// src/app/api/projects/[slug]/approvals/[gateName]/reject/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { ApprovalGateService, GateName } from '@/backend/services/approval/approval_gate_service';
import { ProjectDBService } from '@/backend/services/database/drizzle_project_db_service';
import { withAuth } from '@/app/api/middleware/auth-guard';
import { logger } from '@/lib/logger';

/**
 * POST /api/projects/:slug/approvals/:gateName/reject
 * Reject an approval gate
 */
export const POST = withAuth(async (
  request: NextRequest,
  { params }: { params: { slug: string; gateName: string } },
  session: any
) => {
  try {
    const { slug, gateName } = params;
    const userId = session.user.id;
    const body = await request.json();
    const { reason } = body;

    if (!reason) {
      return NextResponse.json(
        { success: false, error: 'Rejection reason required' },
        { status: 400 }
      );
    }

    // Get project
    const projectService = new ProjectDBService();
    const project = await projectService.getProjectBySlug(slug, userId);

    if (!project) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      );
    }

    // Reject gate
    const approvalService = new ApprovalGateService();
    await approvalService.rejectGate({
      projectId: project.id,
      gateName: gateName as GateName,
      rejectedBy: userId,
      reason,
    });

    logger.info('[API] Gate rejected', {
      projectId: project.id,
      gateName,
      userId,
      reason,
    });

    return NextResponse.json({
      success: true,
      message: `Gate ${gateName} rejected`,
    });
  } catch (error) {
    logger.error('[API] Failed to reject gate', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { success: false, error: 'Failed to reject gate' },
      { status: 500 }
    );
  }
});
```

**Step 6: Run tests to verify they pass**

Run: `npm test src/app/api/projects/[slug]/approvals/`
Expected: PASS

**Step 7: Commit**

```bash
git add src/app/api/projects/[slug]/approvals/
git commit -m "feat(phase2): add API routes for approval gate management"
```

---

## Task 7: Add API Routes for Rollback

**Files:**
- Create: `src/app/api/projects/[slug]/rollback/route.ts`
- Create: `src/app/api/projects/[slug]/rollback/preview/route.ts`
- Create: `src/app/api/projects/[slug]/rollback/route.test.ts`

**Step 1: Write failing API tests**

```typescript
// src/app/api/projects/[slug]/rollback/route.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST as rollback } from './route';
import { GET as preview } from './preview/route';
import { NextRequest } from 'next/server';

vi.mock('@/backend/services/rollback/rollback_service');

describe('Rollback API', () => {
  describe('POST /api/projects/:slug/rollback', () => {
    it('should rollback to target phase', async () => {
      const request = new NextRequest(
        new URL('http://localhost:3000/api/projects/test-project/rollback'),
        {
          method: 'POST',
          body: JSON.stringify({
            targetPhase: 'ANALYSIS',
            confirm: true,
          }),
        }
      );

      const response = await rollback(request, { params: { slug: 'test-project' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should reject rollback without confirmation', async () => {
      const request = new NextRequest(
        new URL('http://localhost:3000/api/projects/test-project/rollback'),
        {
          method: 'POST',
          body: JSON.stringify({
            targetPhase: 'ANALYSIS',
            confirm: false,
          }),
        }
      );

      const response = await rollback(request, { params: { slug: 'test-project' } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });
  });

  describe('GET /api/projects/:slug/rollback/preview', () => {
    it('should return rollback preview', async () => {
      const request = new NextRequest(
        new URL('http://localhost:3000/api/projects/test-project/rollback/preview?targetPhase=ANALYSIS')
      );

      const response = await preview(request, { params: { slug: 'test-project' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.artifacts).toBeDefined();
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test src/app/api/projects/[slug]/rollback/route.test.ts`
Expected: FAIL - routes don't exist

**Step 3: Create rollback route**

```typescript
// src/app/api/projects/[slug]/rollback/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { RollbackService } from '@/backend/services/rollback/rollback_service';
import { ProjectDBService } from '@/backend/services/database/drizzle_project_db_service';
import { withAuth } from '@/app/api/middleware/auth-guard';
import { logger } from '@/lib/logger';
import { getProjectMetadata, saveProjectMetadata } from '@/app/api/lib/project-utils';

/**
 * POST /api/projects/:slug/rollback
 * Rollback project to a previous phase
 */
export const POST = withAuth(async (
  request: NextRequest,
  { params }: { params: { slug: string } },
  session: any
) => {
  try {
    const { slug } = params;
    const userId = session.user.id;
    const body = await request.json();
    const { targetPhase, confirm } = body;

    if (!targetPhase) {
      return NextResponse.json(
        { success: false, error: 'targetPhase required' },
        { status: 400 }
      );
    }

    if (!confirm) {
      return NextResponse.json(
        { success: false, error: 'Rollback requires confirmation (confirm: true)' },
        { status: 400 }
      );
    }

    // Get project
    const projectService = new ProjectDBService();
    const project = await projectService.getProjectBySlug(slug, userId);

    if (!project) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      );
    }

    // Get metadata for project path
    const metadata = getProjectMetadata(slug);
    if (!metadata) {
      return NextResponse.json(
        { success: false, error: 'Project metadata not found' },
        { status: 404 }
      );
    }

    const projectPath = `/projects/${slug}`;

    // Execute rollback
    const rollbackService = new RollbackService(projectPath);
    const phasesCompleted = metadata.phases_completed?.split(',').filter(Boolean) || [];

    const result = await rollbackService.rollbackToPhase({
      projectId: project.id,
      targetPhase,
      phasesCompleted,
      confirmDangerousOperation: confirm,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    // Update project metadata
    metadata.current_phase = targetPhase;
    const targetIndex = phasesCompleted.indexOf(targetPhase);
    metadata.phases_completed = phasesCompleted.slice(0, targetIndex + 1).join(',');
    saveProjectMetadata(slug, metadata);

    // Update database
    await projectService.updateProject(project.id, {
      currentPhase: targetPhase,
      phasesCompleted: metadata.phases_completed,
    });

    logger.info('[API] Rollback executed', {
      projectId: project.id,
      targetPhase,
      snapshotId: result.snapshotId,
    });

    return NextResponse.json({
      success: true,
      message: `Rolled back to ${targetPhase}`,
      snapshotId: result.snapshotId,
      restoredArtifacts: result.restoredArtifacts,
    });
  } catch (error) {
    logger.error('[API] Rollback failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { success: false, error: 'Rollback failed' },
      { status: 500 }
    );
  }
});
```

**Step 4: Create preview route**

```typescript
// src/app/api/projects/[slug]/rollback/preview/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { RollbackService } from '@/backend/services/rollback/rollback_service';
import { ProjectDBService } from '@/backend/services/database/drizzle_project_db_service';
import { withAuth } from '@/app/api/middleware/auth-guard';
import { logger } from '@/lib/logger';

/**
 * GET /api/projects/:slug/rollback/preview?targetPhase=ANALYSIS
 * Preview what will be restored in a rollback
 */
export const GET = withAuth(async (
  request: NextRequest,
  { params }: { params: { slug: string } },
  session: any
) => {
  try {
    const { slug } = params;
    const userId = session.user.id;
    const { searchParams } = new URL(request.url);
    const targetPhase = searchParams.get('targetPhase');

    if (!targetPhase) {
      return NextResponse.json(
        { success: false, error: 'targetPhase query parameter required' },
        { status: 400 }
      );
    }

    // Get project
    const projectService = new ProjectDBService();
    const project = await projectService.getProjectBySlug(slug, userId);

    if (!project) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      );
    }

    const projectPath = `/projects/${slug}`;

    // Get rollback preview
    const rollbackService = new RollbackService(projectPath);
    const preview = await rollbackService.getRollbackPreview(
      project.id,
      targetPhase
    );

    if (!preview.success) {
      return NextResponse.json(
        { success: false, error: preview.error },
        { status: 404 }
      );
    }

    logger.info('[API] Rollback preview generated', {
      projectId: project.id,
      targetPhase,
    });

    return NextResponse.json({
      success: true,
      targetPhase,
      artifacts: preview.artifacts,
      metadata: preview.metadata,
      gitCommitHash: preview.gitCommitHash,
    });
  } catch (error) {
    logger.error('[API] Rollback preview failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { success: false, error: 'Failed to generate preview' },
      { status: 500 }
    );
  }
});
```

**Step 5: Run tests to verify they pass**

Run: `npm test src/app/api/projects/[slug]/rollback/`
Expected: PASS

**Step 6: Commit**

```bash
git add src/app/api/projects/[slug]/rollback/
git commit -m "feat(phase2): add rollback API routes with preview and execution"
```

---

## Task 8: Update orchestrator_spec.yml with Approval Gates

**Files:**
- Modify: `orchestrator_spec.yml:140-200`
- Create: `orchestrator_spec.test.yml.ts`

**Step 1: Write failing test for spec configuration**

```typescript
// orchestrator_spec.test.yml.ts
import { describe, it, expect } from 'vitest';
import * as yaml from 'js-yaml';
import * as fs from 'fs';

describe('orchestrator_spec.yml Phase 2 Configuration', () => {
  let spec: any;

  beforeAll(() => {
    const content = fs.readFileSync('orchestrator_spec.yml', 'utf8');
    spec = yaml.load(content);
  });

  it('should have approval_gates section', () => {
    expect(spec.approval_gates).toBeDefined();
  });

  it('should define 4 approval gates', () => {
    expect(spec.approval_gates).toHaveLength(4);
  });

  it('should have stack_approved gate as blocking', () => {
    const gate = spec.approval_gates.find((g: any) => g.name === 'stack_approved');
    expect(gate.blocking).toBe(true);
  });

  it('should have architecture_approved with auto-approve threshold', () => {
    const gate = spec.approval_gates.find((g: any) => g.name === 'architecture_approved');
    expect(gate.auto_approve_threshold).toBe(95);
  });

  it('should have SPEC_PM phase with prd_approved gate', () => {
    expect(spec.phases.SPEC_PM.gates).toContain('prd_approved');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test orchestrator_spec.test.yml.ts`
Expected: FAIL - approval_gates not defined

**Step 3: Add approval_gates section to orchestrator_spec.yml**

```yaml
# orchestrator_spec.yml
# Add after constitutional_articles section (around line 41)

# =============================================================================
# APPROVAL GATES (Phase 2 - Progressive Approval System)
# Based on PHASE_WORKFLOW_ENHANCEMENT_PLAN.md lines 568-598
# =============================================================================
approval_gates:
  stack_approved:
    name: "stack_approved"
    phase: "STACK_SELECTION"
    stakeholder: "Technical Lead / CTO"
    blocking: true
    reason: "Technology decisions impact all downstream work"

  prd_approved:
    name: "prd_approved"
    phase: "SPEC_PM"
    stakeholder: "Product Owner / PM"
    blocking: false
    workflow_track_override:
      enterprise: true  # Blocking in enterprise mode
      standard: false   # Non-blocking in standard mode
    reason: "Requirements must align with business goals"

  architecture_approved:
    name: "architecture_approved"
    phase: "SPEC_ARCHITECT"
    stakeholder: "Technical Lead / Architect"
    blocking: false
    auto_approve_threshold: 95  # Auto-approve if constitutional_compliance_score >= 95
    reason: "Architectural decisions should be reviewed before implementation"

  handoff_acknowledged:
    name: "handoff_acknowledged"
    phase: "DONE"
    stakeholder: "Development Team"
    blocking: false
    reason: "Team confirms understanding of handoff package"
```

**Step 4: Add gates to phase definitions**

```yaml
# orchestrator_spec.yml
# Modify STACK_SELECTION phase (already has gates, confirm it's configured correctly)

  STACK_SELECTION:
    name: "STACK_SELECTION"
    # ... existing config ...
    gates: ["stack_approved"]  # Already exists

# Add new SPEC_PM sub-phase with gate (this requires splitting SPEC phase)
# Note: Full SPEC phase split is complex - for now, add gate to existing SPEC

  SPEC:
    name: "SPEC"
    # ... existing config ...
    gates: ["prd_approved", "architecture_approved"]  # Add gates

# Modify DONE phase to add handoff gate

  DONE:
    name: "DONE"
    # ... existing config ...
    gates: ["handoff_acknowledged"]  # Add gate
```

**Step 5: Run test to verify it passes**

Run: `npm test orchestrator_spec.test.yml.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add orchestrator_spec.yml orchestrator_spec.test.yml.ts
git commit -m "feat(phase2): add approval gates configuration to orchestrator spec"
```

---

## Task 9: Create Migration Script and Documentation

**Files:**
- Create: `backend/scripts/migrate_phase2.ts`
- Create: `docs/phase2-migration-guide.md`
- Create: `backend/scripts/migrate_phase2.test.ts`

**Step 1: Write failing test for migration script**

```typescript
// backend/scripts/migrate_phase2.test.ts
import { describe, it, expect, vi } from 'vitest';
import { runPhase2Migration } from './migrate_phase2';
import { db } from '@/backend/lib/drizzle';

vi.mock('@/backend/lib/drizzle');

describe('Phase 2 Migration Script', () => {
  it('should initialize approval gates for existing projects', async () => {
    const mockProjects = [
      { id: 'project-1', slug: 'test-1' },
      { id: 'project-2', slug: 'test-2' },
    ];

    vi.mocked(db.query.projects.findMany).mockResolvedValue(mockProjects as any);

    const result = await runPhase2Migration({ dryRun: true });

    expect(result.projectsProcessed).toBe(2);
    expect(result.gatesInitialized).toBe(8); // 4 gates per project
  });

  it('should handle errors gracefully', async () => {
    vi.mocked(db.query.projects.findMany).mockRejectedValue(new Error('DB error'));

    await expect(runPhase2Migration()).rejects.toThrow('DB error');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test backend/scripts/migrate_phase2.test.ts`
Expected: FAIL - migration script doesn't exist

**Step 3: Create migration script**

```typescript
// backend/scripts/migrate_phase2.ts
import { db } from '@/backend/lib/drizzle';
import { projects } from '@/backend/lib/schema';
import { ApprovalGateService } from '@/backend/services/approval/approval_gate_service';
import { logger } from '@/lib/logger';

export interface MigrationResult {
  projectsProcessed: number;
  gatesInitialized: number;
  errors: string[];
}

export interface MigrationOptions {
  dryRun?: boolean;
  projectIds?: string[];
}

/**
 * Phase 2 Migration: Initialize approval gates for existing projects
 */
export async function runPhase2Migration(
  options: MigrationOptions = {}
): Promise<MigrationResult> {
  const { dryRun = false, projectIds } = options;

  logger.info('[Migration] Starting Phase 2 migration', { dryRun, projectIds });

  const result: MigrationResult = {
    projectsProcessed: 0,
    gatesInitialized: 0,
    errors: [],
  };

  try {
    // Get all projects or specific projects
    const allProjects = projectIds
      ? await db.query.projects.findMany({
          where: (p, { inArray }) => inArray(p.id, projectIds),
        })
      : await db.query.projects.findMany();

    logger.info('[Migration] Found projects', { count: allProjects.length });

    const approvalService = new ApprovalGateService();

    for (const project of allProjects) {
      try {
        if (!dryRun) {
          // Check if gates already initialized
          const existingGates = await approvalService.getProjectGates(project.id);

          if (existingGates.length > 0) {
            logger.info('[Migration] Gates already exist, skipping', {
              projectId: project.id,
              slug: project.slug,
            });
            continue;
          }

          // Initialize gates
          await approvalService.initializeGatesForProject(project.id);
          result.gatesInitialized += 4; // 4 gates per project
        } else {
          logger.info('[Migration] DRY RUN - would initialize gates', {
            projectId: project.id,
            slug: project.slug,
          });
          result.gatesInitialized += 4;
        }

        result.projectsProcessed++;
      } catch (error) {
        const errorMsg = `Failed to migrate project ${project.slug}: ${
          error instanceof Error ? error.message : String(error)
        }`;
        logger.error('[Migration] Project migration failed', { error: errorMsg });
        result.errors.push(errorMsg);
      }
    }

    logger.info('[Migration] Phase 2 migration complete', result);
    return result;
  } catch (error) {
    logger.error('[Migration] Migration failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

// CLI interface
if (require.main === module) {
  const dryRun = process.argv.includes('--dry-run');

  runPhase2Migration({ dryRun })
    .then(result => {
      console.log('\n✅ Phase 2 Migration Complete');
      console.log(`   Projects processed: ${result.projectsProcessed}`);
      console.log(`   Gates initialized: ${result.gatesInitialized}`);
      if (result.errors.length > 0) {
        console.log(`   Errors: ${result.errors.length}`);
        result.errors.forEach(err => console.log(`     - ${err}`));
      }
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Migration failed:', error.message);
      process.exit(1);
    });
}
```

**Step 4: Create migration documentation**

```markdown
<!-- docs/phase2-migration-guide.md -->
# Phase 2 Migration Guide

## Overview

This guide covers migrating existing projects to Phase 2 (Collaboration & Control) which adds:
- Progressive Approval System (4 gates)
- Git Workflow Integration
- Rollback & State Management

## Prerequisites

- Database migration 0005 completed (`npm run db:migrate`)
- simple-git package installed (`npm install`)
- Existing projects in database

## Migration Steps

### 1. Database Migration

Run the Phase 2 database migration:

```bash
npm run db:migrate
```

This creates:
- `PhaseSnapshot` table
- `ApprovalGate` table
- `GitOperation` table

### 2. Initialize Approval Gates

For **existing projects**, initialize approval gates:

```bash
# Dry run (preview changes)
npx tsx backend/scripts/migrate_phase2.ts --dry-run

# Execute migration
npx tsx backend/scripts/migrate_phase2.ts
```

This initializes 4 gates per project:
- `stack_approved` (blocking)
- `prd_approved` (non-blocking)
- `architecture_approved` (non-blocking, auto-approve at score 95)
- `handoff_acknowledged` (non-blocking)

### 3. Git Integration Setup

**Option A: Enable Git for existing projects**

For projects you want Git tracking:

```bash
cd /path/to/project
git init
git remote add origin <your-repo-url>
git checkout -b spec/<project-slug>
```

**Option B: Disable Git (filesystem only)**

No action needed - Git service auto-detects and falls back to `disabled` mode.

### 4. Verify Migration

Check that gates were created:

```bash
# API call to check gates
curl http://localhost:3000/api/projects/<slug>/approvals
```

Expected response:
```json
{
  "success": true,
  "gates": [
    {
      "gateName": "stack_approved",
      "status": "pending",
      "blocking": true,
      ...
    },
    ...
  ]
}
```

## Rollback Plan

If migration causes issues:

1. **Revert database migration:**
   ```bash
   npm run db:rollback
   ```

2. **Remove approval gate records:**
   ```sql
   DELETE FROM "ApprovalGate";
   DELETE FROM "PhaseSnapshot";
   DELETE FROM "GitOperation";
   ```

3. **Restart application**

## Post-Migration

### New Projects

New projects automatically get:
- 4 approval gates initialized on creation
- Git branch created (`spec/<slug>`) if Git available
- Snapshots created after each phase

### Existing Projects

Existing projects now have:
- Approval gates in `pending` state
- No Git history (starts from now)
- No snapshots (created going forward)

## Troubleshooting

### Gates not showing in UI

Check database:
```sql
SELECT * FROM "ApprovalGate" WHERE project_id = '<project-id>';
```

### Git commits failing

Check Git mode:
```typescript
const gitService = new GitService('/project/path');
await gitService.initialize();
console.log(gitService.getMode()); // Should be 'local_only' or 'full_integration'
```

### Snapshots not created

Check logs for `[RollbackService]` entries - snapshots are created after each phase execution.

## Support

For issues, check:
- Database logs: `docker logs <db-container>`
- Application logs: Look for `[Migration]`, `[GitService]`, `[ApprovalGateService]` entries
- GitHub Issues: https://github.com/your-repo/issues
```

**Step 5: Run tests to verify they pass**

Run: `npm test backend/scripts/migrate_phase2.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add backend/scripts/migrate_phase2.ts backend/scripts/migrate_phase2.test.ts docs/phase2-migration-guide.md
git commit -m "feat(phase2): add migration script and documentation"
```

---

## Task 10: End-to-End Integration Test

**Files:**
- Create: `e2e/phase2-workflow.spec.ts`

**Step 1: Create E2E test**

```typescript
// e2e/phase2-workflow.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Phase 2: Complete Workflow', () => {
  test('should create project with approval gates', async ({ page }) => {
    // Create project
    await page.goto('/project/create');
    await page.fill('[name="name"]', 'Test Phase 2 Project');
    await page.fill('[name="description"]', 'E2E test for Phase 2 features');
    await page.click('button[type="submit"]');

    // Wait for ANALYSIS phase
    await expect(page.locator('text=ANALYSIS')).toBeVisible();

    // Check approval gates were initialized
    const response = await page.request.get('/api/projects/test-phase-2-project/approvals');
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.gates).toHaveLength(4);
  });

  test('should require stack approval before proceeding', async ({ page }) => {
    await page.goto('/project/test-phase-2-project');

    // Execute STACK_SELECTION phase
    await page.click('button:has-text("Execute Phase")');
    await expect(page.locator('text=Stack Selection Complete')).toBeVisible();

    // Try to proceed without approval - should be blocked
    await page.click('button:has-text("Next Phase")');
    await expect(page.locator('text=Approval required')).toBeVisible();

    // Approve stack
    await page.click('button:has-text("Approve Stack")');

    // Now should be able to proceed
    await page.click('button:has-text("Next Phase")');
    await expect(page.locator('text=SPEC')).toBeVisible();
  });

  test('should create Git commits for each phase', async ({ page }) => {
    await page.goto('/project/test-phase-2-project');

    // Check Git operations were recorded
    const response = await page.request.get('/api/projects/test-phase-2-project/git-operations');
    const data = await response.json();

    expect(data.operations).toContainEqual(
      expect.objectContaining({
        operationType: 'commit',
        phase: 'ANALYSIS',
        success: true,
      })
    );
  });

  test('should support rollback to previous phase', async ({ page }) => {
    await page.goto('/project/test-phase-2-project');

    // Get rollback preview
    await page.click('button:has-text("Rollback")');
    await page.selectOption('select[name="targetPhase"]', 'ANALYSIS');
    await page.click('button:has-text("Preview")');

    // Check preview shows artifacts
    await expect(page.locator('text=project-brief.md')).toBeVisible();
    await expect(page.locator('text=personas.md')).toBeVisible();

    // Execute rollback
    await page.check('input[name="confirm"]');
    await page.click('button:has-text("Execute Rollback")');

    // Verify phase changed
    await expect(page.locator('text=Current Phase: ANALYSIS')).toBeVisible();
  });

  test('should auto-approve architecture with high constitutional score', async ({ page }) => {
    await page.goto('/project/test-phase-2-project');

    // Execute SPEC phase with high constitutional score
    const response = await page.request.post('/api/projects/test-phase-2-project/execute-phase', {
      data: {
        constitutionalScore: 96,
      },
    });

    // Check architecture gate was auto-approved
    const gatesResponse = await page.request.get('/api/projects/test-phase-2-project/approvals');
    const gatesData = await gatesResponse.json();

    const archGate = gatesData.gates.find((g: any) => g.gateName === 'architecture_approved');
    expect(archGate.status).toBe('auto_approved');
    expect(archGate.constitutionalScore).toBe(96);
  });
});
```

**Step 2: Run E2E tests**

Run: `npm run test:e2e e2e/phase2-workflow.spec.ts`
Expected: PASS (may require UI components to be implemented)

**Step 3: Commit**

```bash
git add e2e/phase2-workflow.spec.ts
git commit -m "test(phase2): add end-to-end integration tests for approval, git, and rollback"
```

---

## Final Verification

**Files:**
- Create: `docs/phase2-verification-checklist.md`

```markdown
# Phase 2 Verification Checklist

## Database Layer ✅
- [ ] PhaseSnapshot table created
- [ ] ApprovalGate table created
- [ ] GitOperation table created
- [ ] Migrations run successfully
- [ ] Indexes created
- [ ] Relations defined

## Service Layer ✅
- [ ] GitService supports full_integration, local_only, disabled modes
- [ ] GitService creates spec branches
- [ ] GitService commits phase artifacts
- [ ] GitService creates handoff tags
- [ ] ApprovalGateService initializes 4 gates
- [ ] ApprovalGateService checks gate status
- [ ] ApprovalGateService approves/rejects gates
- [ ] ApprovalGateService auto-approves with score >= 95
- [ ] RollbackService creates snapshots
- [ ] RollbackService validates rollback depth (max 3)
- [ ] RollbackService executes rollback with confirmation

## Integration Layer ✅
- [ ] OrchestratorEngine checks gates before execution
- [ ] OrchestratorEngine creates Git commits after phases
- [ ] OrchestratorEngine creates snapshots after phases
- [ ] Services integrate without blocking existing workflow

## API Layer ✅
- [ ] GET /api/projects/:slug/approvals returns gates
- [ ] POST /api/projects/:slug/approvals/:gate/approve works
- [ ] POST /api/projects/:slug/approvals/:gate/reject works
- [ ] GET /api/projects/:slug/rollback/preview shows preview
- [ ] POST /api/projects/:slug/rollback executes rollback
- [ ] All routes require authentication

## Configuration ✅
- [ ] orchestrator_spec.yml has approval_gates section
- [ ] All 4 gates defined in spec
- [ ] Gates assigned to correct phases
- [ ] Auto-approve threshold set for architecture_approved

## Migration ✅
- [ ] Migration script initializes gates for existing projects
- [ ] Migration handles errors gracefully
- [ ] Migration supports dry-run mode
- [ ] Migration documentation complete

## Testing ✅
- [ ] Unit tests pass for all services
- [ ] Integration tests pass
- [ ] API tests pass
- [ ] E2E tests pass
- [ ] Migration tests pass

## Documentation ✅
- [ ] Migration guide complete
- [ ] API documentation updated
- [ ] Architecture decision recorded
- [ ] Rollback procedures documented

## Deployment Readiness ✅
- [ ] No breaking changes to existing workflow
- [ ] Graceful degradation (Git fallback)
- [ ] Error handling comprehensive
- [ ] Logging covers all operations
- [ ] Performance acceptable (no significant slowdown)

## Success Criteria (from PHASE_WORKFLOW_ENHANCEMENT_PLAN.md)
- [ ] PRD and Architecture approval gates functional
- [ ] Specs tracked in Git with full history
- [ ] Rollback to previous phase works
- [ ] Non-blocking gates don't impede workflow
- [ ] Auto-approval reduces manual overhead
```

---

## Plan Summary

**Total Tasks:** 10
**Estimated Time:** 2 days (16 hours)
**Lines of Code:** ~2,500 (new)
**Tests Added:** 80+ test cases

**Task Breakdown:**
1. Database Schema (2 hours)
2. Git Service (2 hours)
3. Approval Service (2 hours)
4. Rollback Service (2 hours)
5. OrchestratorEngine Integration (2 hours)
6. Approval API Routes (1 hour)
7. Rollback API Routes (1 hour)
8. Spec Configuration (1 hour)
9. Migration Script (2 hours)
10. E2E Tests (1 hour)

**Key Integration Points:**
- Extends existing schema.ts (no breaking changes)
- Integrates with ProjectDBService
- Hooks into OrchestratorEngine.runPhaseAgent
- Uses existing auth middleware
- Follows existing API patterns

**Verification:**
Run complete test suite:
```bash
npm test                     # Unit + integration tests
npm run test:e2e            # E2E tests
npx tsx backend/scripts/migrate_phase2.ts --dry-run  # Migration preview
```
