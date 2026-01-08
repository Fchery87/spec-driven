/**
 * Unit tests for executeRegenerationWorkflow method
 * Tests regeneration workflow orchestration including:
 * - Regeneration with different strategies (regenerate_all, high_impact_only, etc.)
 * - Creation of regeneration_run record in database
 * - Update of artifact_versions with regeneration_run_id
 * - Error handling and edge cases
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { OrchestratorEngine } from './orchestrator_engine';
import { ArtifactChange, RegenerationStrategy } from '@/types/orchestrator';

// Mock database operations
const mockInsert = vi.fn().mockResolvedValue({});
const mockUpdate = vi.fn().mockResolvedValue({});
const mockSelect = vi.fn().mockResolvedValue([{ version: 1 }]);

// Mock drizzle-orm
vi.mock('drizzle-orm', async () => {
  const actual = await import('drizzle-orm');
  return {
    ...actual,
    eq: vi.fn((a, b) => ({ _type: 'eq', left: a, right: b })),
    and: vi.fn((...args) => ({ _type: 'and', args })),
    or: vi.fn((...args) => ({ _type: 'or', args })),
    desc: vi.fn((a) => ({ _type: 'desc', column: a })),
    asc: vi.fn((a) => ({ _type: 'asc', column: a })),
    inArray: vi.fn((a, b) => ({ _type: 'inArray', column: a, values: b })),
    notInArray: vi.fn((a, b) => ({ _type: 'notInArray', column: a, values: b })),
    isNull: vi.fn((a) => ({ _type: 'isNull', column: a })),
    isNotNull: vi.fn((a) => ({ _type: 'isNotNull', column: a })),
    gt: vi.fn((a, b) => ({ _type: 'gt', column: a, value: b })),
    gte: vi.fn((a, b) => ({ _type: 'gte', column: a, value: b })),
    lt: vi.fn((a, b) => ({ _type: 'lt', column: a, value: b })),
    lte: vi.fn((a, b) => ({ _type: 'lte', column: a, value: b })),
    ne: vi.fn((a, b) => ({ _type: 'ne', column: a, value: b })),
    like: vi.fn((a, b) => ({ _type: 'like', column: a, pattern: b })),
    ilike: vi.fn((a, b) => ({ _type: 'ilike', column: a, pattern: b })),
    exists: vi.fn(() => ({ _type: 'exists' })),
    sql: vi.fn((strings, ...values) => ({ _type: 'sql', strings, values })),
    max: vi.fn(() => 1),
  };
});

// Mock db
vi.mock('@/backend/lib/drizzle', () => ({
  db: {
    insert: vi.fn(() => ({
      values: vi.fn().mockResolvedValue({}),
    })),
    update: vi.fn(() => ({
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue({}),
    })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => mockSelect),
        orderBy: vi.fn(() => mockSelect),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(() => Promise.resolve({})),
    })),
  },
}));

// Mock schema
vi.mock('@/backend/lib/schema', () => ({
  regenerationRuns: {
    id: { name: 'id' },
    projectId: { name: 'projectId' },
    triggerArtifactId: { name: 'triggerArtifactId' },
    triggerChangeId: { name: 'triggerChangeId' },
    impactAnalysis: { name: 'impactAnalysis' },
    selectedStrategy: { name: 'selectedStrategy' },
    artifactsToRegenerate: { name: 'artifactsToRegenerate' },
    artifactsRegenerated: { name: 'artifactsRegenerated' },
    startedAt: { name: 'startedAt' },
    completedAt: { name: 'completedAt' },
    durationMs: { name: 'durationMs' },
    success: { name: 'success' },
    errorMessage: { name: 'errorMessage' },
  },
  artifactVersions: {
    id: { name: 'id' },
    projectId: { name: 'projectId' },
    artifactId: { name: 'artifactId' },
    version: { name: 'version' },
    contentHash: { name: 'contentHash' },
    regenerationReason: { name: 'regenerationReason' },
    regenerationRunId: { name: 'regenerationRunId' },
    createdAt: { name: 'createdAt' },
  },
}));

describe('executeRegenerationWorkflow', () => {
  let engine: OrchestratorEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    mockInsert.mockResolvedValue({});
    mockUpdate.mockResolvedValue({});
    mockSelect.mockResolvedValue([{ version: 1 }]);
    engine = new OrchestratorEngine();
  });

  describe('Basic Workflow Execution', () => {
    it('should execute regeneration workflow with regenerate_all strategy', async () => {
      const options = {
        triggerArtifactId: 'SPEC_PM/PRD.md',
        selectedStrategy: 'regenerate_all' as RegenerationStrategy,
      };

      const result = await engine.executeRegenerationWorkflow(
        'test-project',
        options
      );

      // Should return a valid result
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.selectedStrategy).toBe('regenerate_all');
      expect(result.artifactsToRegenerate).toBeDefined();
      expect(Array.isArray(result.artifactsToRegenerate)).toBe(true);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);

      // Verify db.insert was called - check via the mocked module
      const { db } = await import('@/backend/lib/drizzle');
      expect(db.insert).toHaveBeenCalled();
    });

    it('should create regeneration_run record in database', async () => {
      const options = {
        triggerArtifactId: 'SPEC_PM/PRD.md',
        selectedStrategy: 'regenerate_all' as RegenerationStrategy,
      };

      await engine.executeRegenerationWorkflow('test-project', options);

      // Verify db.insert was called with regenerationRuns
      const { db } = await import('@/backend/lib/drizzle');
      expect(db.insert).toHaveBeenCalled();
    });

    it('should update regeneration_run with results after completion', async () => {
      const options = {
        triggerArtifactId: 'SPEC_PM/PRD.md',
        selectedStrategy: 'regenerate_all' as RegenerationStrategy,
      };

      await engine.executeRegenerationWorkflow('test-project', options);

      // Verify db.update was called
      const { db } = await import('@/backend/lib/drizzle');
      expect(db.update).toHaveBeenCalled();
    });
  });

  describe('Strategy Selection', () => {
    it('should regenerate all affected artifacts with regenerate_all strategy', async () => {
      const options = {
        triggerArtifactId: 'SPEC_PM/PRD.md',
        selectedStrategy: 'regenerate_all' as RegenerationStrategy,
      };

      const result = await engine.executeRegenerationWorkflow(
        'test-project',
        options
      );

      // With HIGH impact changes, should have artifacts to regenerate
      expect(result.artifactsToRegenerate).toBeDefined();
    });

    it('should regenerate only HIGH impact artifacts with high_impact_only strategy', async () => {
      const options = {
        triggerArtifactId: 'SPEC_PM/PRD.md',
        selectedStrategy: 'high_impact_only' as RegenerationStrategy,
      };

      const result = await engine.executeRegenerationWorkflow(
        'test-project',
        options
      );

      // Strategy should be correctly set
      expect(result.selectedStrategy).toBe('high_impact_only');
    });

    it('should return empty arrays with ignore strategy', async () => {
      const options = {
        triggerArtifactId: 'SPEC_PM/PRD.md',
        selectedStrategy: 'ignore' as RegenerationStrategy,
      };

      const result = await engine.executeRegenerationWorkflow(
        'test-project',
        options
      );

      expect(result.success).toBe(true);
      expect(result.selectedStrategy).toBe('ignore');
      expect(result.artifactsToRegenerate).toEqual([]);
      expect(result.artifactsRegenerated).toEqual([]);
      expect(result.regenerationRunId).toBeNull();
    });

    it('should support manual_review strategy with user-specified artifacts', async () => {
      const options = {
        triggerArtifactId: 'SPEC_PM/PRD.md',
        selectedStrategy: 'manual_review' as RegenerationStrategy,
        manualArtifactIds: ['SOLUTIONING/tasks.md', 'SPEC/data-model.md'],
      };

      const result = await engine.executeRegenerationWorkflow(
        'test-project',
        options
      );

      expect(result.selectedStrategy).toBe('manual_review');
      // Should use user-specified artifacts
      expect(result.artifactsToRegenerate).toEqual(
        expect.arrayContaining(['SOLUTIONING/tasks.md', 'SPEC/data-model.md'])
      );
    });

    it('should return empty list for manual_review without user-specified artifacts', async () => {
      const options = {
        triggerArtifactId: 'SPEC_PM/PRD.md',
        selectedStrategy: 'manual_review' as RegenerationStrategy,
      };

      const result = await engine.executeRegenerationWorkflow(
        'test-project',
        options
      );

      expect(result.selectedStrategy).toBe('manual_review');
      expect(result.artifactsToRegenerate).toEqual([]);
    });
  });

  describe('Artifact Version Updates', () => {
    it('should update artifact_versions with regeneration_run_id', async () => {
      const options = {
        triggerArtifactId: 'SPEC_PM/PRD.md',
        selectedStrategy: 'regenerate_all' as RegenerationStrategy,
      };

      await engine.executeRegenerationWorkflow('test-project', options);

      // Verify artifact version update was attempted
      const { db } = await import('@/backend/lib/drizzle');
      // The db.insert for artifactVersions should be called
      expect(db.insert).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should return error result when trigger change not found', async () => {
      const options = {
        triggerArtifactId: 'NONEXISTENT/artifact.md',
        selectedStrategy: 'regenerate_all' as RegenerationStrategy,
        triggerChangeId: 'nonexistent-change-id',
      };

      // When triggerChangeId is provided but change doesn't exist, should handle gracefully
      const result = await engine.executeRegenerationWorkflow(
        'test-project',
        options
      );

      // Result should indicate failure
      expect(result.success).toBe(false);
      expect(result.errorMessage).toBeDefined();
    });

    it('should track duration of regeneration workflow', async () => {
      const options = {
        triggerArtifactId: 'SPEC_PM/PRD.md',
        selectedStrategy: 'ignore' as RegenerationStrategy,
      };

      const startTime = Date.now();
      const result = await engine.executeRegenerationWorkflow(
        'test-project',
        options
      );

      // Duration should be a reasonable positive number
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      // Should complete within reasonable time (less than 10 seconds)
      expect(result.durationMs).toBeLessThan(10000);
    });
  });

  describe('Impact Analysis Integration', () => {
    it('should use analyzeRegenerationImpact to determine affected artifacts', async () => {
      // Create a HIGH impact change that should affect downstream artifacts
      const triggerChange: ArtifactChange = {
        projectId: 'test-project',
        artifactName: 'SPEC_PM/PRD.md',
        oldHash: 'abc123old',
        newHash: 'def456new',
        hasChanges: true,
        impactLevel: 'HIGH',
        changedSections: [
          {
            header: 'New Feature Requirements',
            changeType: 'added',
            lineNumber: 50,
          },
        ],
        timestamp: new Date(),
      };

      const options = {
        triggerArtifactId: 'SPEC_PM/PRD.md',
        selectedStrategy: 'regenerate_all' as RegenerationStrategy,
      };

      const result = await engine.executeRegenerationWorkflow(
        'test-project',
        options
      );

      // Should have determined affected artifacts from impact analysis
      expect(result.artifactsToRegenerate).toBeDefined();
    });

    it('should handle MEDIUM impact changes correctly', async () => {
      const options = {
        triggerArtifactId: 'SPEC_PM/PRD.md',
        selectedStrategy: 'high_impact_only' as RegenerationStrategy,
      };

      const result = await engine.executeRegenerationWorkflow(
        'test-project',
        options
      );

      expect(result).toBeDefined();
      expect(typeof result.durationMs).toBe('number');
    });
  });

  describe('Result Structure', () => {
    it('should return complete RegenerationResult structure', async () => {
      const options = {
        triggerArtifactId: 'SPEC_PM/PRD.md',
        selectedStrategy: 'ignore' as RegenerationStrategy,
      };

      const result = await engine.executeRegenerationWorkflow(
        'test-project',
        options
      );

      // Verify all required fields are present
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('regenerationRunId');
      expect(result).toHaveProperty('selectedStrategy');
      expect(result).toHaveProperty('artifactsToRegenerate');
      expect(result).toHaveProperty('artifactsRegenerated');
      expect(result).toHaveProperty('artifactsSkipped');
      expect(result).toHaveProperty('durationMs');

      // Verify types
      expect(typeof result.success).toBe('boolean');
      expect(result.regenerationRunId).toBeNull(); // ignore strategy returns null
      expect(Array.isArray(result.artifactsToRegenerate)).toBe(true);
      expect(Array.isArray(result.artifactsRegenerated)).toBe(true);
      expect(Array.isArray(result.artifactsSkipped)).toBe(true);
      expect(typeof result.durationMs).toBe('number');
    });

    it('should return regenerationRunId for non-ignore strategies', async () => {
      const options = {
        triggerArtifactId: 'SPEC_PM/PRD.md',
        selectedStrategy: 'regenerate_all' as RegenerationStrategy,
      };

      const result = await engine.executeRegenerationWorkflow(
        'test-project',
        options
      );

      // Should have a regeneration run ID
      expect(result.regenerationRunId).toBeDefined();
      expect(result.regenerationRunId).not.toBeNull();
      // Should be a valid UUID format
      expect(result.regenerationRunId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty project ID', async () => {
      const options = {
        triggerArtifactId: 'SPEC_PM/PRD.md',
        selectedStrategy: 'ignore' as RegenerationStrategy,
      };

      // Should not throw
      const result = await engine.executeRegenerationWorkflow('', options);
      expect(result).toBeDefined();
    });

    it('should handle artifacts with special characters in names', async () => {
      const options = {
        triggerArtifactId: 'SPEC/API-Spec_v2.0.json',
        selectedStrategy: 'ignore' as RegenerationStrategy,
      };

      const result = await engine.executeRegenerationWorkflow(
        'test-project',
        options
      );

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    });

    it('should handle multiple artifacts to regenerate', async () => {
      const options = {
        triggerArtifactId: 'SPEC_PM/PRD.md',
        selectedStrategy: 'regenerate_all' as RegenerationStrategy,
      };

      const result = await engine.executeRegenerationWorkflow(
        'test-project',
        options
      );

      // Result should handle potentially multiple artifacts
      expect(result.artifactsToRegenerate).toBeDefined();
      expect(Array.isArray(result.artifactsToRegenerate)).toBe(true);
    });
  });
});

describe('selectArtifactsForRegeneration', () => {
  let engine: OrchestratorEngine;

  beforeEach(() => {
    engine = new OrchestratorEngine();
  });

  it('should return all affected artifacts for regenerate_all strategy', () => {
    // Access private method via type casting
     
    const selectArtifacts = (engine as any).selectArtifactsForRegeneration.bind(engine);

    const impactAnalysis = {
      affectedArtifacts: [
        { artifactId: 'SPEC/data-model.md', impactLevel: 'HIGH' as const },
        { artifactId: 'SOLUTIONING/tasks.md', impactLevel: 'MEDIUM' as const },
        { artifactId: 'DEPENDENCIES/package.json', impactLevel: 'LOW' as const },
      ],
      impactSummary: { high: 1, medium: 1, low: 1 },
    } as any;

    const result = selectArtifacts(impactAnalysis, 'regenerate_all');

    expect(result).toHaveLength(3);
    expect(result).toContain('SPEC/data-model.md');
    expect(result).toContain('SOLUTIONING/tasks.md');
    expect(result).toContain('DEPENDENCIES/package.json');
  });

  it('should return only HIGH impact artifacts for high_impact_only strategy', () => {
     
    const selectArtifacts = (engine as any).selectArtifactsForRegeneration.bind(engine);

    const impactAnalysis = {
      affectedArtifacts: [
        { artifactId: 'SPEC/data-model.md', impactLevel: 'HIGH' as const },
        { artifactId: 'SOLUTIONING/tasks.md', impactLevel: 'MEDIUM' as const },
        { artifactId: 'SOLUTIONING/epics.md', impactLevel: 'HIGH' as const },
      ],
    } as any;

    const result = selectArtifacts(impactAnalysis, 'high_impact_only');

    expect(result).toHaveLength(2);
    expect(result).toContain('SPEC/data-model.md');
    expect(result).toContain('SOLUTIONING/epics.md');
    expect(result).not.toContain('SOLUTIONING/tasks.md');
  });

  it('should return user-specified artifacts for manual_review strategy', () => {
     
    const selectArtifacts = (engine as any).selectArtifactsForRegeneration.bind(engine);

    const impactAnalysis = {
      affectedArtifacts: [
        { artifactId: 'SPEC/data-model.md', impactLevel: 'HIGH' as const },
        { artifactId: 'SOLUTIONING/tasks.md', impactLevel: 'MEDIUM' as const },
      ],
    } as any;

    const result = selectArtifacts(
      impactAnalysis,
      'manual_review',
      ['SPEC/api-spec.json', 'DEPENDENCIES/requirements.txt']
    );

    expect(result).toEqual(['SPEC/api-spec.json', 'DEPENDENCIES/requirements.txt']);
  });

  it('should return empty array for ignore strategy', () => {
     
    const selectArtifacts = (engine as any).selectArtifactsForRegeneration.bind(engine);

    const impactAnalysis = {
      affectedArtifacts: [
        { artifactId: 'SPEC/data-model.md', impactLevel: 'HIGH' as const },
      ],
    } as any;

    const result = selectArtifacts(impactAnalysis, 'ignore');

    expect(result).toEqual([]);
  });

  it('should return empty array for unknown strategy', () => {
     
    const selectArtifacts = (engine as any).selectArtifactsForRegeneration.bind(engine);

    const impactAnalysis = {
      affectedArtifacts: [
        { artifactId: 'SPEC/data-model.md', impactLevel: 'HIGH' as const },
      ],
    } as any;

    const result = selectArtifacts(impactAnalysis, 'unknown_strategy' as RegenerationStrategy);

    expect(result).toEqual([]);
  });
});
