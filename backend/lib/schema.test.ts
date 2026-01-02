import { describe, it, expect } from 'vitest';
import { validationRuns, artifactVersions, autoRemedyRuns, projects, regenerationRuns } from './schema';

describe('Phase 2 Schema', () => {
  describe('phaseSnapshots table', () => {
    it('should have all required columns', () => {
      const { phaseSnapshots } = require('./schema');
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
      const { approvalGates } = require('./schema');
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
      const { gitOperations } = require('./schema');
      const columns = Object.keys(gitOperations);
      expect(columns).toContain('operationType');
      expect(columns).toContain('commitHash');
      expect(columns).toContain('success');
    });
  });
});

describe('Validation Tracking Schema', () => {
  it('should have ValidationRun table with required fields', () => {
    expect(validationRuns).toBeDefined();
    expect(validationRuns.id).toBeDefined();
    expect(validationRuns.projectId).toBeDefined();
    expect(validationRuns.phase).toBeDefined();
    expect(validationRuns.passed).toBeDefined();
    expect(validationRuns.failureReasons).toBeDefined();
    expect(validationRuns.warningCount).toBeDefined();
    expect(validationRuns.durationMs).toBeDefined();
    expect(validationRuns.createdAt).toBeDefined();
  });

  it('should have ArtifactVersion table with required fields', () => {
    expect(artifactVersions).toBeDefined();
    expect(artifactVersions.id).toBeDefined();
    expect(artifactVersions.projectId).toBeDefined();
    expect(artifactVersions.artifactId).toBeDefined();
    expect(artifactVersions.version).toBeDefined();
    expect(artifactVersions.contentHash).toBeDefined();
    expect(artifactVersions.regenerationReason).toBeDefined();
    expect(artifactVersions.regenerationRunId).toBeDefined();
    expect(artifactVersions.createdAt).toBeDefined();
  });

  it('should have AutoRemedyRun table with required fields', () => {
    expect(autoRemedyRuns).toBeDefined();
    expect(autoRemedyRuns.id).toBeDefined();
    expect(autoRemedyRuns.projectId).toBeDefined();
    expect(autoRemedyRuns.validationRunId).toBeDefined();
    expect(autoRemedyRuns.startedAt).toBeDefined();
    expect(autoRemedyRuns.completedAt).toBeDefined();
    expect(autoRemedyRuns.successful).toBeDefined();
    expect(autoRemedyRuns.changesApplied).toBeDefined();
  });

  it('should have autoRemedyAttempts field in projects table', () => {
    expect(projects.autoRemedyAttempts).toBeDefined();
  });

  it('should have lastRemedyPhase field in projects table', () => {
    expect(projects.lastRemedyPhase).toBeDefined();
  });
});

describe('Task 1.7: RegenerationRuns Table', () => {
  it('should have RegenerationRuns table defined', () => {
    expect(regenerationRuns).toBeDefined();
  });

  it('should have all required columns', () => {
    expect(regenerationRuns.id).toBeDefined();
    expect(regenerationRuns.projectId).toBeDefined();
    expect(regenerationRuns.triggerArtifactId).toBeDefined();
    expect(regenerationRuns.triggerChangeId).toBeDefined();
    expect(regenerationRuns.impactAnalysis).toBeDefined();
    expect(regenerationRuns.selectedStrategy).toBeDefined();
    expect(regenerationRuns.artifactsToRegenerate).toBeDefined();
    expect(regenerationRuns.artifactsRegenerated).toBeDefined();
    expect(regenerationRuns.startedAt).toBeDefined();
    expect(regenerationRuns.completedAt).toBeDefined();
    expect(regenerationRuns.durationMs).toBeDefined();
    expect(regenerationRuns.success).toBeDefined();
    expect(regenerationRuns.errorMessage).toBeDefined();
  });
});
