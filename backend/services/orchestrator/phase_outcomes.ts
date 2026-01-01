/**
 * Phase Outcome State Machine
 *
 * Determines workflow transitions based on validation results.
 * Connects inline validation → AUTO_REMEDY decisions → next phase routing.
 *
 * Based on PHASE_WORKFLOW_ENHANCEMENT_PLAN.md lines 558-585
 */

import { InlineValidationResult, ValidationIssue } from './inline_validation';

/**
 * Phase outcome states
 */
export type PhaseOutcome = 'all_pass' | 'warnings_only' | 'failures_detected';

/**
 * Phase transition types
 */
export type PhaseTransition = 'proceed' | 'user_choice' | 'auto_remedy';

/**
 * Configuration for phase outcome determination
 */
export interface PhaseOutcomeConfig {
  phase: string;
  validationResult: InlineValidationResult;
}

/**
 * Phase transition decision
 */
export interface PhaseTransitionDecision {
  state: PhaseOutcome;
  transition: PhaseTransition;
  canProceed: boolean;
  nextPhase: string;
  requiresUserDecision: boolean;
  warningCount?: number;
  errorCount?: number;
  failedArtifacts?: string[];
  choices?: string[];
  reason: string;
}

/**
 * Determine phase outcome based on validation results
 *
 * Implements 3-state outcome machine:
 * - all_pass: No issues → proceed to DONE
 * - warnings_only: Warnings but no errors → user choice
 * - failures_detected: Errors present → trigger AUTO_REMEDY
 *
 * @param config - Phase outcome configuration
 * @returns Transition decision with next phase and metadata
 *
 * @example
 * const outcome = determinePhaseOutcome({
 *   phase: 'VALIDATE',
 *   validationResult: { passed: true, warnings: [], errors: [] }
 * });
 * // => { state: 'all_pass', nextPhase: 'DONE', ... }
 */
export function determinePhaseOutcome(
  config: PhaseOutcomeConfig
): PhaseTransitionDecision {
  const { phase, validationResult } = config;
  const { errors, warnings } = validationResult;

  // State 1: failures_detected (errors present)
  if (errors.length > 0) {
    const failedArtifacts = extractFailedArtifacts(errors);

    return {
      state: 'failures_detected',
      transition: 'auto_remedy',
      canProceed: false,
      nextPhase: 'AUTO_REMEDY',
      requiresUserDecision: false,
      errorCount: errors.length,
      failedArtifacts,
      reason: `${errors.length} validation error(s) detected - triggering AUTO_REMEDY`,
    };
  }

  // State 2: warnings_only (warnings but no errors)
  if (warnings.length > 0) {
    return {
      state: 'warnings_only',
      transition: 'user_choice',
      canProceed: true,
      nextPhase: phase, // Stay in current phase for user decision
      requiresUserDecision: true,
      warningCount: warnings.length,
      choices: ['proceed', 'fix_warnings'],
      reason: `${warnings.length} warning(s) detected - user choice required`,
    };
  }

  // State 3: all_pass (no issues)
  return {
    state: 'all_pass',
    transition: 'proceed',
    canProceed: true,
    nextPhase: 'DONE',
    requiresUserDecision: false,
    warningCount: 0,
    errorCount: 0,
    reason: 'All validations passed - proceeding to completion',
  };
}

/**
 * Extract failed artifact IDs from error list
 */
function extractFailedArtifacts(errors: ValidationIssue[]): string[] {
  const artifacts = errors
    .filter(error => error.artifactId)
    .map(error => error.artifactId!);

  // Deduplicate
  return Array.from(new Set(artifacts));
}
