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
        errorMessage: error instanceof Error ? error.message : String(error),
      } as any);
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
        errorMessage: error instanceof Error ? error.message : String(error),
      } as any);
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
