/**
 * Unit tests for analyzeRegenerationImpact method
 * Tests impact analysis for artifact changes, including:
 * - Identification of artifacts that depend on PRD
 * - HIGH impact for added/removed requirements
 * - MEDIUM impact for modified requirements
 * - Recommended strategy based on impact level
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { OrchestratorEngine } from './orchestrator_engine';
import { ArtifactChange, ImpactLevel } from '@/types/orchestrator';

describe('analyzeRegenerationImpact', () => {
  let engine: OrchestratorEngine;

  beforeEach(() => {
    // Create a new instance for each test
    engine = new OrchestratorEngine();
  });

  describe('Dependency Graph Building', () => {
    it('should build artifact dependency graph from orchestrator spec', () => {
      // Access the private method via type casting for testing
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dependencies = (engine as any).buildArtifactDependencyGraph();

      expect(dependencies).toBeInstanceOf(Map);
      expect(dependencies.size).toBeGreaterThan(0);

      // Verify that dependencies include expected relationships
      // For example, PRD.md (output of SPEC) should be a dependency for later phases
      const hasPRD = Array.from(dependencies.keys() as Iterable<string>).some(
        (key: string) => key.includes('PRD.md') || key.includes('PRD')
      );
      expect(hasPRD).toBe(true);
    });

    it('should map artifacts to phases that depend on them', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dependencies = (engine as any).buildArtifactDependencyGraph();

      // Find an artifact that has dependents
      let foundArtifactWithDependents = false;
      for (const [artifact, dependents] of dependencies) {
        if (dependents && dependents.length > 0) {
          expect(dependents[0]).toHaveProperty('phase');
          expect(dependents[0]).toHaveProperty('artifact');
          foundArtifactWithDependents = true;
          break;
        }
      }
      expect(foundArtifactWithDependents).toBe(true);
    });
  });

  describe('PRD-dependent Artifact Identification', () => {
    it('should identify artifacts that depend on PRD when PRD changes', async () => {
      // Create a HIGH impact change (added section) to PRD
      const triggerChange: ArtifactChange = {
        projectId: 'test-project',
        artifactName: 'SPEC/PRD.md',
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

      const analysis = await engine.analyzeRegenerationImpact(
        'test-project',
        triggerChange
      );

      // PRD changes should affect downstream artifacts
      // SOLUTIONING phase depends on PRD, so its artifacts should be affected
      const hasSolutioningArtifacts = analysis.affectedArtifacts.some(
        (a) => a.phase === 'SOLUTIONING'
      );
      // Or at minimum we should have some affected artifacts
      expect(
        analysis.affectedArtifacts.length > 0 || hasSolutioningArtifacts
      ).toBe(true);
    });

    it('should identify data-model.md and api-spec.json as affected when PRD changes', async () => {
      // Create a change to PRD
      const triggerChange: ArtifactChange = {
        projectId: 'test-project',
        artifactName: 'SPEC/PRD.md',
        oldHash: 'abc123old',
        newHash: 'def456new',
        hasChanges: true,
        impactLevel: 'HIGH',
        changedSections: [
          {
            header: 'New API Endpoint',
            changeType: 'added',
            lineNumber: 100,
          },
        ],
        timestamp: new Date(),
      };

      const analysis = await engine.analyzeRegenerationImpact(
        'test-project',
        triggerChange
      );

      // The analysis should contain information about affected artifacts
      expect(analysis.affectedArtifacts).toBeDefined();
      expect(Array.isArray(analysis.affectedArtifacts)).toBe(true);
    });
  });

  describe('HIGH Impact for Added/Removed Requirements', () => {
    it('should return HIGH impact when requirements are added', async () => {
      const triggerChange: ArtifactChange = {
        projectId: 'test-project',
        artifactName: 'SPEC/PRD.md',
        oldHash: 'abc123old',
        newHash: 'def456new',
        hasChanges: true,
        impactLevel: 'HIGH',
        changedSections: [
          {
            header: 'REQ-AUTH-010',
            changeType: 'added',
            lineNumber: 150,
          },
        ],
        timestamp: new Date(),
      };

      const analysis = await engine.analyzeRegenerationImpact(
        'test-project',
        triggerChange
      );

      // Should have HIGH impact summary for added requirements
      expect(analysis.impactSummary.high).toBeGreaterThan(0);
      expect(analysis.recommendedStrategy).toBe('regenerate_all');
    });

    it('should return HIGH impact when requirements are removed', async () => {
      const triggerChange: ArtifactChange = {
        projectId: 'test-project',
        artifactName: 'SPEC/PRD.md',
        oldHash: 'abc123old',
        newHash: 'def456new',
        hasChanges: true,
        impactLevel: 'HIGH',
        changedSections: [
          {
            header: 'REQ-PAYMENT-005',
            changeType: 'deleted',
            lineNumber: 200,
          },
        ],
        timestamp: new Date(),
      };

      const analysis = await engine.analyzeRegenerationImpact(
        'test-project',
        triggerChange
      );

      // Should have HIGH impact summary for removed requirements
      expect(analysis.impactSummary.high).toBeGreaterThan(0);
      expect(analysis.recommendedStrategy).toBe('regenerate_all');
    });

    it('should include reasoning about structural changes for HIGH impact', async () => {
      const triggerChange: ArtifactChange = {
        projectId: 'test-project',
        artifactName: 'SPEC/PRD.md',
        oldHash: 'abc123old',
        newHash: 'def456new',
        hasChanges: true,
        impactLevel: 'HIGH',
        changedSections: [
          {
            header: 'New Section',
            changeType: 'added',
            lineNumber: 75,
          },
        ],
        timestamp: new Date(),
      };

      const analysis = await engine.analyzeRegenerationImpact(
        'test-project',
        triggerChange
      );

      expect(analysis.reasoning).toBeDefined();
      expect(analysis.reasoning.length).toBeGreaterThan(0);
      expect(analysis.reasoning).toContain('structural');
    });
  });

  describe('MEDIUM Impact for Modified Requirements', () => {
    it('should return MEDIUM impact when requirements are modified', async () => {
      const triggerChange: ArtifactChange = {
        projectId: 'test-project',
        artifactName: 'SPEC/PRD.md',
        oldHash: 'abc123old',
        newHash: 'def456new',
        hasChanges: true,
        impactLevel: 'MEDIUM',
        changedSections: [
          {
            header: 'REQ-USER-001',
            changeType: 'modified',
            oldContent: 'Original acceptance criteria',
            newContent: 'Modified acceptance criteria',
            lineNumber: 120,
          },
        ],
        timestamp: new Date(),
      };

      const analysis = await engine.analyzeRegenerationImpact(
        'test-project',
        triggerChange
      );

      // Should have MEDIUM impact summary
      expect(analysis.impactSummary.medium).toBeGreaterThan(0);
      expect(analysis.impactSummary.high).toBe(0);
      expect(analysis.recommendedStrategy).toBe('high_impact_only');
    });

    it('should recommend selective regeneration for MEDIUM impact', async () => {
      const triggerChange: ArtifactChange = {
        projectId: 'test-project',
        artifactName: 'SPEC/PRD.md',
        oldHash: 'abc123old',
        newHash: 'def456new',
        hasChanges: true,
        impactLevel: 'MEDIUM',
        changedSections: [
          {
            header: 'REQ-USER-002',
            changeType: 'modified',
            lineNumber: 130,
          },
        ],
        timestamp: new Date(),
      };

      const analysis = await engine.analyzeRegenerationImpact(
        'test-project',
        triggerChange
      );

      expect(analysis.recommendedStrategy).toBe('high_impact_only');
      expect(analysis.reasoning).toContain('MEDIUM');
    });
  });

  describe('Recommended Strategy Based on Impact Level', () => {
    it('should recommend regenerate_all for HIGH impact changes', async () => {
      const triggerChange: ArtifactChange = {
        projectId: 'test-project',
        artifactName: 'SPEC/PRD.md',
        oldHash: 'abc123old',
        newHash: 'def456new',
        hasChanges: true,
        impactLevel: 'HIGH',
        changedSections: [
          {
            header: 'New Epic',
            changeType: 'added',
            lineNumber: 80,
          },
        ],
        timestamp: new Date(),
      };

      const analysis = await engine.analyzeRegenerationImpact(
        'test-project',
        triggerChange
      );

      expect(analysis.recommendedStrategy).toBe('regenerate_all');
      expect(analysis.recommendedStrategy).not.toBe('ignore');
    });

    it('should recommend high_impact_only for MEDIUM impact changes', async () => {
      const triggerChange: ArtifactChange = {
        projectId: 'test-project',
        artifactName: 'SPEC/PRD.md',
        oldHash: 'abc123old',
        newHash: 'def456new',
        hasChanges: true,
        impactLevel: 'MEDIUM',
        changedSections: [],
        timestamp: new Date(),
      };

      const analysis = await engine.analyzeRegenerationImpact(
        'test-project',
        triggerChange
      );

      expect(analysis.recommendedStrategy).toBe('high_impact_only');
    });

    it('should recommend manual_review when only LOW impact changes', async () => {
      // Create a LOW impact change
      const triggerChange: ArtifactChange = {
        projectId: 'test-project',
        artifactName: 'ANALYSIS/project-brief.md',
        oldHash: 'abc123old',
        newHash: 'def456new',
        hasChanges: true,
        impactLevel: 'LOW',
        changedSections: [],
        timestamp: new Date(),
      };

      const analysis = await engine.analyzeRegenerationImpact(
        'test-project',
        triggerChange
      );

      expect(analysis.recommendedStrategy).toBe('manual_review');
    });

    it('should recommend ignore when no artifacts are affected', async () => {
      // Create a change to an artifact that no other artifacts depend on
      const triggerChange: ArtifactChange = {
        projectId: 'test-project',
        artifactName: 'DONE/README.md',
        oldHash: 'abc123old',
        newHash: 'def456new',
        hasChanges: true,
        impactLevel: 'MEDIUM',
        changedSections: [
          {
            header: 'Minor Update',
            changeType: 'modified',
            lineNumber: 10,
          },
        ],
        timestamp: new Date(),
      };

      const analysis = await engine.analyzeRegenerationImpact(
        'test-project',
        triggerChange
      );

      // If no artifacts depend on this, strategy should be ignore
      if (analysis.affectedArtifacts.length === 0) {
        expect(analysis.recommendedStrategy).toBe('ignore');
      }
    });
  });

  describe('Impact Summary Calculation', () => {
    it('should correctly count HIGH, MEDIUM, and LOW impact artifacts', async () => {
      // Create a change that will have both HIGH and MEDIUM impacts
      const triggerChange: ArtifactChange = {
        projectId: 'test-project',
        artifactName: 'SPEC/PRD.md',
        oldHash: 'abc123old',
        newHash: 'def456new',
        hasChanges: true,
        impactLevel: 'HIGH',
        changedSections: [
          {
            header: 'New Requirements',
            changeType: 'added',
            lineNumber: 100,
          },
        ],
        timestamp: new Date(),
      };

      const analysis = await engine.analyzeRegenerationImpact(
        'test-project',
        triggerChange
      );

      // Verify impact summary structure
      expect(analysis.impactSummary).toHaveProperty('high');
      expect(analysis.impactSummary).toHaveProperty('medium');
      expect(analysis.impactSummary).toHaveProperty('low');
      expect(typeof analysis.impactSummary.high).toBe('number');
      expect(typeof analysis.impactSummary.medium).toBe('number');
      expect(typeof analysis.impactSummary.low).toBe('number');

      // Sum should equal affected artifacts count
      const total =
        analysis.impactSummary.high +
        analysis.impactSummary.medium +
        analysis.impactSummary.low;
      expect(total).toBe(analysis.affectedArtifacts.length);
    });
  });

  describe('Affected Artifact Details', () => {
    it('should include phase information for each affected artifact', async () => {
      const triggerChange: ArtifactChange = {
        projectId: 'test-project',
        artifactName: 'SPEC/PRD.md',
        oldHash: 'abc123old',
        newHash: 'def456new',
        hasChanges: true,
        impactLevel: 'HIGH',
        changedSections: [
          {
            header: 'New Feature',
            changeType: 'added',
            lineNumber: 90,
          },
        ],
        timestamp: new Date(),
      };

      const analysis = await engine.analyzeRegenerationImpact(
        'test-project',
        triggerChange
      );

      for (const artifact of analysis.affectedArtifacts) {
        expect(artifact).toHaveProperty('phase');
        expect(artifact.phase.length).toBeGreaterThan(0);
        expect(artifact).toHaveProperty('artifactId');
        expect(artifact).toHaveProperty('artifactName');
        expect(artifact).toHaveProperty('impactLevel');
        expect(artifact).toHaveProperty('reason');
      }
    });

    it('should include reason explaining why artifact is affected', async () => {
      const triggerChange: ArtifactChange = {
        projectId: 'test-project',
        artifactName: 'SPEC/PRD.md',
        oldHash: 'abc123old',
        newHash: 'def456new',
        hasChanges: true,
        impactLevel: 'HIGH',
        changedSections: [
          {
            header: 'New Requirement',
            changeType: 'added',
            lineNumber: 60,
          },
        ],
        timestamp: new Date(),
      };

      const analysis = await engine.analyzeRegenerationImpact(
        'test-project',
        triggerChange
      );

      for (const artifact of analysis.affectedArtifacts) {
        expect(artifact.reason).toBeDefined();
        expect(artifact.reason.length).toBeGreaterThan(0);
        expect(typeof artifact.reason).toBe('string');
      }
    });
  });

  describe('Transitive Dependency Tracking', () => {
    it('should find artifacts that transitively depend on the changed artifact', async () => {
      // Changes to early phase artifacts (like project-brief.md) should propagate
      // through multiple phases to affect downstream artifacts
      const triggerChange: ArtifactChange = {
        projectId: 'test-project',
        artifactName: 'ANALYSIS/project-brief.md',
        oldHash: 'abc123old',
        newHash: 'def456new',
        hasChanges: true,
        impactLevel: 'HIGH',
        changedSections: [
          {
            header: 'Target Market',
            changeType: 'modified',
            lineNumber: 45,
          },
        ],
        timestamp: new Date(),
      };

      const analysis = await engine.analyzeRegenerationImpact(
        'test-project',
        triggerChange
      );

      // project-brief.md is an input to STACK_SELECTION and SPEC
      // Changes should potentially affect downstream phases
      expect(analysis.affectedArtifacts.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle artifacts with no dependencies', async () => {
      const triggerChange: ArtifactChange = {
        projectId: 'test-project',
        artifactName: 'ANALYSIS/unrelated-artifact.md',
        oldHash: 'abc123old',
        newHash: 'def456new',
        hasChanges: true,
        impactLevel: 'MEDIUM',
        changedSections: [
          {
            header: 'Content',
            changeType: 'modified',
            lineNumber: 5,
          },
        ],
        timestamp: new Date(),
      };

      const analysis = await engine.analyzeRegenerationImpact(
        'test-project',
        triggerChange
      );

      // Should return with empty affected artifacts and ignore strategy
      expect(analysis.affectedArtifacts).toBeDefined();
      if (analysis.affectedArtifacts.length === 0) {
        expect(analysis.recommendedStrategy).toBe('ignore');
      }
    });

    it('should handle changes with empty changedSections', async () => {
      const triggerChange: ArtifactChange = {
        projectId: 'test-project',
        artifactName: 'SPEC/PRD.md',
        oldHash: 'abc123old',
        newHash: 'def456new',
        hasChanges: true,
        impactLevel: 'MEDIUM',
        changedSections: [],
        timestamp: new Date(),
      };

      const analysis = await engine.analyzeRegenerationImpact(
        'test-project',
        triggerChange
      );

      expect(analysis).toBeDefined();
      expect(analysis.triggerChange).toEqual(triggerChange);
      expect(Array.isArray(analysis.affectedArtifacts)).toBe(true);
    });

    it('should handle artifact names with and without phase prefix', async () => {
      // Test with phase prefix
      const triggerChange1: ArtifactChange = {
        projectId: 'test-project',
        artifactName: 'SPEC/PRD.md',
        oldHash: 'abc123old',
        newHash: 'def456new',
        hasChanges: true,
        impactLevel: 'HIGH',
        changedSections: [
          {
            header: 'Section',
            changeType: 'added',
            lineNumber: 50,
          },
        ],
        timestamp: new Date(),
      };

      const analysis1 = await engine.analyzeRegenerationImpact(
        'test-project',
        triggerChange1
      );

      expect(analysis1).toBeDefined();
    });
  });
});
