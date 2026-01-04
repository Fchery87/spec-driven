import { describe, it, expect } from 'vitest';
import {
  classifyFailure,
  getRemediationStrategy,
  FailureType,
  FailureClassification,
} from './failure_classifier';

describe('Failure Classifier', () => {
  describe('classifyFailure', () => {
    it('should classify missing requirement mapping failures', () => {
      const result = classifyFailure(
        'SPEC_PM',
        'PRD.md is missing requirements for user authentication mentioned in project-brief.md'
      );
      expect(result.type).toBe('missing_requirement_mapping');
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('should classify persona mismatch failures', () => {
      const result = classifyFailure(
        'SPEC_PM',
        'PRD user stories do not align with persona "Sarah the Student" defined in personas.md'
      );
      expect(result.type).toBe('persona_mismatch');
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    it('should classify API/data model gap failures', () => {
      const result = classifyFailure(
        'SPEC_ARCHITECT',
        'api-spec.json references User.profileImage field not present in data-model.md'
      );
      expect(result.type).toBe('api_data_model_gap');
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('should classify structural inconsistency failures', () => {
      const result = classifyFailure(
        'SPEC_DESIGN',
        'component-inventory.md references design token --color-accent not defined in design-tokens.md'
      );
      expect(result.type).toBe('structural_inconsistency');
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    it('should classify format validation errors', () => {
      const result = classifyFailure(
        'SPEC_ARCHITECT',
        'data-model.md has invalid JSON syntax in User schema definition'
      );
      expect(result.type).toBe('format_validation_error');
      expect(result.confidence).toBeGreaterThan(0.9);
    });

    it('should classify constitutional violations', () => {
      const result = classifyFailure(
        'STACK_SELECTION',
        'stack.json violates constitutional article: no NoSQL databases allowed'
      );
      expect(result.type).toBe('constitutional_violation');
      expect(result.confidence).toBeGreaterThan(0.95);
    });

    it('should classify unknown failure types with low confidence', () => {
      const result = classifyFailure(
        'VALIDATE',
        'Something went wrong but not sure what'
      );
      expect(result.type).toBe('unknown');
      expect(result.confidence).toBeLessThan(0.5);
    });
  });

  describe('getRemediationStrategy', () => {
    it('should return scrummaster re-run for missing_requirement_mapping', () => {
      const strategy = getRemediationStrategy('missing_requirement_mapping', 'SPEC_PM');
      expect(strategy.agentToRerun).toBe('scrummaster');
      expect(strategy.phase).toBe('SPEC_PM');
      expect(strategy.additionalInstructions).toContain('gap analysis');
    });

    it('should return PM re-run for persona_mismatch', () => {
      const strategy = getRemediationStrategy('persona_mismatch', 'SPEC_PM');
      expect(strategy.agentToRerun).toBe('pm');
      expect(strategy.phase).toBe('SPEC_PM');
      expect(strategy.additionalInstructions.toLowerCase()).toContain('persona consistency');
    });

    it('should return architect re-run for api_data_model_gap', () => {
      const strategy = getRemediationStrategy('api_data_model_gap', 'SPEC_ARCHITECT');
      expect(strategy.agentToRerun).toBe('architect');
      expect(strategy.phase).toBe('SPEC_ARCHITECT');
      expect(strategy.additionalInstructions.toLowerCase()).toContain('synchronize');
    });

    it('should return designer re-run for structural_inconsistency in design phase', () => {
      const strategy = getRemediationStrategy('structural_inconsistency', 'SPEC_DESIGN');
      expect(strategy.agentToRerun).toBe('designer');
      expect(strategy.phase).toBe('SPEC_DESIGN');
    });

    it('should return same phase for format_validation_error', () => {
      const strategy = getRemediationStrategy('format_validation_error', 'SPEC_ARCHITECT');
      expect(strategy.agentToRerun).toBe('architect');
      expect(strategy.phase).toBe('SPEC_ARCHITECT');
      expect(strategy.additionalInstructions.toLowerCase()).toContain('fix formatting');
    });

    it('should return manual review for constitutional_violation', () => {
      const strategy = getRemediationStrategy('constitutional_violation', 'STACK_SELECTION');
      expect(strategy.requiresManualReview).toBe(true);
      expect(strategy.reason).toContain('Constitutional violation');
    });

    it('should return manual review for unknown failures', () => {
      const strategy = getRemediationStrategy('unknown', 'VALIDATE');
      expect(strategy.requiresManualReview).toBe(true);
    });
  });
});
