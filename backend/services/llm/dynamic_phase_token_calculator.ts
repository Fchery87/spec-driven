import { DynamicPhaseOverride, PhaseTokenConfig } from '@/types/llm';
import { getModelMaxOutputTokens } from './model_capabilities';
import { logger } from '@/lib/logger';

/**
 * DYNAMIC PHASE TOKEN CALCULATOR
 *
 * Automatically adjusts phase token limits based on the LLM model's maximum output capability.
 *
 * When a new LLM model is added:
 * 1. Add it to MODEL_CAPABILITIES in model_capabilities.ts
 * 2. This calculator automatically scales all phase allocations to that model's output limit
 * 3. No manual phase configuration needed for the new model
 *
 * Supported configuration modes:
 * - Percentage-based: Each phase gets a percentage of the model's max output tokens
 * - Absolute: Legacy mode with fixed token counts per phase
 * - Hybrid: Mix of percentage-based and absolute with min/max bounds
 */
export class DynamicPhaseTokenCalculator {
  /**
   * Default phase allocation percentages
   * These percentages are applied to the model's maxOutputTokens to get actual phase limits
   */
  private static readonly DEFAULT_PHASE_PERCENTAGES: Record<string, number> = {
    ANALYSIS: 50, // 50% of model's max output
    STACK_SELECTION: 25, // 25% of model's max output
    SPEC: 75, // 75% of model's max output (comprehensive specs)
    DEPENDENCIES: 37, // 37% of model's max output
    SOLUTIONING: 100, // 100% of model's max output (uses full capability)
    VALIDATE: 50, // 50% of model's max output
    DONE: 50, // 50% of model's max output
  };

  /**
   * Calculate effective phase token limits based on model capability
   *
   * Algorithm:
   * 1. If phase config has absolute max_tokens, use it (legacy mode)
   * 2. If phase config has percentageAllocation, calculate: (maxOutputTokens * percentage / 100)
   * 3. Apply minTokens bound (ensure minimum quality)
   * 4. Apply maxTokensCap bound (prevent excessive allocation)
   * 5. Log the calculation for debugging
   *
   * @param modelId - The LLM model identifier (e.g., 'gemini-3.0-flash')
   * @param phaseOverrides - Phase-specific token configuration
   * @returns Record of phase names to calculated max_tokens
   */
  public static calculatePhaseTokenLimits(
    modelId: string,
    phaseOverrides?: Record<string, DynamicPhaseOverride>
  ): Record<string, number> {
    const modelMaxTokens = getModelMaxOutputTokens(modelId);
    const phaseLimits: Record<string, number> = {};

    logger.info('[DynamicPhaseTokenCalculator] Calculating phase token limits', {
      modelId,
      modelMaxOutputTokens: modelMaxTokens,
      hasPhaseOverrides: !!phaseOverrides,
    });

    const phases = [
      'ANALYSIS',
      'STACK_SELECTION',
      'SPEC',
      'DEPENDENCIES',
      'SOLUTIONING',
      'VALIDATE',
      'DONE',
    ];

    for (const phase of phases) {
      const phaseConfig = phaseOverrides?.[phase];

      // Priority 1: Use explicit absolute max_tokens if provided (legacy mode)
      if (phaseConfig?.max_tokens) {
        phaseLimits[phase] = phaseConfig.max_tokens;
        logger.debug(`[${phase}] Using explicit max_tokens`, {
          value: phaseConfig.max_tokens,
        });
        continue;
      }

      // Priority 2: Calculate from percentageAllocation if provided
      let calculatedTokens = modelMaxTokens;
      const percentage =
        phaseConfig?.percentageAllocation ??
        this.DEFAULT_PHASE_PERCENTAGES[phase] ??
        50; // Default to 50% if not specified

      calculatedTokens = Math.floor((modelMaxTokens * percentage) / 100);

      // Apply minTokens bound
      if (phaseConfig?.minTokens) {
        calculatedTokens = Math.max(calculatedTokens, phaseConfig.minTokens);
        logger.debug(`[${phase}] Applied minTokens bound`, {
          before: Math.floor((modelMaxTokens * percentage) / 100),
          after: calculatedTokens,
          minTokens: phaseConfig.minTokens,
        });
      }

      // Apply maxTokensCap bound
      if (phaseConfig?.maxTokensCap) {
        calculatedTokens = Math.min(calculatedTokens, phaseConfig.maxTokensCap);
        logger.debug(`[${phase}] Applied maxTokensCap bound`, {
          before: Math.floor((modelMaxTokens * percentage) / 100),
          after: calculatedTokens,
          maxTokensCap: phaseConfig.maxTokensCap,
        });
      }

      phaseLimits[phase] = calculatedTokens;

      logger.debug(`[${phase}] Dynamic calculation result`, {
        percentage,
        modelMaxTokens,
        calculatedTokens,
      });
    }

    logger.info('[DynamicPhaseTokenCalculator] Phase token limits calculated', {
      modelId,
      phaseLimits,
    });

    return phaseLimits;
  }

