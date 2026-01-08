/**
 * Root Cause Analyzer for AUTO_REMEDY Phase
 *
 * Analyzes validation errors to identify the originating phase and root cause
 * of errors to enable effective remediation.
 *
 * Uses pattern matching for simple cases and LLM-based analysis for complex cases.
 */

import { LLMProvider } from '../llm/providers/base';
import { LLMResponse } from '@/types/llm';

/**
 * Error types for root cause classification
 */
export type ErrorType =
  | 'parsing'
  | 'content_quality'
  | 'missing_file'
  | 'constitutional'
  | 'unknown';

/**
 * Root cause analysis result
 */
export interface RootCauseAnalysis {
  originatingPhase: string;
  errorType: ErrorType;
  confidence: number;
  explanation: string;
  remediationHint: string;
}

/**
 * Phase history entry for analysis
 */
export interface PhaseHistoryEntry {
  phase: string;
  status: 'completed' | 'failed' | 'pending';
  artifacts?: string[];
}

/**
 * Analysis context for LLM-based analysis
 */
export interface AnalysisContext {
  projectId: string;
  phaseHistory: PhaseHistoryEntry[];
  artifactNames?: string[];
}

/**
 * Error pattern definitions for classification
 */
const ERROR_PATTERNS: Array<{
  type: ErrorType;
  patterns: RegExp[];
  confidence: number;
}> = [
  {
    type: 'parsing',
    patterns: [
      /parse\s*(fail|error|exception)/i,
      /cannot\s*find\s*module/i,
      /json\s*parse\s*error/i,
      /syntax\s*error/i,
      /unexpected\s*token/i,
      /invalid\s*(json|yaml|xml|html)/i,
      /malformed/i,
      /expected\s*.*but\s*found/i,
      /type\s*error/i,
      /reference\s*error/i,
    ],
    confidence: 0.9,
  },
  {
    type: 'missing_file',
    patterns: [
      /required\s*file.*missing/i,
      /file\s*not\s*found/i,
      /cannot\s*open.*file/i,
      /ENOENT/i,
      /no\s*such\s*file/i,
      /missing\s*artifact/i,
      /output\s*artifact\s*not\s*found/i,
      /artifact.*not\s*found/i,
      /missing\s+file/i,
    ],
    confidence: 0.85,
  },
  {
    type: 'content_quality',
    patterns: [
      /too\s*short/i,
      /missing\s*required\s*content/i,
      /placeholder/i,
      /incomplete/i,
      /insufficient\s*(detail|content|information)/i,
      /not\s*(comprehensive|detailed|complete)/i,
      /lacking/i,
      /generic/i,
      /vague/i,
      /not\s*found\s*in\s*artifact/i,
      /no.*found.*in/i,
      /lacks?\s+(sufficient|detail|content)/i,
    ],
    confidence: 0.8,
  },
  {
    type: 'constitutional',
    patterns: [
      /constitutional/i,
      /article\s*\d+/i,
      /test-first/i,
      /time\s*estimate/i,
      /violates.*principle/i,
      /forbidden/i,
      /not\s*allowed/i,
      /anti-pattern/i,
      /constitution/i,
    ],
    confidence: 0.95,
  },
];

/**
 * Phase to artifact type mapping
 */
const PHASE_ARTIFACT_MAP: Record<string, string[]> = {
  STACK_SELECTION: ['stack.json', 'architecture-decisions.md'],
  SPEC_PM: ['PRD.md', 'user-stories.md', 'roadmap.md'],
  SPEC_ARCHITECT: ['api-spec.json', 'data-model.md', 'architecture.md'],
  SPEC_DESIGN: ['component-mapping.md', 'journey-maps.md', 'design-tokens.md'],
  FRONTEND_BUILD: ['src/', 'components/', 'app/'],
};

/**
 * Mapping from error types to likely originating phases
 */
