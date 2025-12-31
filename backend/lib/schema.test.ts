import { describe, it, expect } from 'vitest';
import { validationRuns, artifactVersions, autoRemedyRuns, projects } from './schema';

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
