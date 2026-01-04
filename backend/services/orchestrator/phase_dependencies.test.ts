import { describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

interface PhaseDefinition {
  name: string;
  description: string;
  owner: string | string[];
  duration_minutes: number;
  inputs: string[];
  outputs: string[];
  depends_on?: string[];
  gates?: string[];
  next_phase: string;
  validators: string[];
  allow_regeneration?: boolean;
  max_regeneration_attempts?: number;
  quality_checklist?: string[];
}

interface OrchestratorSpec {
  phases: Record<string, PhaseDefinition>;
}

describe('Phase Dependencies', () => {
  let spec: OrchestratorSpec;

  beforeEach(() => {
    const specPath = path.join(process.cwd(), 'orchestrator_spec.yml');
    const specContent = fs.readFileSync(specPath, 'utf-8');
    spec = yaml.load(specContent) as OrchestratorSpec;
  });

  describe('SPEC_PM dependencies', () => {
    it('should depend on ANALYSIS and STACK_SELECTION', () => {
      const specPm = spec.phases['SPEC_PM'];
      expect(specPm).toBeDefined();
      expect(specPm.depends_on).toContain('ANALYSIS');
      expect(specPm.depends_on).toContain('STACK_SELECTION');
    });

    it('should output PRD.md', () => {
      const specPm = spec.phases['SPEC_PM'];
      expect(specPm.outputs).toContain('PRD.md');
    });

    it('should have pm as owner', () => {
      const specPm = spec.phases['SPEC_PM'];
      expect(specPm.owner).toBe('pm');
    });
  });

  describe('SPEC_ARCHITECT dependencies', () => {
    it('should depend on SPEC_PM', () => {
      const specArchitect = spec.phases['SPEC_ARCHITECT'];
      expect(specArchitect).toBeDefined();
      expect(specArchitect.depends_on).toContain('SPEC_PM');
    });

    it('should depend on STACK_SELECTION', () => {
      const specArchitect = spec.phases['SPEC_ARCHITECT'];
      expect(specArchitect.depends_on).toContain('STACK_SELECTION');
    });

    it('should output data-model.md and api-spec.json', () => {
      const specArchitect = spec.phases['SPEC_ARCHITECT'];
      expect(specArchitect.outputs).toContain('data-model.md');
      expect(specArchitect.outputs).toContain('api-spec.json');
    });

    it('should have architect as owner', () => {
      const specArchitect = spec.phases['SPEC_ARCHITECT'];
      expect(specArchitect.owner).toBe('architect');
    });
  });

  describe('SPEC_DESIGN_COMPONENTS dependencies', () => {
    it('should depend on SPEC_DESIGN_TOKENS', () => {
      const specDesignComponents = spec.phases['SPEC_DESIGN_COMPONENTS'];
      expect(specDesignComponents).toBeDefined();
      expect(specDesignComponents.depends_on).toContain('SPEC_DESIGN_TOKENS');
    });

    it('should depend on STACK_SELECTION', () => {
      const specDesignComponents = spec.phases['SPEC_DESIGN_COMPONENTS'];
      expect(specDesignComponents.depends_on).toContain('STACK_SELECTION');
    });
  });

  describe('DEPENDENCIES phase dependencies', () => {
    it('should depend on SPEC_DESIGN_COMPONENTS', () => {
      const dependencies = spec.phases['DEPENDENCIES'];
      expect(dependencies).toBeDefined();
      expect(dependencies.depends_on).toContain('SPEC_DESIGN_COMPONENTS');
    });

    it('should depend on SPEC_ARCHITECT (not SPEC)', () => {
      const dependencies = spec.phases['DEPENDENCIES'];
      expect(dependencies.depends_on).toContain('SPEC_ARCHITECT');
      expect(dependencies.depends_on).not.toContain('SPEC');
    });
  });

  describe('SOLUTIONING phase dependencies', () => {
    it('should depend on SPEC_ARCHITECT (not SPEC)', () => {
      const solutioning = spec.phases['SOLUTIONING'];
      expect(solutioning).toBeDefined();
      expect(solutioning.depends_on).toContain('SPEC_ARCHITECT');
      expect(solutioning.depends_on).not.toContain('SPEC');
    });

    it('should depend on DEPENDENCIES', () => {
      const solutioning = spec.phases['SOLUTIONING'];
      expect(solutioning.depends_on).toContain('DEPENDENCIES');
    });
  });

  describe('Parallel execution groups', () => {
    it('STACK_SELECTION and SPEC_DESIGN_TOKENS can run in parallel after ANALYSIS', () => {
      const stackSelection = spec.phases['STACK_SELECTION'];
      const specDesignTokens = spec.phases['SPEC_DESIGN_TOKENS'];

      // Both should depend only on ANALYSIS
      expect(stackSelection.depends_on).toEqual(['ANALYSIS']);
      expect(specDesignTokens.depends_on).toEqual(['ANALYSIS']);
    });

    it('SPEC_ARCHITECT depends on both STACK_SELECTION and SPEC_PM', () => {
      const specArchitect = spec.phases['SPEC_ARCHITECT'];
      
      // SPEC_ARCHITECT needs both to complete first
      expect(specArchitect.depends_on).toContain('STACK_SELECTION');
      expect(specArchitect.depends_on).toContain('SPEC_PM');
    });

    it('SPEC_PM and SPEC_DESIGN_TOKENS can run in parallel after STACK_SELECTION', () => {
      const specPm = spec.phases['SPEC_PM'];
      const specDesignTokens = spec.phases['SPEC_DESIGN_TOKENS'];

      // Both depend on ANALYSIS and STACK_SELECTION
      expect(specPm.depends_on).toContain('ANALYSIS');
      expect(specPm.depends_on).toContain('STACK_SELECTION');
      expect(specDesignTokens.depends_on).toEqual(['ANALYSIS']);
    });
  });

  describe('Dependency graph integrity', () => {
    it('should not have circular dependencies', () => {
      const phases = Object.keys(spec.phases);
      const visited = new Set<string>();
      const recursionStack = new Set<string>();

      const detectCycle = (phase: string): boolean => {
        if (recursionStack.has(phase)) return true;
        if (visited.has(phase)) return false;

        visited.add(phase);
        recursionStack.add(phase);

        const phaseDef = spec.phases[phase];
        if (phaseDef.depends_on) {
          for (const dep of phaseDef.depends_on) {
            if (detectCycle(dep)) return true;
          }
        }

        recursionStack.delete(phase);
        return false;
      };

      for (const phase of phases) {
        expect(detectCycle(phase), `Circular dependency detected starting from ${phase}`).toBe(false);
      }
    });

    it('all referenced dependencies should exist', () => {
      const phases = Object.keys(spec.phases);

      for (const phase of phases) {
        const phaseDef = spec.phases[phase];
        if (phaseDef.depends_on) {
          for (const dep of phaseDef.depends_on) {
            expect(spec.phases[dep], `Phase ${phase} depends on non-existent phase ${dep}`).toBeDefined();
          }
        }
      }
    });
  });
});