const ERROR_TO_PHASE_MAP: Record<ErrorType, string[]> = {
  parsing: ['SPEC_PM', 'SPEC_ARCHITECT', 'SPEC_DESIGN', 'FRONTEND_BUILD'],
  missing_file: ['SPEC_PM', 'SPEC_ARCHITECT', 'SPEC_DESIGN', 'STACK_SELECTION'],
  content_quality: ['SPEC_PM', 'SPEC_ARCHITECT', 'SPEC_DESIGN'],
  constitutional: ['STACK_SELECTION', 'SPEC_PM', 'SPEC_ARCHITECT'],
  unknown: ['VALIDATE'],
};

/**
 * Remediation hints for each error type
 */
const REMEDIATION_HINTS: Record<ErrorType, string> = {
  parsing:
    'Fix syntax errors in the artifact. Validate JSON/YAML/Markdown format and ensure all brackets, braces, and quotes are properly closed.',
  missing_file:
    'Regenerate the missing artifact in the originating phase. Check that the agent properly outputs all required files.',
  content_quality:
    'Regenerate the artifact with more detail and completeness. Add missing sections, expand explanations, and ensure all requirements are covered.',
  constitutional:
    'Review the artifact against constitutional articles. Ensure compliance with test-first approach, time estimates, and other principles.',
  unknown:
    'Manual investigation required. Review the error message and phase context to determine appropriate remediation.',
};

/**
 * LLM prompt template for root cause analysis
 */
const LLM_ANALYSIS_PROMPT = `You are a root cause analyzer for a spec-generation pipeline. 
Given the validation errors and phase history, identify the root cause and suggest remediation.

## Validation Errors:
{{errors}}

## Phase History:
{{phaseHistory}}

## Project Context:
- Project ID: {{projectId}}
- Recent Artifacts: {{artifacts}}

Please analyze and respond with JSON:
{
  "originatingPhase": "PHASE_NAME",
  "errorType": "parsing|content_quality|missing_file|constitutional|unknown",
  "confidence": 0.0-1.0,
  "explanation": "brief explanation of root cause",
  "remediationHint": "specific suggestion for fixing the issue"
}`;

/**
 * Root Cause Analyzer Class
 *
 * Analyzes validation errors to identify the originating phase and error type.
 * Uses pattern matching for simple cases and LLM for complex analysis.
 */
export class RootCauseAnalyzer {
  private llmClient: LLMProvider | null;
  private useLLMForComplex: boolean;

  constructor(llmClient?: LLMProvider, useLLMForComplex = true) {
    this.llmClient = llmClient || null;
    this.useLLMForComplex = useLLMForComplex;
  }

  /**
   * Analyze validation errors to identify root cause
   *
   * @param validationErrors - Array of validation error messages
   * @param phaseHistory - History of phase executions
   * @returns Root cause analysis result
   */
  async analyze(
    validationErrors: string[],
    phaseHistory: PhaseHistoryEntry[]
  ): Promise<RootCauseAnalysis> {
    if (!validationErrors || validationErrors.length === 0) {
      return this.createUnknownAnalysis('No validation errors provided');
    }

    // Combine all errors for analysis
    const combinedErrors = validationErrors.join('\n');

    // Try pattern-based classification first
    const errorType = this.classifyError(combinedErrors);
    const confidence = this.calculateConfidence(errorType, combinedErrors);

    // Identify likely originating phase
    const originatingPhase = this.identifyOriginatingPhase(
      errorType,
      phaseHistory,
      validationErrors
    );

    // Generate explanation and remediation hint
    const explanation = this.generateExplanation(
      errorType,
      originatingPhase,
      validationErrors
    );

    const remediationHint = this.getRemediationHint(
      errorType,
      originatingPhase
    );

    // If LLM is available and confidence is low, use LLM for deeper analysis
    if (
      this.useLLMForComplex &&
      this.llmClient &&
      confidence < 0.8
    ) {
      return this.llmAnalyze(
        validationErrors,
        phaseHistory,
        { errorType, confidence, originatingPhase, explanation, remediationHint }
      );
    }

    return {
      originatingPhase,
      errorType,
      confidence,
      explanation,
      remediationHint,
    };
  }

