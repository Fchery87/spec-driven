import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import {
  executeAutoRemedy,
  AutoRemedyContext,
  AutoRemedyResult,
} from './auto_remedy_executor';
import * as failureClassifier from './failure_classifier';

describe('AUTO_REMEDY Executor', () => {
  let mockContext: AutoRemedyContext;

  beforeEach(() => {
    mockContext = {
      projectId: 'test-project-123',
      failedPhase: 'SPEC_PM',
      validationFailures: [
        {
          phase: 'SPEC_PM',
          message: 'PRD.md is missing requirements for user authentication mentioned in project-brief.md',
          artifactId: 'PRD.md',
        },
      ],
      currentAttempt: 1,
      maxAttempts: 2,
    };
  });

  describe('Failure Classification', () => {
    it('should classify validation failures correctly', async () => {
      const result = await executeAutoRemedy(mockContext);

      expect(result.classification.type).toBe('missing_requirement_mapping');
      expect(result.remediation.agentToRerun).toBe('scrummaster');
    });
  });

  describe('Safeguard Integration', () => {
    it('should detect user edits and create conflict markers', async () => {
      const contextWithUserEdit = {
        ...mockContext,
        artifactContent: {
          'PRD.md': {
            current: 'User modified this',
            original: 'Original content',
            originalHash: 'abc123',
          },
        },
      };

      const result = await executeAutoRemedy(contextWithUserEdit);

      expect(result.safeguardResult.userEditDetected).toBe(true);
      expect(result.requiresManualReview).toBe(true);
      expect(result.reason).toContain('User edit detected');
    });

    it('should reject changes to protected artifacts', async () => {
      const contextWithProtected = {
        ...mockContext,
        validationFailures: [{
          phase: 'SPEC_PM',
          message: 'PRD.md is missing requirements for user authentication mentioned in project-brief.md',
          artifactId: 'constitution.md', // Protected artifact
        }],
      };

      const result = await executeAutoRemedy(contextWithProtected);

      expect(result.safeguardResult.approved).toBe(false);
      expect(result.requiresManualReview).toBe(true);
      // Protected artifact check happens in safeguard layer
      expect(result.safeguardResult.reason).toContain('protected artifact');
    });
  });

  describe('Retry Logic', () => {
    it('should proceed when attempt count under limit', async () => {
      mockContext.currentAttempt = 1;

      const result = await executeAutoRemedy(mockContext);

      expect(result.canProceed).toBe(true);
      expect(result.nextAttempt).toBe(2);
    });

    it('should escalate to manual review after max attempts', async () => {
      mockContext.currentAttempt = 2;

      const result = await executeAutoRemedy(mockContext);

      expect(result.requiresManualReview).toBe(true);
      expect(result.reason).toContain('max attempts reached');
    });
  });

  describe('Agent Re-run Orchestration', () => {
    it('should return correct agent and instructions for PM failures', async () => {
      const result = await executeAutoRemedy(mockContext);

      expect(result.remediation.agentToRerun).toBe('scrummaster');
      expect(result.remediation.phase).toBe('SPEC_PM');
      expect(result.remediation.additionalInstructions).toContain('gap analysis');
    });

    it('should return correct agent for architect failures', async () => {
      mockContext.failedPhase = 'SPEC_ARCHITECT';
      mockContext.validationFailures = [{
        phase: 'SPEC_ARCHITECT',
        message: 'api-spec.json references User.avatar field not in data-model.md',
        artifactId: 'api-spec.json',
      }];

      const result = await executeAutoRemedy(mockContext);

      expect(result.remediation.agentToRerun).toBe('architect');
      expect(result.remediation.additionalInstructions.toLowerCase()).toContain('synchronize');
    });
  });

  describe('Database Recording', () => {
    it('should prepare database record with all details', async () => {
      const result = await executeAutoRemedy(mockContext);

      expect(result.dbRecord).toBeDefined();
      expect(result.dbRecord.projectId).toBe('test-project-123');
      expect(result.dbRecord.startedAt).toBeInstanceOf(Date);
      expect(result.dbRecord.successful).toBe(true);
    });

    it('should include validationRunId when provided', async () => {
      const contextWithRunId = {
        ...mockContext,
        validationRunId: 'validation-run-456',
      };

      const result = await executeAutoRemedy(contextWithRunId);

      expect(result.dbRecord.validationRunId).toBe('validation-run-456');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty validation failures array', async () => {
      const emptyContext = {
        ...mockContext,
        validationFailures: [],
      };

      const result = await executeAutoRemedy(emptyContext);

      expect(result.canProceed).toBe(false);
      expect(result.requiresManualReview).toBe(true);
      expect(result.reason).toContain('No validation failures');
    });

    it('should handle null validation failures', async () => {
      const nullContext = {
        ...mockContext,
        validationFailures: null as any,
      };

      const result = await executeAutoRemedy(nullContext);

      expect(result.canProceed).toBe(false);
      expect(result.requiresManualReview).toBe(true);
    });

    it('should handle exceptions gracefully', async () => {
      // Mock classifyFailure to throw an error
      const classifySpy = vi.spyOn(failureClassifier, 'classifyFailure');
      classifySpy.mockImplementation(() => {
        throw new Error('Simulated classification error');
      });

      const result = await executeAutoRemedy(mockContext);

      expect(result.canProceed).toBe(false);
      expect(result.requiresManualReview).toBe(true);
      expect(result.reason).toContain('execution error');
      expect(result.reason).toContain('Simulated classification error');

      classifySpy.mockRestore();
    });

    it('should handle constitutional violations correctly', async () => {
      mockContext.validationFailures = [{
        phase: 'STACK_SELECTION',
        message: 'violates constitutional article: no NoSQL databases allowed',
        artifactId: 'stack.json',
      }];

      const result = await executeAutoRemedy(mockContext);

      expect(result.classification.type).toBe('constitutional_violation');
      expect(result.requiresManualReview).toBe(true);
      expect(result.reason).toContain('Constitutional violation');
    });

    it('should handle unknown failure types', async () => {
      mockContext.validationFailures = [{
        phase: 'VALIDATE',
        message: 'Something completely unexpected happened',
        artifactId: 'test.md',
      }];

      const result = await executeAutoRemedy(mockContext);

      expect(result.classification.type).toBe('unknown');
      expect(result.requiresManualReview).toBe(true);
    });
  });
});