  /**
   * Get the calculated max_tokens for a specific phase
   *
   * @param modelId - The LLM model identifier
   * @param phase - The phase name (ANALYSIS, SPEC, SOLUTIONING, etc.)
   * @param phaseOverrides - Phase-specific configuration
   * @returns Maximum tokens for this phase
   */
  public static getPhaseTokenLimit(
    modelId: string,
    phase: string,
    phaseOverrides?: Record<string, DynamicPhaseOverride>
  ): number {
    const limits = this.calculatePhaseTokenLimits(modelId, phaseOverrides);
    return limits[phase] ?? 8192; // Safe default
  }

  /**
   * Convert legacy absolute max_tokens to percentage allocation
   * Useful for migration from static to dynamic configuration
   *
   * Example: If a phase had max_tokens: 48000 with a Gemini 2.5 model (65536 max),
   * this would return ~73% allocation
   *
   * @param absoluteTokens - The absolute token count
   * @param referenceModelId - Model to use as reference for percentage calculation
   * @returns Percentage allocation (0-100)
   */
  public static convertAbsoluteToPercentage(
    absoluteTokens: number,
    referenceModelId: string
  ): number {
    const modelMax = getModelMaxOutputTokens(referenceModelId);
    return Math.round((absoluteTokens / modelMax) * 100);
  }

  /**
   * Get the default percentage allocation for a phase
   * @param phase - The phase name
   * @returns Default percentage allocation (0-100)
   */
  public static getDefaultPercentageForPhase(phase: string): number {
    return this.DEFAULT_PHASE_PERCENTAGES[phase] ?? 50;
  }

  /**
   * Validate phase override configuration
   * @param phaseOverrides - Configuration to validate
   * @returns Array of validation errors (empty if valid)
   */
  public static validatePhaseOverrides(
    phaseOverrides?: Record<string, DynamicPhaseOverride>
  ): string[] {
    const errors: string[] = [];

    if (!phaseOverrides) {
      return errors;
    }

    for (const [phase, config] of Object.entries(phaseOverrides)) {
      // Validate that either max_tokens or percentageAllocation is present
      if (!config.max_tokens && !config.percentageAllocation) {
        errors.push(`Phase ${phase} has neither max_tokens nor percentageAllocation`);
      }

      // Validate percentage range
      if (config.percentageAllocation !== undefined) {
        if (config.percentageAllocation < 0 || config.percentageAllocation > 100) {
          errors.push(`Phase ${phase} percentageAllocation must be between 0 and 100`);
        }
      }

      // Validate minTokens < maxTokensCap
      if (config.minTokens && config.maxTokensCap) {
        if (config.minTokens > config.maxTokensCap) {
          errors.push(
            `Phase ${phase} minTokens (${config.minTokens}) exceeds maxTokensCap (${config.maxTokensCap})`
          );
        }
      }

      // Validate temperature range
      if (config.temperature !== undefined) {
        if (config.temperature < 0 || config.temperature > 2) {
          errors.push(`Phase ${phase} temperature must be between 0 and 2`);
        }
      }

      // Validate top_p range
      if (config.top_p !== undefined) {
        if (config.top_p < 0 || config.top_p > 1) {
          errors.push(`Phase ${phase} top_p must be between 0 and 1`);
        }
      }
    }

    return errors;
  }

  /**
   * Generate a summary of phase allocations for logging/debugging
   * @param modelId - The LLM model identifier
   * @param phaseOverrides - Phase-specific configuration
   * @returns Human-readable summary
   */
  public static generateSummary(
    modelId: string,
    phaseOverrides?: Record<string, DynamicPhaseOverride>
  ): string {
    const modelMaxTokens = getModelMaxOutputTokens(modelId);
    const limits = this.calculatePhaseTokenLimits(modelId, phaseOverrides);

    let summary = `\n=== Dynamic Phase Token Allocation (Model: ${modelId}) ===\n`;
    summary += `Model Max Output: ${modelMaxTokens} tokens\n\n`;

    for (const [phase, tokens] of Object.entries(limits)) {
      const percentage = ((tokens / modelMaxTokens) * 100).toFixed(1);
      summary += `${phase.padEnd(15)} ${String(tokens).padStart(6)} tokens (${percentage}%)\n`;
    }

    return summary;
  }
}
