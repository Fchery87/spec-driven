/**
 * Inline Validation System
 *
 * Provides real-time validation immediately after artifact generation,
 * enabling early error detection before the VALIDATE phase.
 *
 * Based on PHASE_WORKFLOW_ENHANCEMENT_PLAN.md lines 1055-1099
 */

export interface ValidationIssue {
  severity: 'error' | 'warning';
  message: string;
  artifactId?: string;
  phase: string;
}

export interface InlineValidationConfig {
  phase: string;
  artifacts: Record<string, string>; // artifactId → content
  accumulatedWarnings?: ValidationIssue[];
}

export interface InlineValidationResult {
  passed: boolean;
  canProceed: boolean;
  warnings: ValidationIssue[];
  errors: ValidationIssue[];
  totalWarnings: number;
  accumulatedWarnings: ValidationIssue[];
}

/**
 * Validator function type
 */
type Validator = (artifacts: Record<string, string>, phase: string) => ValidationIssue[];

/**
 * ANALYSIS Phase Validators
 */
const ANALYSIS_VALIDATORS: Validator[] = [
  // Presence validator
  (artifacts, phase) => {
    const issues: ValidationIssue[] = [];
    const required = ['project-brief.md', 'constitution.md'];

    for (const artifactId of required) {
      if (!artifacts[artifactId] || artifacts[artifactId].trim() === '') {
        issues.push({
          severity: 'error',
          message: `Missing required artifact: ${artifactId}`,
          artifactId,
          phase,
        });
      }
    }

    return issues;
  },

  // Markdown frontmatter validator
  (artifacts, phase) => {
    const issues: ValidationIssue[] = [];
    const markdownFiles = Object.keys(artifacts).filter(id => id.endsWith('.md'));

    for (const artifactId of markdownFiles) {
      const content = artifacts[artifactId];
      if (!content.startsWith('---')) {
        issues.push({
          severity: 'warning',
          message: `Missing frontmatter in ${artifactId}`,
          artifactId,
          phase,
        });
      }
    }

    return issues;
  },

  // Unresolved clarifications validator
  (artifacts, phase) => {
    const issues: ValidationIssue[] = [];

    for (const [artifactId, content] of Object.entries(artifacts)) {
      const clarificationPattern = /\[CLARIFICATION NEEDED:([^\]]+)\]/gi;
      const matches = content.match(clarificationPattern);

      if (matches && matches.length > 0) {
        issues.push({
          severity: 'warning',
          message: `Unresolved clarification in ${artifactId}: ${matches.length} found`,
          artifactId,
          phase,
        });
      }
    }

    return issues;
  },
];

/**
 * STACK_SELECTION Phase Validators
 */
const STACK_SELECTION_VALIDATORS: Validator[] = [
  // stack.json presence
  (artifacts, phase) => {
    const issues: ValidationIssue[] = [];

    if (!artifacts['stack.json']) {
      issues.push({
        severity: 'error',
        message: 'Missing required artifact: stack.json',
        artifactId: 'stack.json',
        phase,
      });
    }

    return issues;
  },

  // stack.json valid JSON
  (artifacts, phase) => {
    const issues: ValidationIssue[] = [];
    const stackJson = artifacts['stack.json'];

    if (stackJson) {
      try {
        JSON.parse(stackJson);
      } catch (error) {
        issues.push({
          severity: 'error',
          message: 'Invalid JSON in stack.json',
          artifactId: 'stack.json',
          phase,
        });
      }
    }

    return issues;
  },

  // Stack completeness
  (artifacts, phase) => {
    const issues: ValidationIssue[] = [];
    const stackJson = artifacts['stack.json'];

    if (stackJson) {
      try {
        const stack = JSON.parse(stackJson);
        const requiredKeys = ['frontend', 'backend', 'database'];
        const missingKeys = requiredKeys.filter(key => !stack[key]);

        if (missingKeys.length > 0) {
          issues.push({
            severity: 'warning',
            message: `Incomplete stack definition - missing: ${missingKeys.join(', ')}`,
            artifactId: 'stack.json',
            phase,
          });
        }
      } catch {
        // JSON parse error already caught by previous validator
      }
    }

    return issues;
  },
];

/**
 * Phase-to-validators mapping
 */
export const PHASE_VALIDATORS: Record<string, Validator[]> = {
  'ANALYSIS': ANALYSIS_VALIDATORS,
  'STACK_SELECTION': STACK_SELECTION_VALIDATORS,
  // Add more phases as needed in Task 8 integration
};

/**
 * Run inline validation for a phase
 *
 * Executes all validators for the given phase and returns results.
 * Warnings are non-blocking, errors block progression.
 *
 * @param config - Validation configuration
 * @returns Validation result with warnings, errors, and accumulated warnings
 *
 * @example
 * const result = await runInlineValidation({
 *   phase: 'ANALYSIS',
 *   artifacts: {
 *     'project-brief.md': 'content...',
 *     'constitution.md': 'content...'
 *   }
 * });
 */
export async function runInlineValidation(
  config: InlineValidationConfig
): Promise<InlineValidationResult> {
  const validators = PHASE_VALIDATORS[config.phase] || [];
  const allIssues: ValidationIssue[] = [];

  // Run all validators for this phase
  for (const validator of validators) {
    const issues = validator(config.artifacts, config.phase);
    allIssues.push(...issues);
  }

  // Separate warnings and errors
  const warnings = allIssues.filter(issue => issue.severity === 'warning');
  const errors = allIssues.filter(issue => issue.severity === 'error');

  // Accumulate warnings
  const accumulatedWarnings = [
    ...(config.accumulatedWarnings || []),
    ...warnings,
  ];

  return {
    passed: errors.length === 0,
    canProceed: errors.length === 0, // Warnings don't block
    warnings,
    errors,
    totalWarnings: accumulatedWarnings.length,
    accumulatedWarnings,
  };
}
