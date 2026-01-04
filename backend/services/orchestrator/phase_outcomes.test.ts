import { describe, it, expect } from 'vitest';
import {
  determinePhaseOutcome,
  PhaseOutcomeConfig,
  PhaseTransitionDecision,
} from './phase_outcomes';

describe('Phase Outcome State Machine', () => {
  describe('all_pass Outcome', () => {
    it('should return all_pass when validation has no issues', () => {
      const config: PhaseOutcomeConfig = {
        phase: 'VALIDATE',
        validationResult: {
          passed: true,
          canProceed: true,
          warnings: [],
          errors: [],
          totalWarnings: 0,
          accumulatedWarnings: [],
        },
      };

      const outcome = determinePhaseOutcome(config);

      expect(outcome.state).toBe('all_pass');
      expect(outcome.canProceed).toBe(true);
      expect(outcome.nextPhase).toBe('DONE');
      expect(outcome.requiresUserDecision).toBe(false);
    });

    it('should proceed to DONE when all validations pass', () => {
      const config: PhaseOutcomeConfig = {
        phase: 'VALIDATE',
        validationResult: {
          passed: true,
          canProceed: true,
          warnings: [],
          errors: [],
          totalWarnings: 0,
          accumulatedWarnings: [],
        },
      };

      const outcome = determinePhaseOutcome(config);

      expect(outcome.transition).toBe('proceed');
      expect(outcome.nextPhase).toBe('DONE');
    });
  });

  describe('warnings_only Outcome', () => {
    it('should return warnings_only when validation has warnings but no errors', () => {
      const config: PhaseOutcomeConfig = {
        phase: 'SPEC_PM',
        validationResult: {
          passed: true,
          canProceed: true,
          warnings: [
            { severity: 'warning', message: 'Missing frontmatter', phase: 'SPEC_PM' },
          ],
          errors: [],
          totalWarnings: 1,
          accumulatedWarnings: [
            { severity: 'warning', message: 'Missing frontmatter', phase: 'SPEC_PM' },
          ],
        },
      };

      const outcome = determinePhaseOutcome(config);

      expect(outcome.state).toBe('warnings_only');
      expect(outcome.canProceed).toBe(true);
      expect(outcome.requiresUserDecision).toBe(true);
      expect(outcome.warningCount).toBe(1);
    });

    it('should allow user to choose to proceed or fix warnings', () => {
      const config: PhaseOutcomeConfig = {
        phase: 'SPEC_PM',
        validationResult: {
          passed: true,
          canProceed: true,
          warnings: [{ severity: 'warning', message: 'Warning', phase: 'SPEC_PM' }],
          errors: [],
          totalWarnings: 1,
          accumulatedWarnings: [{ severity: 'warning', message: 'Warning', phase: 'SPEC_PM' }],
        },
      };

      const outcome = determinePhaseOutcome(config);

      expect(outcome.transition).toBe('user_choice');
      expect(outcome.choices).toContain('proceed');
      expect(outcome.choices).toContain('fix_warnings');
    });
  });

  describe('failures_detected Outcome', () => {
    it('should return failures_detected when validation has errors', () => {
      const config: PhaseOutcomeConfig = {
        phase: 'SPEC_PM',
        validationResult: {
          passed: false,
          canProceed: false,
          warnings: [],
          errors: [
            { severity: 'error', message: 'Missing required artifact', phase: 'SPEC_PM', artifactId: 'PRD.md' },
          ],
          totalWarnings: 0,
          accumulatedWarnings: [],
        },
      };

      const outcome = determinePhaseOutcome(config);

      expect(outcome.state).toBe('failures_detected');
      expect(outcome.canProceed).toBe(false);
      expect(outcome.nextPhase).toBe('AUTO_REMEDY');
    });

    it('should trigger AUTO_REMEDY when errors detected', () => {
      const config: PhaseOutcomeConfig = {
        phase: 'SPEC_PM',
        validationResult: {
          passed: false,
          canProceed: false,
          warnings: [],
          errors: [
            { severity: 'error', message: 'Error', phase: 'SPEC_PM' },
          ],
          totalWarnings: 0,
          accumulatedWarnings: [],
        },
      };

      const outcome = determinePhaseOutcome(config);

      expect(outcome.transition).toBe('auto_remedy');
      expect(outcome.nextPhase).toBe('AUTO_REMEDY');
      expect(outcome.requiresUserDecision).toBe(false);
    });

    it('should include failure metadata', () => {
      const config: PhaseOutcomeConfig = {
        phase: 'SPEC_PM',
        validationResult: {
          passed: false,
          canProceed: false,
          warnings: [],
          errors: [
            { severity: 'error', message: 'Missing PRD', phase: 'SPEC_PM', artifactId: 'PRD.md' },
            { severity: 'error', message: 'Invalid JSON', phase: 'SPEC_PM', artifactId: 'data.json' },
          ],
          totalWarnings: 0,
          accumulatedWarnings: [],
        },
      };

      const outcome = determinePhaseOutcome(config);

      expect(outcome.errorCount).toBe(2);
      expect(outcome.failedArtifacts).toContain('PRD.md');
      expect(outcome.failedArtifacts).toContain('data.json');
    });
  });

  describe('Edge Cases', () => {
    it('should handle both warnings and errors (errors take precedence)', () => {
      const config: PhaseOutcomeConfig = {
        phase: 'VALIDATE',
        validationResult: {
          passed: false,
          canProceed: false,
          warnings: [
            { severity: 'warning', message: 'Warning', phase: 'VALIDATE' },
          ],
          errors: [
            { severity: 'error', message: 'Error', phase: 'VALIDATE' },
          ],
          totalWarnings: 1,
          accumulatedWarnings: [
            { severity: 'warning', message: 'Warning', phase: 'VALIDATE' },
          ],
        },
      };

      const outcome = determinePhaseOutcome(config);

      expect(outcome.state).toBe('failures_detected');
      expect(outcome.nextPhase).toBe('AUTO_REMEDY');
    });

    it('should handle empty validation results', () => {
      const config: PhaseOutcomeConfig = {
        phase: 'VALIDATE',
        validationResult: {
          passed: true,
          canProceed: true,
          warnings: [],
          errors: [],
          totalWarnings: 0,
          accumulatedWarnings: [],
        },
      };

      const outcome = determinePhaseOutcome(config);

      expect(outcome.state).toBe('all_pass');
    });
  });
});
