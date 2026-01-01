/**
 * Phase 1 Integration Tests: Feedback Loops & Continuous Validation
 *
 * Tests the complete Phase 1 workflow including:
 * - Inline validation execution
 * - Phase outcome determination
 * - AUTO_REMEDY triggering and execution
 * - ValidationRun database records
 * - Manual review escalation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createHash } from 'crypto';
import { OrchestratorEngine } from './orchestrator_engine';
import { runInlineValidation } from './inline_validation';
import { determinePhaseOutcome } from './phase_outcomes';
import { executeAutoRemedy } from './auto_remedy_executor';
import type { Project } from '@/types/orchestrator';

describe('Phase 1 Integration: Feedback Loops & Continuous Validation', () => {
  let orchestrator: OrchestratorEngine;
  let mockProject: Project;

  beforeEach(() => {
    orchestrator = new OrchestratorEngine();
    mockProject = {
      id: 'test-project-id',
      slug: 'test-project',
      name: 'Test Project',
      description: 'Test project description',
      created_by_id: 'test-user-id',
      current_phase: 'ANALYSIS',
      phases_completed: [],
      stack_choice: undefined,
      stack_approved: false,
      project_path: '/tmp/test-project',
      created_at: new Date(),
      updated_at: new Date(),
      orchestration_state: {
        artifact_versions: {},
        phase_history: [],
        approval_gates: {},
      },
    } as Project;
  });

  describe('Inline Validation', () => {
    it('should run inline validation after ANALYSIS phase', async () => {
      const artifacts = {
        'project-brief.md': '---\ntitle: Test\n---\n# Test Brief\n\nThis is a test project brief with sufficient content.',
        'constitution.md': '---\ntitle: Constitution\n---\n# Constitutional Articles\n\nTest constitution content here.',
      };

      const result = await runInlineValidation({
        phase: 'ANALYSIS',
        artifacts,
      });

      expect(result).toBeDefined();
      expect(result.passed).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing required artifacts in ANALYSIS', async () => {
      const artifacts = {
        'project-brief.md': '---\ntitle: Test\n---\n# Brief',
        // Missing constitution.md
      };

      const result = await runInlineValidation({
        phase: 'ANALYSIS',
        artifacts,
      });

      expect(result.passed).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].message).toContain('constitution.md');
    });

    it('should detect invalid stack.json in STACK_SELECTION', async () => {
      const artifacts = {
        'stack.json': 'invalid json {{{',
      };

      const result = await runInlineValidation({
        phase: 'STACK_SELECTION',
        artifacts,
      });

      expect(result.passed).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.message.includes('Invalid JSON'))).toBe(true);
    });
  });

  describe('Phase Outcome State Machine', () => {
    it('should determine "all_pass" outcome when no issues', () => {
      const outcome = determinePhaseOutcome({
        phase: 'VALIDATE',
        validationResult: {
          passed: true,
          canProceed: true,
          warnings: [],
          errors: [],
          totalWarnings: 0,
          accumulatedWarnings: [],
        },
      });

      expect(outcome.state).toBe('all_pass');
      expect(outcome.nextPhase).toBe('DONE');
      expect(outcome.canProceed).toBe(true);
      expect(outcome.requiresUserDecision).toBe(false);
    });

    it('should determine "warnings_only" outcome when warnings present', () => {
      const outcome = determinePhaseOutcome({
        phase: 'VALIDATE',
        validationResult: {
          passed: true,
          canProceed: true,
          warnings: [
            {
              severity: 'warning',
              message: 'Missing frontmatter',
              phase: 'ANALYSIS',
              artifactId: 'project-brief.md',
            },
          ],
          errors: [],
          totalWarnings: 1,
          accumulatedWarnings: [],
        },
      });

      expect(outcome.state).toBe('warnings_only');
      expect(outcome.transition).toBe('user_choice');
      expect(outcome.requiresUserDecision).toBe(true);
      expect(outcome.warningCount).toBe(1);
      expect(outcome.choices).toEqual(['proceed', 'fix_warnings']);
    });

    it('should determine "failures_detected" outcome when errors present', () => {
      const outcome = determinePhaseOutcome({
        phase: 'VALIDATE',
        validationResult: {
          passed: false,
          canProceed: false,
          warnings: [],
          errors: [
            {
              severity: 'error',
              message: 'Missing required artifact: constitution.md',
              phase: 'ANALYSIS',
              artifactId: 'constitution.md',
            },
          ],
          totalWarnings: 0,
          accumulatedWarnings: [],
        },
      });

      expect(outcome.state).toBe('failures_detected');
      expect(outcome.transition).toBe('auto_remedy');
      expect(outcome.nextPhase).toBe('AUTO_REMEDY');
      expect(outcome.canProceed).toBe(false);
      expect(outcome.errorCount).toBe(1);
      expect(outcome.failedArtifacts).toContain('constitution.md');
    });
  });

  describe('AUTO_REMEDY Execution', () => {
    it('should execute AUTO_REMEDY for validation failures', async () => {
      const context = {
        projectId: 'test-project-id',
        failedPhase: 'ANALYSIS',
        validationFailures: [
          {
            phase: 'ANALYSIS',
            message: 'Missing required artifact: constitution.md',
            artifactId: 'constitution.md',
          },
        ],
        currentAttempt: 1,
        maxAttempts: 2,
      };

      const result = await executeAutoRemedy(context);

      expect(result).toBeDefined();
      expect(result.classification).toBeDefined();
      expect(result.remediation).toBeDefined();
      expect(result.safeguardResult).toBeDefined();
    });

    it('should escalate to MANUAL_REVIEW after max attempts', async () => {
      const context = {
        projectId: 'test-project-id',
        failedPhase: 'ANALYSIS',
        validationFailures: [
          {
            phase: 'ANALYSIS',
            message: 'Missing required artifact: constitution.md',
            artifactId: 'constitution.md',
          },
        ],
        currentAttempt: 2,
        maxAttempts: 2,
      };

      const result = await executeAutoRemedy(context);

      expect(result.canProceed).toBe(false);
      expect(result.requiresManualReview).toBe(true);
      expect(result.reason).toContain('max attempts reached');
    });

    it('should block AUTO_REMEDY for protected artifacts', async () => {
      const context = {
        projectId: 'test-project-id',
        failedPhase: 'ANALYSIS',
        validationFailures: [
          {
            phase: 'ANALYSIS',
            message: 'Missing required artifact: constitution.md',
            artifactId: 'constitution.md',
          },
        ],
        currentAttempt: 1,
        maxAttempts: 2,
        artifactContent: {
          'constitution.md': {
            current: '# Modified content',
            original: '# Original content',
            originalHash: createHash('sha256').update('# Original content').digest('hex'),
          },
        },
      };

      const result = await executeAutoRemedy(context);

      // Should detect user edit (different hash) OR protected artifact
      expect(result.requiresManualReview).toBe(true);
      expect(result.safeguardResult.approved).toBe(false);
      // Will be blocked either for protected artifact or user edit detection
      expect(result.safeguardResult.reason).toBeTruthy();
    });
  });

  describe('Full Workflow Integration', () => {
    it('should complete full workflow: inline validation → outcome → proceed', async () => {
      // Step 1: Run inline validation with complete artifacts (sufficient content + frontmatter)
      const artifacts = {
        'project-brief.md': `---
title: Test Project Brief
owner: analyst
version: 1.0
date: 2025-01-01
status: draft
---

# Test Brief

This is a complete test project brief with sufficient content to pass validation.
It includes multiple paragraphs and detailed information about the project scope,
objectives, and requirements to ensure it meets the minimum content length
requirements for inline validation.`,
        'constitution.md': `---
title: Constitutional Articles
owner: analyst
version: 1.0
date: 2025-01-01
status: draft
---

# Constitutional Articles

This constitution document contains the guiding principles and governance
rules for the project. It includes detailed articles, rationales, and
enforcement mechanisms to ensure proper project execution and alignment
with organizational standards and best practices.`,
      };

      const validationResult = await runInlineValidation({
        phase: 'ANALYSIS',
        artifacts,
      });

      expect(validationResult.passed).toBe(true);
      expect(validationResult.warnings.length).toBe(0); // No warnings with complete artifacts

      // Step 2: Determine phase outcome
      const outcome = determinePhaseOutcome({
        phase: 'ANALYSIS',
        validationResult,
      });

      expect(outcome.state).toBe('all_pass');
      expect(outcome.canProceed).toBe(true);
    });

    it('should complete workflow: inline validation → failure → AUTO_REMEDY', async () => {
      // Step 1: Run inline validation with missing artifact
      const artifacts = {
        'project-brief.md': '---\ntitle: Test\n---\n# Brief',
        // Missing constitution.md
      };

      const validationResult = await runInlineValidation({
        phase: 'ANALYSIS',
        artifacts,
      });

      expect(validationResult.passed).toBe(false);

      // Step 2: Determine phase outcome
      const outcome = determinePhaseOutcome({
        phase: 'ANALYSIS',
        validationResult,
      });

      expect(outcome.state).toBe('failures_detected');
      expect(outcome.nextPhase).toBe('AUTO_REMEDY');

      // Step 3: Execute AUTO_REMEDY
      const autoRemedyResult = await executeAutoRemedy({
        projectId: 'test-project-id',
        failedPhase: 'ANALYSIS',
        validationFailures: validationResult.errors.map(e => ({
          phase: e.phase,
          message: e.message,
          artifactId: e.artifactId || 'unknown',
        })),
        currentAttempt: 1,
        maxAttempts: 2,
      });

      expect(autoRemedyResult).toBeDefined();
      expect(autoRemedyResult.remediation.agentToRerun).toBe('analyst');
    });
  });

  describe('Orchestrator Engine Integration', () => {
    it('should have orchestrator engine properly initialized', () => {
      expect(orchestrator).toBeDefined();
      expect(orchestrator.getCurrentPhaseSpec('ANALYSIS')).toBeDefined();
      expect(orchestrator.getCurrentPhaseSpec('VALIDATE')).toBeDefined();
    });

    it('should validate phase completion using built-in method', async () => {
      const validation = await orchestrator.validatePhaseCompletion(mockProject);

      expect(validation).toBeDefined();
      expect(validation.status).toBeDefined();
      expect(['pass', 'warn', 'fail']).toContain(validation.status);
    });

    it('should determine next phase based on validation outcome', async () => {
      // This will test determineNextPhase method once implemented
      expect(orchestrator).toBeDefined();
      // Future assertion: const nextPhase = await orchestrator.determineNextPhase(mockProject, validationResult);
    });
  });

  describe('Database Records', () => {
    it('should create ValidationRun record structure in AUTO_REMEDY', async () => {
      const context = {
        projectId: 'test-project-id',
        failedPhase: 'ANALYSIS',
        validationFailures: [
          {
            phase: 'ANALYSIS',
            message: 'Test failure',
            artifactId: 'test.md',
          },
        ],
        currentAttempt: 1,
        maxAttempts: 2,
        validationRunId: 'val-run-123',
      };

      const result = await executeAutoRemedy(context);

      expect(result.dbRecord).toBeDefined();
      expect(result.dbRecord.projectId).toBe('test-project-id');
      expect(result.dbRecord.validationRunId).toBe('val-run-123');
      expect(result.dbRecord.startedAt).toBeInstanceOf(Date);
      expect(result.dbRecord.successful).toBeDefined();
    });
  });
});
