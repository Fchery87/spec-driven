/**
 * LLM Parameter Resolution API Endpoint
 *
 * GET /api/admin/llm-parameters?model=gemini-3.0-flash&phase=SOLUTIONING
 *
 * Returns optimal generation parameters for a selected LLM model.
 * Includes temperature, timeout, max tokens, and phase token allocations.
 *
 * Response includes:
 * - Resolved parameters (temperature, timeout, maxTokens, topP, etc.)
 * - Calculation details showing how parameters were determined
 * - Phase token allocations from DynamicPhaseTokenCalculator
 * - Applied constraints and validation warnings
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/app/api/middleware/auth-guard';
import { ModelParameterResolver, getParameterCacheStats } from '@/backend/services/llm/model_parameter_resolver';
import { logger } from '@/lib/logger';

interface LLMParametersResponse {
  success: boolean;
  data?: {
    temperature: number;
    maxTokens: number;
    timeout: number;
    topP?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
    source: 'preset' | 'override';
    appliedPhase?: string;
    calculationDetails: {
      modelId: string;
      provider: string;
      modelMaxTokens: number;
      baseTemperature: number;
      phaseTemperatureAdjustment?: number;
      finalTemperature: number;
      timeoutSeconds: number;
      topP?: number;
      appliedConstraints: string[];
      validationErrors: string[];
    };
    phaseAllocations?: Record<string, { tokens: number; percentage: string }>;
  };
  cacheStats?: {
    hits: number;
    misses: number;
    hitRate: number;
    size: number;
  };
  error?: string;
}

export const GET = withAdminAuth(async (req: NextRequest) => {
  try {
    const { searchParams } = new URL(req.url);
    const modelId = searchParams.get('model');
    const phase = searchParams.get('phase') || undefined;
    const includeCache = searchParams.get('cache') === 'true';

    // Validate model ID is provided
    if (!modelId || typeof modelId !== 'string' || modelId.trim() === '') {
      logger.warn('[LLM Parameters API] Missing or invalid model parameter', { modelId });
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required parameter: model',
        },
        { status: 400 }
      );
    }

    logger.info('[LLM Parameters API] Resolving parameters', {
      modelId,
      phase,
    });

    // Resolve optimal parameters for the model
    const resolved = ModelParameterResolver.resolveOptimalParameters(modelId, phase);

    // Get phase token allocations for transparency
    const phaseAllocations = ModelParameterResolver.getPhaseTokenAllocations(modelId);

    const response: LLMParametersResponse = {
      success: true,
      data: {
        temperature: resolved.temperature,
        maxTokens: resolved.maxTokens,
        timeout: resolved.timeout,
        topP: resolved.topP,
        frequencyPenalty: resolved.frequencyPenalty,
        presencePenalty: resolved.presencePenalty,
        source: resolved.source,
        appliedPhase: resolved.appliedPhase,
        calculationDetails: resolved.calculationDetails,
        phaseAllocations,
      },
    };

    // Include cache stats if requested (useful for monitoring)
    if (includeCache) {
      response.cacheStats = getParameterCacheStats();
    }

    logger.info('[LLM Parameters API] Parameters resolved successfully', {
      modelId,
      phase,
      temperature: resolved.temperature,
      timeout: resolved.timeout,
      maxTokens: resolved.maxTokens,
    });

    return NextResponse.json(response);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('[LLM Parameters API] Error resolving parameters', error instanceof Error ? error : new Error(errorMessage), {
      url: req.url,
    });

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
});

/**
 * POST - Validate parameters for a model
 * Useful for form validation in admin dashboard
 *
 * Body: {
 *   modelId: string,
 *   temperature?: number,
 *   maxTokens?: number,
 *   timeout?: number,
 *   topP?: number,
 *   frequencyPenalty?: number,
 *   presencePenalty?: number
 * }
 */
export const POST = withAdminAuth(async (req: NextRequest) => {
  try {
    const body = await req.json();
    const { modelId, ...parameters } = body;

    if (!modelId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required field: modelId',
        },
        { status: 400 }
      );
    }

    logger.info('[LLM Parameters API] Validating parameters', {
      modelId,
      hasParameters: Object.keys(parameters).length > 0,
    });

    // Validate parameters
    const validationErrors = ModelParameterResolver.validateParameters(modelId, parameters);

    if (validationErrors.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Parameter validation failed',
          validationErrors,
        },
        { status: 400 }
      );
    }

    // If validation passes, resolve with overrides to show final result
    const resolved = ModelParameterResolver.resolveOptimalParameters(modelId, undefined, parameters);

    return NextResponse.json(
      {
        success: true,
        data: {
          temperature: resolved.temperature,
          maxTokens: resolved.maxTokens,
          timeout: resolved.timeout,
          topP: resolved.topP,
          frequencyPenalty: resolved.frequencyPenalty,
          presencePenalty: resolved.presencePenalty,
          source: resolved.source,
          calculationDetails: resolved.calculationDetails,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('[LLM Parameters API] POST error', error instanceof Error ? error : new Error(errorMessage));

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
});