  /**
   * Classify error type based on patterns
   *
   * @param error - Error message to classify
   * @returns Classified error type
   */
  classifyError(error: string): ErrorType {
    for (const { type, patterns } of ERROR_PATTERNS) {
      for (const pattern of patterns) {
        if (pattern.test(error)) {
          return type;
        }
      }
    }
    return 'unknown';
  }

  /**
   * Identify the originating phase based on error type and phase history
   *
   * @param errorType - Classified error type
   * @param phaseHistory - Phase execution history
   * @param validationErrors - Validation errors
   * @returns Likely originating phase
   */
  identifyOriginatingPhase(
    errorType: ErrorType,
    phaseHistory: PhaseHistoryEntry[],
    validationErrors: string[]
  ): string {
    const possiblePhases = ERROR_TO_PHASE_MAP[errorType] || ['VALIDATE'];

    // Handle undefined or empty phase history
    if (!phaseHistory || phaseHistory.length === 0) {
      return 'VALIDATE';
    }

    // Check phase history for completed phases in reverse order
    const completedPhases = phaseHistory
      .filter((entry) => entry.status === 'completed')
      .reverse();

    for (const entry of completedPhases) {
      if (possiblePhases.includes(entry.phase)) {
        return entry.phase;
      }
    }

    // Try to infer from error message (often contains the artifact name)
    for (const error of validationErrors) {
      for (const [phase, artifacts] of Object.entries(PHASE_ARTIFACT_MAP)) {
        for (const artifact of artifacts) {
          if (error.toLowerCase().includes(artifact.toLowerCase())) {
            return phase;
          }
        }
      }
    }

    // Default to the last completed phase or VALIDATE
    return completedPhases[0]?.phase || 'VALIDATE';
  }

  /**
   * Get remediation hint for an error type
   *
   * @param errorType - Error type
   * @param originatingPhase - Originating phase
   * @returns Remediation hint
   */
  getRemediationHint(errorType: ErrorType, originatingPhase: string): string {
    const baseHint = REMEDIATION_HINTS[errorType] || REMEDIATION_HINTS.unknown;

    // Add phase-specific guidance
    const phaseGuidance: Record<string, string> = {
      STACK_SELECTION: ' Review stack.json for proper technology choices.',
      SPEC_PM: ' Regenerate PRD.md with complete requirements.',
      SPEC_ARCHITECT: ' Synchronize api-spec.json with data-model.md.',
      SPEC_DESIGN: ' Ensure component-mapping.md references valid tokens.',
      FRONTEND_BUILD: ' Check generated TypeScript code for errors.',
    };

    return baseHint + (phaseGuidance[originatingPhase] || '');
  }

  /**
   * Calculate confidence score based on pattern matches
   *
   * @param errorType - Classified error type
   * @param error - Error message
   * @returns Confidence score (0-1)
   */
  private calculateConfidence(
    errorType: ErrorType,
    error: string
  ): number {
    const patternSet = ERROR_PATTERNS.find((p) => p.type === errorType);
    if (!patternSet) return 0.3;

    let matchCount = 0;
    for (const pattern of patternSet.patterns) {
      if (pattern.test(error)) {
        matchCount++;
      }
    }

    // Base confidence adjusted by number of matching patterns
    const baseConfidence = patternSet.confidence;
    const adjustment = Math.min(matchCount * 0.05, 0.15);

    return Math.min(baseConfidence + adjustment, 1.0);
  }

  /**
   * Generate explanation for the root cause
   *
   * @param errorType - Error type
   * @param originatingPhase - Originating phase
   * @param validationErrors - Validation errors
   * @returns Explanation string
   */
  private generateExplanation(
    errorType: ErrorType,
    originatingPhase: string,
    validationErrors: string[]
  ): string {
    const errorCount = validationErrors.length;
    const typeDescriptions: Record<ErrorType, string> = {
      parsing:
        'The artifact contains syntax errors that prevent proper parsing.',
      missing_file:
        'Required artifacts are missing from the generated output.',
      content_quality:
        'The generated content does not meet quality standards.',
      constitutional:
        'The artifact violates one or more constitutional principles.',
      unknown:
        'The error could not be classified into a known error type.',
    };

    let explanation = typeDescriptions[errorType];
    explanation += ` Issue originated from ${originatingPhase} phase.`;

    if (errorCount > 1) {
      explanation += ` ${errorCount} related errors were detected.`;
    }

    return explanation;
  }

