/**
 * MODEL PARAMETER RESOLVER
 *
 * Automatically resolves optimal generation parameters for any LLM model.
 * Integrates with the DynamicPhaseTokenCalculator to provide complete
 * parameter configuration for the admin dashboard.
 *
 * Features:
 * - Automatic parameter population based on model selection
 * - Smart caching for performance
 * - Validation against model constraints
 * - Integration with existing phase override system
 * - Full transparency with calculation details
 */

import { logger } from '@/lib/logger';
import {
  MODEL_PARAMETER_PRESETS,
  getModelPreset,
  getTemperatureRange,
  getModelConstraints,
  ProviderType,
} from './model_parameter_presets';
import { DynamicPhaseTokenCalculator } from './dynamic_phase_token_calculator';
import { getModelMaxOutputTokens } from './model_capabilities';

export interface ResolvedParameters {
  temperature: number;
  maxTokens: number;
  timeout: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  source: 'preset' | 'override';
  appliedPhase?: string;
  calculationDetails: CalculationDetails;
}

export interface CalculationDetails {
  modelId: string;
  provider: ProviderType;
  modelMaxTokens: number;
  baseTemperature: number;
  phaseTemperatureAdjustment?: number;
  finalTemperature: number;
  timeoutSeconds: number;
  topP?: number;
  appliedConstraints: string[];
  validationErrors: string[];
}

export interface ParameterOverrides {
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
}

/**
 * In-memory cache for resolved parameters
 * Invalidated when model selection changes or orchestrator_spec.yml is updated
 */
class ParameterCache {
  private cache: Map<string, ResolvedParameters> = new Map();
  private cacheHits = 0;
  private cacheMisses = 0;

  get(modelId: string): ResolvedParameters | null {
    const cached = this.cache.get(modelId);
    if (cached) {
      this.cacheHits++;
    } else {
      this.cacheMisses++;
    }
    return cached ?? null;
  }

  set(modelId: string, params: ResolvedParameters): void {
    this.cache.set(modelId, params);
  }

  invalidate(modelId: string): void {
    this.cache.delete(modelId);
  }

  clear(): void {
    this.cache.clear();
    logger.info('[ParameterCache] Cache cleared');
  }

  getStats(): { hits: number; misses: number; hitRate: number; size: number } {
    const total = this.cacheHits + this.cacheMisses;
    return {
      hits: this.cacheHits,
      misses: this.cacheMisses,
      hitRate: total > 0 ? (this.cacheHits / total) * 100 : 0,
      size: this.cache.size,
    };
  }
}

const parameterCache = new ParameterCache();

/**
 * ModelParameterResolver - Main class for resolving optimal LLM parameters
 */
