/**
 * AUTO_REMEDY Phase Executor
 *
 * Orchestrates the automatic remediation workflow when validation failures occur.
 * Integrates failure classification, safeguards, and agent re-run logic.
 *
 * Based on PHASE_WORKFLOW_ENHANCEMENT_PLAN.md lines 544-553
 */

import { classifyFailure, getRemediationStrategy, FailureType } from './failure_classifier';
import {
  detectUserEdit,
  validateChangeScope,
  isProtectedArtifact,
  SafeguardResult,
} from './auto_remedy_safeguards';
import { getAffectedArtifacts } from './artifact_dependencies';

/**
 * Validation failure from VALIDATE phase
 */
export interface ValidationFailure {
  phase: string;
  message: string;
  artifactId: string;
}

/**
 * Artifact content for safeguard checking
 */
export interface ArtifactContent {
  current: string;
  original: string;
  originalHash: string;
}

/**
 * Context for AUTO_REMEDY execution
 */
export interface AutoRemedyContext {
  projectId: string;
  failedPhase: string;
  validationFailures: ValidationFailure[];
  currentAttempt: number;
  maxAttempts: number;
  artifactContent?: Record<string, ArtifactContent>;
  validationRunId?: string;
}

/**
 * Result of AUTO_REMEDY execution
 */
export interface AutoRemedyResult {
  canProceed: boolean;
  requiresManualReview: boolean;
  reason: string;
  classification: {
    type: FailureType;
    confidence: number;
  };
  remediation: {
    agentToRerun: string;
    phase: string;
    additionalInstructions: string;
  };
  safeguardResult: SafeguardResult;
  nextAttempt: number;
  dbRecord: {
    projectId: string;
    validationRunId?: string;
    startedAt: Date;
    completedAt?: Date;
    successful: boolean;
    changesApplied?: string;
  };
}

/**
 * Execute AUTO_REMEDY phase for validation failures
 *
 * Workflow:
 * 1. Classify validation failure
 * 2. Get remediation strategy
 * 3. Check safeguards
 * 4. Determine if can proceed or needs manual review
 * 5. Prepare agent re-run instructions
 *
 * @param context - AUTO_REMEDY execution context
 * @returns Result with remediation strategy and safety checks
 *
 * @example
 * const result = await executeAutoRemedy({
 *   projectId: 'proj-123',
 *   failedPhase: 'SPEC_PM',
 *   validationFailures: [{ ... }],
 *   currentAttempt: 1,
 *   maxAttempts: 2
 * });
 */
export async function executeAutoRemedy(
  context: AutoRemedyContext
): Promise<AutoRemedyResult> {
  const startTime = new Date();

  // Step 1: Classify the primary failure
  const primaryFailure = context.validationFailures[0];
  const classification = classifyFailure(primaryFailure.phase, primaryFailure.message);

  // Step 2: Get remediation strategy
  const remediation = getRemediationStrategy(classification.type, context.failedPhase);

  // Step 3: Check retry limit
  if (context.currentAttempt >= context.maxAttempts) {
    return {
      canProceed: false,
      requiresManualReview: true,
      reason: `AUTO_REMEDY max attempts reached (${context.maxAttempts})`,
      classification: {
        type: classification.type,
        confidence: classification.confidence,
      },
      remediation: {
        agentToRerun: remediation.agentToRerun,
        phase: remediation.phase,
        additionalInstructions: remediation.additionalInstructions,
      },
      safeguardResult: {
        approved: false,
        reason: 'Max retry limit reached',
      },
      nextAttempt: context.currentAttempt + 1,
      dbRecord: {
        projectId: context.projectId,
        validationRunId: context.validationRunId,
        startedAt: startTime,
        completedAt: new Date(),
        successful: false,
        changesApplied: 'Max attempts exceeded',
      },
    };
  }

  // Step 4: Check if remediation requires manual review
  if (remediation.requiresManualReview) {
    return {
      canProceed: false,
      requiresManualReview: true,
      reason: remediation.reason,
      classification: {
        type: classification.type,
        confidence: classification.confidence,
      },
      remediation: {
        agentToRerun: remediation.agentToRerun,
        phase: remediation.phase,
        additionalInstructions: remediation.additionalInstructions,
      },
      safeguardResult: {
        approved: false,
        reason: remediation.reason,
      },
      nextAttempt: context.currentAttempt + 1,
      dbRecord: {
        projectId: context.projectId,
        validationRunId: context.validationRunId,
        startedAt: startTime,
        completedAt: new Date(),
        successful: false,
        changesApplied: 'Manual review required',
      },
    };
  }

  // Step 5: Check safeguards
  let safeguardResult: SafeguardResult = {
    approved: true,
    reason: 'No safeguard checks needed',
  };

  // Check if artifact is protected
  if (isProtectedArtifact(primaryFailure.artifactId)) {
    safeguardResult = {
      approved: false,
      reason: `${primaryFailure.artifactId} is a protected artifact - manual review required`,
    };
  }

  // Check for user edits if artifact content provided
  if (context.artifactContent && context.artifactContent[primaryFailure.artifactId]) {
    const artifact = context.artifactContent[primaryFailure.artifactId];
    const editCheck = detectUserEdit(artifact.original, artifact.current, artifact.originalHash);

    if (editCheck.userEditDetected) {
      safeguardResult = {
        approved: false,
        userEditDetected: true,
        reason: 'User edit detected - conflict markers required',
      };
    }
  }

  // If safeguards fail, escalate to manual review
  if (!safeguardResult.approved) {
    return {
      canProceed: false,
      requiresManualReview: true,
      reason: safeguardResult.reason || 'Safeguard check failed',
      classification: {
        type: classification.type,
        confidence: classification.confidence,
      },
      remediation: {
        agentToRerun: remediation.agentToRerun,
        phase: remediation.phase,
        additionalInstructions: remediation.additionalInstructions,
      },
      safeguardResult,
      nextAttempt: context.currentAttempt + 1,
      dbRecord: {
        projectId: context.projectId,
        validationRunId: context.validationRunId,
        startedAt: startTime,
        completedAt: new Date(),
        successful: false,
        changesApplied: 'Safeguard check failed',
      },
    };
  }

  // Step 6: All checks passed - can proceed with AUTO_REMEDY
  return {
    canProceed: true,
    requiresManualReview: false,
    reason: 'AUTO_REMEDY can proceed - all safeguards passed',
    classification: {
      type: classification.type,
      confidence: classification.confidence,
    },
    remediation: {
      agentToRerun: remediation.agentToRerun,
      phase: remediation.phase,
      additionalInstructions: remediation.additionalInstructions,
    },
    safeguardResult,
    nextAttempt: context.currentAttempt + 1,
    dbRecord: {
      projectId: context.projectId,
      validationRunId: context.validationRunId,
      startedAt: startTime,
      successful: true,
      changesApplied: 'Pending agent execution',
    },
  };
}