  /**
   * Create unknown analysis result
   */
  private createUnknownAnalysis(reason: string): RootCauseAnalysis {
    return {
      originatingPhase: 'VALIDATE',
      errorType: 'unknown',
      confidence: 0.1,
      explanation: `Cannot analyze: ${reason}`,
      remediationHint: REMEDIATION_HINTS.unknown,
    };
  }

  /**
   * Use LLM for deeper analysis of complex errors
   */
  private async llmAnalyze(
    validationErrors: string[],
    phaseHistory: PhaseHistoryEntry[],
    fallback: RootCauseAnalysis
  ): Promise<RootCauseAnalysis> {
    if (!this.llmClient) {
      return fallback;
    }

    try {
      const prompt = this.buildLLMPrompt(validationErrors, phaseHistory);
      const response = await this.llmClient.generateCompletion(prompt, [], 2, 'ANALYST');

      const analysis = this.parseLLMResponse(response.content);
      if (analysis) {
        return analysis;
      }
    } catch (error) {
      console.error('LLM analysis failed, using fallback:', error);
    }

    return fallback;
  }

  /**
   * Build LLM prompt for analysis
   */
  private buildLLMPrompt(
    validationErrors: string[],
    phaseHistory: PhaseHistoryEntry[]
  ): string {
    const projectId = 'current-project';
    const artifacts = phaseHistory
      .flatMap((h) => h.artifacts || [])
      .join(', ') || 'None';

    let prompt = LLM_ANALYSIS_PROMPT;
    prompt = prompt.replace('{{errors}}', validationErrors.join('\n- '));
    prompt = prompt.replace(
      '{{phaseHistory}}',
      phaseHistory.map((h) => `${h.phase}: ${h.status}`).join(', ')
    );
    prompt = prompt.replace('{{projectId}}', projectId);
    prompt = prompt.replace('{{artifacts}}', artifacts);

    return prompt;
  }

  /**
   * Parse LLM response into analysis result
   */
  private parseLLMResponse(content: string): RootCauseAnalysis | null {
    try {
      // Try to extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;

      const parsed = JSON.parse(jsonMatch[0]);

      // Validate required fields
      if (
        !parsed.originatingPhase ||
        !parsed.errorType ||
        parsed.confidence === undefined
      ) {
        return null;
      }

      return {
        originatingPhase: parsed.originatingPhase,
        errorType: parsed.errorType as ErrorType,
        confidence: Math.max(0, Math.min(1, parsed.confidence)),
        explanation: parsed.explanation || 'LLM analysis result',
        remediationHint:
          parsed.remediationHint || REMEDIATION_HINTS.unknown,
      };
    } catch {
      return null;
    }
  }

  /**
   * Batch analyze multiple error sets
   *
   * @param errorSets - Array of error sets with context
   * @returns Array of analysis results
   */
  async batchAnalyze(
    errorSets: Array<{
      errors: string[];
      phaseHistory: PhaseHistoryEntry[];
    }>
  ): Promise<RootCauseAnalysis[]> {
    const results = await Promise.all(
      errorSets.map((set) => this.analyze(set.errors, set.phaseHistory))
    );
    return results;
  }

  /**
   * Check if LLM-based analysis is available
   */
  isLLMAvailable(): boolean {
    return this.llmClient !== null;
  }
}

/**
 * Factory function to create analyzer with optional LLM client
 */
export function createRootCauseAnalyzer(
  llmClient?: LLMProvider
): RootCauseAnalyzer {
  return new RootCauseAnalyzer(llmClient);
}