export class ModelParameterResolver {
  /**
   * Resolve optimal parameters for a model
   *
   * @param modelId - The LLM model identifier (e.g., 'gemini-3.0-flash')
   * @param phase - Optional phase name for phase-specific adjustments (ANALYSIS, SPEC, SOLUTIONING, etc.)
   * @param overrides - Optional parameter overrides from user
   * @returns ResolvedParameters with complete configuration and calculation details
   */
  static resolveOptimalParameters(
    modelId: string,
    phase?: string,
    overrides?: ParameterOverrides
  ): ResolvedParameters {
    // Check cache first (only for non-overridden requests)
    if (!overrides) {
      const cached = parameterCache.get(modelId);
      if (cached) {
        logger.debug('[ModelParameterResolver] Cache hit', {
          modelId,
          phase,
        });
        return cached;
      }
    }

    logger.debug('[ModelParameterResolver] Resolving parameters', {
      modelId,
      phase,
      hasOverrides: !!overrides,
    });

    const validationErrors: string[] = [];
    const appliedConstraints: string[] = [];

    // Step 1: Get model preset
    const preset = getModelPreset(modelId);
    if (!preset) {
      validationErrors.push(`Model ${modelId} not found in parameter presets`);
      logger.error('[ModelParameterResolver] Model not found', { modelId });
      throw new Error(`Model ${modelId} not found in parameter presets`);
    }

    // Step 2: Get model constraints
    const constraints = getModelConstraints(modelId);
    if (!constraints) {
      validationErrors.push(`Could not retrieve constraints for model ${modelId}`);
      throw new Error(`Could not retrieve constraints for model ${modelId}`);
    }

    // Step 3: Resolve temperature
    let baseTemperature = preset.temperature;
    let phaseTemperatureAdjustment: number | undefined;
    let finalTemperature = baseTemperature;

    // Apply phase-specific temperature adjustments if needed
    if (phase) {
      const phaseTemp = this.getPhaseTemperatureAdjustment(modelId, phase);
      if (phaseTemp !== undefined && phaseTemp !== baseTemperature) {
        phaseTemperatureAdjustment = phaseTemp;
        finalTemperature = phaseTemp;
        appliedConstraints.push(`Applied phase-specific temperature for ${phase}`);
      }
    }

    // Apply temperature override if provided
    if (overrides?.temperature !== undefined) {
      finalTemperature = overrides.temperature;
      appliedConstraints.push(`Applied user temperature override`);
    }

    // Validate temperature is within range
    const [minTemp, maxTemp] = getTemperatureRange(preset.provider);
    if (finalTemperature < minTemp || finalTemperature > maxTemp) {
      validationErrors.push(
        `Temperature ${finalTemperature} out of range [${minTemp}, ${maxTemp}] for ${preset.provider}`
      );
      // Clamp to valid range
      finalTemperature = Math.max(minTemp, Math.min(maxTemp, finalTemperature));
      appliedConstraints.push(`Clamped temperature to valid range [${minTemp}, ${maxTemp}]`);
    }

    // Step 4: Resolve max tokens
    let maxTokens: number;
    if (overrides?.maxTokens !== undefined) {
      maxTokens = overrides.maxTokens;
      appliedConstraints.push(`Applied user max_tokens override`);
    } else {
      // Use model's maximum output tokens as default
      maxTokens = getModelMaxOutputTokens(modelId);
      appliedConstraints.push(`Using model max output tokens: ${maxTokens}`);
    }

    // Validate max tokens doesn't exceed model limit
    if (maxTokens > constraints.maxOutputTokens) {
      validationErrors.push(
        `Max tokens ${maxTokens} exceeds model limit ${constraints.maxOutputTokens}`
      );
      maxTokens = constraints.maxOutputTokens;
      appliedConstraints.push(`Clamped max_tokens to model limit: ${maxTokens}`);
    }

    // Step 5: Resolve timeout
    let timeout = overrides?.timeout ?? preset.timeout;
    if (timeout < 30) {
      validationErrors.push(`Timeout ${timeout}s is below minimum 30s`);
      timeout = 30;
      appliedConstraints.push(`Clamped timeout to minimum: 30s`);
    }
    if (timeout > 600) {
      validationErrors.push(`Timeout ${timeout}s exceeds maximum 600s`);
      timeout = 600;
      appliedConstraints.push(`Clamped timeout to maximum: 600s`);
    }

    // Step 6: Resolve TopP and penalties (avoid adjusting both temp and topP)
    let topP = overrides?.topP ?? preset.topP;
    let frequencyPenalty = overrides?.frequencyPenalty ?? preset.frequencyPenalty;
    let presencePenalty = overrides?.presencePenalty ?? preset.presencePenalty;

    // Check for conflicting parameters
    if (finalTemperature !== baseTemperature && topP !== undefined && topP !== 1.0) {
      validationErrors.push(
        'Both temperature and topP adjusted; recommend adjusting only one for stability'
      );
      appliedConstraints.push('Warning: Both temperature and topP are adjusted');
    }

    // Build the resolved parameters object
    const resolved: ResolvedParameters = {
      temperature: finalTemperature,
      maxTokens,
      timeout,
      topP,
      frequencyPenalty,
      presencePenalty,
      source: overrides ? 'override' : 'preset',
      appliedPhase: phase,
      calculationDetails: {
        modelId,
        provider: preset.provider,
        modelMaxTokens: constraints.maxOutputTokens,
        baseTemperature,
        phaseTemperatureAdjustment,
        finalTemperature,
        timeoutSeconds: timeout,
        topP,
        appliedConstraints,
        validationErrors,
      },
    };

    // Log resolution
    logger.info('[ModelParameterResolver] Parameters resolved', {
      modelId,
      phase,
      temperature: finalTemperature,
      timeout,
      maxTokens,
      validationErrorCount: validationErrors.length,
    });

    // Cache the result (only if no overrides)
    if (!overrides) {
      parameterCache.set(modelId, resolved);
    }

    return resolved;
  }

