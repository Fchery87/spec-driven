import { describe, it, expect } from 'vitest';
import {
  getAffectedArtifacts,
  getArtifactDependencies,
  getTransitiveAffectedArtifacts,
  ARTIFACT_DEPENDENCIES,
} from './artifact_dependencies';

describe('Artifact Dependencies', () => {
  describe('ARTIFACT_DEPENDENCIES constant', () => {
    it('should define dependencies for constitution.md', () => {
      expect(ARTIFACT_DEPENDENCIES['constitution.md']).toBeDefined();
      expect(ARTIFACT_DEPENDENCIES['constitution.md'].affects).toContain('stack-decision.md');
      expect(ARTIFACT_DEPENDENCIES['constitution.md'].affects).toContain('PRD.md');
    });

    it('should define dependencies for PRD.md', () => {
      expect(ARTIFACT_DEPENDENCIES['PRD.md']).toBeDefined();
      expect(ARTIFACT_DEPENDENCIES['PRD.md'].affects).toContain('data-model.md');
      expect(ARTIFACT_DEPENDENCIES['PRD.md'].affects).toContain('api-spec.json');
    });

    it('should define dependencies for stack.json', () => {
      expect(ARTIFACT_DEPENDENCIES['stack.json']).toBeDefined();
      expect(ARTIFACT_DEPENDENCIES['stack.json'].affects).toContain('component-inventory.md');
      expect(ARTIFACT_DEPENDENCIES['stack.json'].affects).toContain('dependencies.json');
    });
  });

  describe('getAffectedArtifacts', () => {
    it('should return direct affected artifacts for a given artifact', () => {
      const affected = getAffectedArtifacts('PRD.md');
      expect(affected).toContain('data-model.md');
      expect(affected).toContain('api-spec.json');
      expect(affected).toContain('epics.md');
      expect(affected).toContain('tasks.md');
      expect(affected).toContain('architecture.md');
    });

    it('should return empty array for artifact with no dependents', () => {
      const affected = getAffectedArtifacts('validation-report.md');
      expect(affected).toEqual([]);
    });

    it('should return empty array for unknown artifact', () => {
      const affected = getAffectedArtifacts('unknown.md');
      expect(affected).toEqual([]);
    });
  });

  describe('getArtifactDependencies', () => {
    it('should return dependencies of an artifact', () => {
      const deps = getArtifactDependencies('data-model.md');
      expect(deps).toContain('PRD.md');
    });

    it('should return empty array for root artifacts', () => {
      const deps = getArtifactDependencies('constitution.md');
      expect(deps).toEqual([]);
    });
  });

  describe('getTransitiveAffectedArtifacts', () => {
    it('should return all transitively affected artifacts', () => {
      const affected = getTransitiveAffectedArtifacts('constitution.md');
      // constitution affects PRD, PRD affects data-model, etc.
      expect(affected).toContain('PRD.md');
      expect(affected).toContain('data-model.md');
      expect(affected).toContain('api-spec.json');
    });

    it('should handle circular dependencies gracefully', () => {
      // Even if there were cycles (there shouldn't be), should not infinite loop
      const affected = getTransitiveAffectedArtifacts('constitution.md');
      expect(affected.length).toBeGreaterThan(0);
    });

    it('should return empty array for leaf artifacts', () => {
      const affected = getTransitiveAffectedArtifacts('validation-report.md');
      expect(affected).toEqual([]);
    });
  });

  describe('Spec Compliance Validation', () => {
    it('should match spec for stack.json dependencies', () => {
      const affected = getAffectedArtifacts('stack.json');
      expect(affected).toContain('component-inventory.md');
      expect(affected).toContain('dependencies.json');
      expect(affected).toContain('DEPENDENCIES.md');
    });

    it('should match spec for stack-decision.md dependencies', () => {
      const affected = getAffectedArtifacts('stack-decision.md');
      expect(affected).toContain('architecture.md');
      expect(affected).toContain('DEPENDENCIES.md');
      expect(affected).toContain('tasks.md');
      expect(affected).toContain('data-model.md');
      expect(affected).toHaveLength(4);
    });

    it('should match spec for design-tokens.md dependencies', () => {
      const affected = getAffectedArtifacts('design-tokens.md');
      expect(affected).toContain('component-inventory.md');
      expect(affected).toContain('journey-maps.md');
      expect(affected).not.toContain('user-flows.md');
    });

    it('should match spec for user-flows.md dependencies', () => {
      const affected = getAffectedArtifacts('user-flows.md');
      expect(affected).toContain('journey-maps.md');
      expect(affected).toHaveLength(1);
    });

    it('should have journey-maps.md as leaf node', () => {
      const affected = getAffectedArtifacts('journey-maps.md');
      expect(affected).toEqual([]);
    });

    it('should have DEPENDENCIES.md as leaf node', () => {
      const affected = getAffectedArtifacts('DEPENDENCIES.md');
      expect(affected).toEqual([]);
    });
  });
});
