/**
 * Failure Type Classifier
 *
 * Analyzes validation failure messages and classifies them into specific types
 * to determine appropriate remediation strategies for the AUTO_REMEDY phase.
 *
 * Based on PHASE_WORKFLOW_ENHANCEMENT_PLAN.md lines 544-553
 */

/**
 * 7 Failure Types for AUTO_REMEDY Classification
 */
export type FailureType =
  | 'missing_requirement_mapping'   // PRD missing requirements from project-brief
  | 'persona_mismatch'              // PRD doesn't align with personas
  | 'api_data_model_gap'            // API references fields not in data model
  | 'structural_inconsistency'      // Cross-artifact reference errors
  | 'format_validation_error'       // Syntax, JSON, markdown errors
  | 'constitutional_violation'      // Violates constitutional articles
  | 'unknown';                      // Unclassifiable failure

/**
 * Failure classification result
 */
export interface FailureClassification {
  type: FailureType;
  confidence: number;  // 0.0 to 1.0
  reason: string;      // Human-readable explanation
}

/**
 * Remediation strategy for a failure type
 */
export interface RemediationStrategy {
  agentToRerun: 'pm' | 'architect' | 'designer' | 'analyst' | 'scrummaster';
  phase: string;
  additionalInstructions: string;
  requiresManualReview: boolean;
  reason: string;
}

/**
 * Pattern matching rules for failure classification
 */
const CLASSIFICATION_PATTERNS: Array<{
  type: FailureType;
  patterns: RegExp[];
  confidence: number;
}> = [
  {
    type: 'missing_requirement_mapping',
    patterns: [
      /missing.*(requirement|feature|functionality)/i,
      /not.*(captured|included|specified).*in.*PRD/i,
      /gap.*between.*project-brief.*and.*PRD/i,
      /PRD.*missing.*mentioned.*in.*project-brief/i,
    ],
    confidence: 0.85,
  },
  {
    type: 'persona_mismatch',
    patterns: [
      /not.*align.*with.*persona/i,
      /persona.*mismatch/i,
      /user.*stor(y|ies).*inconsistent.*with.*persona/i,
      /does.*not.*match.*persona.*"[^"]+"/i,
    ],
    confidence: 0.80,
  },
  {
    type: 'api_data_model_gap',
    patterns: [
      /api.*references.*field.*not.*in.*data.*model/i,
      /data.*model.*missing.*field.*used.*in.*api/i,
      /api.*spec.*inconsistent.*with.*data.*model/i,
      /field.*not.*present.*in.*data-model/i,
    ],
    confidence: 0.85,
  },
  {
    type: 'structural_inconsistency',
    patterns: [
      /references.*not.*defined/i,
      /component.*references.*token.*not.*defined/i,
      /inconsistent.*with.*architecture/i,
      /violates.*dependency.*graph/i,
    ],
    confidence: 0.75,
  },
  {
    type: 'format_validation_error',
    patterns: [
      /invalid.*(json|yaml|markdown|syntax)/i,
      /parse.*error/i,
      /malformed/i,
      /syntax.*error/i,
      /formatting.*error/i,
    ],
    confidence: 0.95,
  },
  {
    type: 'constitutional_violation',
    patterns: [
      /violates.*constitutional.*article/i,
      /constitutional.*violation/i,
      /forbidden.*by.*constitution/i,
      /against.*constitutional.*principle/i,
    ],
    confidence: 0.98,
  },
];

/**
 * Classify a validation failure into a specific failure type
 *
 * Uses pattern matching on error messages and phase context to determine
 * the most likely failure type and confidence level.
 *
 * @param phase - The phase where validation failed (e.g., 'SPEC_PM', 'SPEC_ARCHITECT')
 * @param errorMessage - The validation failure message
 * @returns Classification result with type, confidence, and reason
 *
 * @example
 * classifyFailure(
 *   'SPEC_PM',
 *   'PRD.md is missing requirements for user authentication mentioned in project-brief.md'
 * )
 * // => { type: 'missing_requirement_mapping', confidence: 0.85, reason: '...' }
 */