  /**
   * Get phase-specific temperature adjustment from orchestrator_spec.yml
   * This respects the existing phase override system
   *
   * @param modelId - The model identifier
   * @param phase - The phase name
   * @returns Phase-specific temperature or undefined if using default
   */
  private static getPhaseTemperatureAdjustment(modelId: string, phase: string): number | undefined {
    try {
      // Note: In production, this would read from the loaded orchestrator_spec.yml
      // For now, we just return undefined to use base preset temperature
      // The actual phase overrides are handled by the OrchestratorEngine
      return undefined;
    } catch (error) {
      logger.warn('[ModelParameterResolver] Could not get phase temperature adjustment', {
        modelId,
        phase,
        error: error instanceof Error ? error.message : String(error),
      });
      return undefined;
    }
  }

  /**
   * Validate that parameters are correct for a model
   *
   * @param modelId - The model identifier
   * @param parameters - Parameters to validate
   * @returns Array of validation errors (empty if valid)
   */
  static validateParameters(modelId: string, parameters: ParameterOverrides): string[] {
    const errors: string[] = [];
    const constraints = getModelConstraints(modelId);

    if (!constraints) {
      return [`Model ${modelId} not found`];
    }

    const [minTemp, maxTemp] = getTemperatureRange(constraints.provider);

    if (parameters.temperature !== undefined) {
      if (parameters.temperature < minTemp || parameters.temperature > maxTemp) {
        errors.push(
          `Temperature must be between ${minTemp} and ${maxTemp} for ${constraints.provider}`
        );
      }
    }

    if (parameters.maxTokens !== undefined) {
      if (parameters.maxTokens < 1) {
        errors.push('Max tokens must be at least 1');
      }
      if (parameters.maxTokens > constraints.maxOutputTokens) {
        errors.push(`Max tokens cannot exceed ${constraints.maxOutputTokens}`);
      }
    }

    if (parameters.timeout !== undefined) {
      if (parameters.timeout < 30 || parameters.timeout > 600) {
        errors.push('Timeout must be between 30 and 600 seconds');
      }
    }

    if (parameters.topP !== undefined) {
      if (parameters.topP < 0 || parameters.topP > 1) {
        errors.push('TopP must be between 0 and 1');
      }
    }

    if (parameters.frequencyPenalty !== undefined) {
      if (parameters.frequencyPenalty < -2 || parameters.frequencyPenalty > 2) {
        errors.push('Frequency penalty must be between -2 and 2');
      }
    }

    if (parameters.presencePenalty !== undefined) {
      if (parameters.presencePenalty < -2 || parameters.presencePenalty > 2) {
        errors.push('Presence penalty must be between -2 and 2');
      }
    }

    return errors;
  }

  /**
   * Get phase token allocations from DynamicPhaseTokenCalculator
   * Shows read-only phase token limits for transparency in admin dashboard
   *
   * @param modelId - The model identifier
   * @param phaseOverrides - Phase overrides from orchestrator_spec.yml
   * @returns Record of phase -> allocated tokens
   */
  static getPhaseTokenAllocations(
    modelId: string,
    phaseOverrides?: Record<string, { percentageAllocation?: number; minTokens?: number; maxTokensCap?: number }>
  ): Record<string, { tokens: number; percentage: string }> {
    const limits = DynamicPhaseTokenCalculator.calculatePhaseTokenLimits(modelId, phaseOverrides);
    const modelMax = getModelMaxOutputTokens(modelId);

    const allocations: Record<string, { tokens: number; percentage: string }> = {};
    for (const [phase, tokens] of Object.entries(limits)) {
      const percent = ((tokens / modelMax) * 100).toFixed(1);
      allocations[phase] = {
        tokens,
        percentage: `${percent}%`,
      };
    }

    return allocations;
  }

  /**
   * Clear the parameter cache
   * Call this when orchestrator_spec.yml is updated
   */
  static clearCache(): void {
    parameterCache.clear();
  }

  /**
   * Clear cache for a specific model
   * @param modelId - The model identifier
   */
  static invalidateModelCache(modelId: string): void {
    parameterCache.invalidate(modelId);
    logger.info('[ModelParameterResolver] Cache invalidated for model', { modelId });
  }

  /**
   * Get cache statistics
   * @returns Cache performance metrics
   */
  static getCacheStats(): { hits: number; misses: number; hitRate: number; size: number } {
    return parameterCache.getStats();
  }

  /**
   * Generate a human-readable summary of resolved parameters
   * @param modelId - The model identifier
   * @param resolved - The resolved parameters
   * @returns Formatted summary string
   */
  static generateSummary(modelId: string, resolved: ResolvedParameters): string {
    const preset = getModelPreset(modelId);
    if (!preset) return '';

    let summary = `\n=== LLM Parameter Resolution (Model: ${modelId}) ===\n`;
    summary += `Provider: ${resolved.calculationDetails.provider}\n`;
    summary += `Model Max Output: ${resolved.calculationDetails.modelMaxTokens} tokens\n\n`;

    summary += `GENERATION PARAMETERS\n`;
    summary += `─────────────────────────\n`;
    summary += `Temperature: ${resolved.temperature}`;
    if (resolved.calculationDetails.phaseTemperatureAdjustment) {
      summary += ` (phase override)`;
    }
    summary += `\n`;
    summary += `Max Tokens: ${resolved.maxTokens}\n`;
    summary += `Timeout: ${resolved.timeout}s\n`;
    if (resolved.topP !== undefined) {
      summary += `Top P: ${resolved.topP}\n`;
    }
    if (resolved.frequencyPenalty !== undefined) {
      summary += `Frequency Penalty: ${resolved.frequencyPenalty}\n`;
    }
    if (resolved.presencePenalty !== undefined) {
      summary += `Presence Penalty: ${resolved.presencePenalty}\n`;
    }

    if (resolved.calculationDetails.appliedConstraints.length > 0) {
      summary += `\nAPPLIED CONSTRAINTS\n`;
      summary += `─────────────────────────\n`;
      for (const constraint of resolved.calculationDetails.appliedConstraints) {
        summary += `✓ ${constraint}\n`;
      }
    }

    if (resolved.calculationDetails.validationErrors.length > 0) {
      summary += `\nVALIDATION WARNINGS\n`;
      summary += `─────────────────────────\n`;
      for (const error of resolved.calculationDetails.validationErrors) {
        summary += `⚠ ${error}\n`;
      }
    }

    return summary;
  }
}

/**
 * Export cache functions for use in API routes and orchestrator
 */
export function clearParameterCache(): void {
  ModelParameterResolver.clearCache();
}

export function invalidateModelParameterCache(modelId: string): void {
  ModelParameterResolver.invalidateModelCache(modelId);
}

export function getParameterCacheStats(): { hits: number; misses: number; hitRate: number; size: number } {
  return ModelParameterResolver.getCacheStats();
}