export function classifyFailure(
  phase: string,
  errorMessage: string
): FailureClassification {
  // Try each pattern set
  for (const { type, patterns, confidence } of CLASSIFICATION_PATTERNS) {
    for (const pattern of patterns) {
      if (pattern.test(errorMessage)) {
        return {
          type,
          confidence,
          reason: `Matched pattern for ${type}: ${pattern.source}`,
        };
      }
    }
  }

  // No pattern matched - classify as unknown
  return {
    type: 'unknown',
    confidence: 0.3,
    reason: 'No classification pattern matched',
  };
}

/**
 * Get remediation strategy for a failure type
 *
 * Maps failure types to specific agent re-run strategies with targeted instructions.
 * Based on failure-to-remediation mapping from PHASE_WORKFLOW_ENHANCEMENT_PLAN.md.
 *
 * @param failureType - The classified failure type
 * @param failedPhase - The phase that failed validation
 * @returns Remediation strategy including which agent to re-run and with what instructions
 *
 * @example
 * getRemediationStrategy('missing_requirement_mapping', 'SPEC_PM')
 * // => {
 * //   agentToRerun: 'pm',
 * //   phase: 'SPEC_PM',
 * //   additionalInstructions: 'Perform gap analysis...',
 * //   requiresManualReview: false,
 * //   reason: 'Re-run PM with gap analysis to capture missing requirements'
 * // }
 */
export function getRemediationStrategy(
  failureType: FailureType,
  failedPhase: string
): RemediationStrategy {
  switch (failureType) {
    case 'missing_requirement_mapping':
      return {
        agentToRerun: 'pm',
        phase: 'SPEC_PM',
        additionalInstructions:
          'Perform gap analysis between project-brief.md and PRD.md. ' +
          'Identify missing requirements and add them to PRD with proper user stories.',
        requiresManualReview: false,
        reason: 'Re-run PM with gap analysis to capture missing requirements',
      };

    case 'persona_mismatch':
      return {
        agentToRerun: 'pm',
        phase: 'SPEC_PM',
        additionalInstructions:
          'Review PRD user stories for persona consistency with personas.md. ' +
          'Ensure all features align with defined persona needs and behaviors.',
        requiresManualReview: false,
        reason: 'Re-run PM with persona consistency check',
      };

    case 'api_data_model_gap':
      return {
        agentToRerun: 'architect',
        phase: 'SPEC_ARCHITECT',
        additionalInstructions:
          'Synchronize api-spec.json and data-model.md. ' +
          'Add missing fields to data model or remove undefined fields from API spec.',
        requiresManualReview: false,
        reason: 'Re-run Architect to synchronize API and data model',
      };

    case 'structural_inconsistency':
      // Determine which agent based on phase
      const agent = failedPhase.includes('DESIGN') ? 'designer' :
                    failedPhase.includes('ARCHITECT') ? 'architect' : 'pm';
      return {
        agentToRerun: agent,
        phase: failedPhase,
        additionalInstructions:
          'Fix cross-artifact reference errors. Ensure all referenced entities are properly defined.',
        requiresManualReview: false,
        reason: `Re-run ${agent} to fix structural inconsistencies`,
      };

    case 'format_validation_error':
      const formatAgent = failedPhase.includes('PM') ? 'pm' :
                         failedPhase.includes('ARCHITECT') ? 'architect' :
                         failedPhase.includes('DESIGN') ? 'designer' : 'analyst';
      return {
        agentToRerun: formatAgent,
        phase: failedPhase,
        additionalInstructions:
          'Fix formatting errors. Ensure valid JSON/YAML/Markdown syntax and proper structure.',
        requiresManualReview: false,
        reason: `Re-run ${formatAgent} to fix formatting errors`,
      };

    case 'constitutional_violation':
      return {
        agentToRerun: 'analyst',
        phase: failedPhase,
        additionalInstructions: '',
        requiresManualReview: true,
        reason: 'Constitutional violation requires manual review and decision',
      };

    case 'unknown':
    default:
      return {
        agentToRerun: 'analyst',
        phase: failedPhase,
        additionalInstructions: '',
        requiresManualReview: true,
        reason: 'Unknown failure type requires manual investigation',
      };
  }
}
