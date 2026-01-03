/**
 * MODEL PARAMETER PRESETS
 *
 * Defines optimal generation parameters for each LLM model based on industry research
 * and provider recommendations. These presets automatically populate the admin dashboard
 * Generation Parameters section when a model is selected.
 *
 * Parameters included:
 * - temperature: Controls randomness/creativity (0-2 range depending on provider)
 * - timeout: Request timeout in seconds
 * - topP: Nucleus sampling parameter (0-1)
 * - frequencyPenalty: Reduces repetition (optional)
 * - presencePenalty: Encourages diversity (optional)
 *
 * Source: Research findings from OpenAI, Anthropic, Google Gemini documentation
 * and industry best practices for optimal LLM generation.
 */

export type ProviderType =
  | 'gemini'
  | 'openai'
  | 'anthropic'
  | 'zai'
  | 'groq'
  | 'deepseek';

export interface ModelPreset {
  temperature: number;
  timeout: number; // seconds
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  recommendedUseCase?: string;
  provider: ProviderType;
  maxOutputTokens: number;
}

/**
 * Model parameter presets based on:
 * 1. Provider documentation and API defaults
 * 2. Industry research findings
 * 3. Optimal parameter ranges for different use cases
 * 4. Model-specific capabilities and constraints
 */
export const MODEL_PARAMETER_PRESETS: Record<string, ModelPreset> = {
  // ============================================================================
  // GOOGLE GEMINI MODELS (Temperature: 0-2.0, Supports TopP adjustment)
  // ============================================================================
  'gemini-3-flash-preview': {
    provider: 'gemini',
    temperature: 0.7, // Balanced creativity & accuracy
    timeout: 180, // Fast model, reasonable timeout
    topP: 0.95,
    frequencyPenalty: 0.0,
    presencePenalty: 0.0,
    recommendedUseCase:
      'Latest frontier-class performance, visual and spatial reasoning',
    maxOutputTokens: 65500,
  },

  'gemini-2.5-flash': {
    provider: 'gemini',
    temperature: 0.7,
    timeout: 150,
    topP: 0.95,
    frequencyPenalty: 0.0,
    presencePenalty: 0.0,
    recommendedUseCase: 'Fast, efficient for most tasks',
    maxOutputTokens: 65500,
  },

  'gemini-2.5-pro': {
    provider: 'gemini',
    temperature: 0.7, // Slightly creative for more capable model
    timeout: 180,
    topP: 0.95,
    frequencyPenalty: 0.0,
    presencePenalty: 0.0,
    recommendedUseCase: 'High-quality outputs, complex reasoning',
    maxOutputTokens: 65500,
  },

  'gemini-2.0-flash': {
    provider: 'gemini',
    temperature: 0.7,
    timeout: 150,
    topP: 0.95,
    frequencyPenalty: 0.0,
    presencePenalty: 0.0,
    recommendedUseCase: 'Previous generation, stable and proven',
    maxOutputTokens: 8192,
  },

  // ============================================================================
  // OPENAI MODELS (Temperature: 0-2.0, Special handling for TopP)
  // Note: OpenAI recommends NOT adjusting both temperature and top_p simultaneously
  // ============================================================================
  'gpt-4o': {
    provider: 'openai',
    temperature: 1.0, // OpenAI default
    timeout: 180,
    topP: 1.0, // Don't adjust with temperature
    recommendedUseCase: 'Most capable, multimodal, complex reasoning',
    maxOutputTokens: 16384,
  },

  'gpt-4o-mini': {
    provider: 'openai',
    temperature: 1.0,
    timeout: 120, // Faster than 4o
    topP: 1.0,
    recommendedUseCase: 'Fast and affordable, good for most tasks',
    maxOutputTokens: 16384,
  },

  'gpt-4-turbo': {
    provider: 'openai',
    temperature: 1.0,
    timeout: 180,
    topP: 1.0,
    recommendedUseCase: 'Previous flagship, stable and proven',
    maxOutputTokens: 4096,
  },

  'gpt-3.5-turbo': {
    provider: 'openai',
    temperature: 1.0,
    timeout: 120,
    topP: 1.0,
    recommendedUseCase: 'Fast and economical',
    maxOutputTokens: 4096,
  },

  // ============================================================================
  // ANTHROPIC CLAUDE MODELS (Temperature: 0-1.0 ONLY - Max is 1.0)
  // Important: Claude does NOT support temperature > 1.0
  // ============================================================================
  'claude-sonnet-4-20250514': {
    provider: 'anthropic',
    temperature: 0.7, // Balanced (Claude max is 1.0)
    timeout: 180,
    topP: undefined, // Don't adjust with temperature
    recommendedUseCase: 'Latest, balanced model for most uses',
    maxOutputTokens: 4096,
  },

  'claude-3-5-sonnet-20241022': {
    provider: 'anthropic',
    temperature: 0.7,
    timeout: 180,
    topP: undefined,
    recommendedUseCase: 'Fast and capable, excellent balance',
    maxOutputTokens: 4096,
  },

  'claude-3-5-haiku-20241022': {
    provider: 'anthropic',
    temperature: 0.7,
    timeout: 120, // Fast model
    topP: undefined,
    recommendedUseCase: 'Fastest, most affordable, great for simple tasks',
    maxOutputTokens: 1024,
  },

  'claude-3-opus-20240229': {
    provider: 'anthropic',
    temperature: 0.7,
    timeout: 240, // Can take longer for complex tasks
    topP: undefined,
    recommendedUseCase: 'Most powerful, best for complex reasoning',
    maxOutputTokens: 4096,
  },

  // ============================================================================
  // Z.AI GLM MODELS (Temperature: 0-2.0)
  // ============================================================================
  'glm-4.6': {
    provider: 'zai',
    temperature: 0.7,
    timeout: 180,
    topP: 0.95,
    recommendedUseCase: 'Latest flagship model',
    maxOutputTokens: 4096,
  },

  'glm-4-plus': {
    provider: 'zai',
    temperature: 0.7,
    timeout: 180,
    topP: 0.95,
    recommendedUseCase: 'High performance model',
    maxOutputTokens: 4096,
  },

  'glm-4-air': {
    provider: 'zai',
    temperature: 0.7,
    timeout: 150,
    topP: 0.95,
    recommendedUseCase: 'Balanced performance',
    maxOutputTokens: 4096,
  },

  'glm-4-flash': {
    provider: 'zai',
    temperature: 0.7,
    timeout: 120,
    topP: 0.95,
    recommendedUseCase: 'Most economical',
    maxOutputTokens: 4096,
  },

  // ============================================================================
  // GROQ MODELS (Free! Temperature: 0-2.0)
  // ============================================================================
  'llama-3.3-70b-versatile': {
    provider: 'groq',
    temperature: 0.7,
    timeout: 120, // Groq is very fast
    topP: 0.95,
    recommendedUseCase: 'Most capable free model, versatile',
    maxOutputTokens: 32768,
  },

  'llama-3.1-8b-instant': {
    provider: 'groq',
    temperature: 0.7,
    timeout: 60, // Very fast
    topP: 0.95,
    recommendedUseCase: 'Fast and efficient, great for quick tasks',
    maxOutputTokens: 8192,
  },

  'llama-3.2-90b-vision-preview': {
    provider: 'groq',
    temperature: 0.7,
    timeout: 120,
    topP: 0.95,
    recommendedUseCase: 'Multimodal support, vision capabilities',
    maxOutputTokens: 32768,
  },

  'mixtral-8x7b-32768': {
    provider: 'groq',
    temperature: 0.7,
    timeout: 120,
    topP: 0.95,
    recommendedUseCase: 'Mixture of experts, large context window',
    maxOutputTokens: 32768,
  },

  'gemma2-9b-it': {
    provider: 'groq',
    temperature: 0.7,
    timeout: 100,
    topP: 0.95,
    recommendedUseCase: 'Google Gemma, instruction-tuned',
    maxOutputTokens: 8192,
  },

  // ============================================================================
  // DEEPSEEK MODELS (Temperature: 0-2.0)
  // ============================================================================
  'deepseek-reasoner': {
    provider: 'deepseek',
    temperature: 0.7,
    timeout: 300, // Reasoning models take longer
    topP: 0.95,
    recommendedUseCase: 'Best for large documents, deep reasoning (64K output)',
    maxOutputTokens: 65536,
  },

  'deepseek-chat': {
    provider: 'deepseek',
    temperature: 0.7,
    timeout: 120, // Faster than reasoner
    topP: 0.95,
    recommendedUseCase: 'Fast and cheap, practical tasks',
    maxOutputTokens: 8192,
  },
};

/**
 * Get the preset for a specific model
 * @param modelId - The model identifier (e.g., 'gemini-3.0-flash')
 * @returns ModelPreset or undefined if model not found
 */
export function getModelPreset(modelId: string): ModelPreset | undefined {
  return MODEL_PARAMETER_PRESETS[modelId];
}

/**
 * Get all models for a specific provider
 * @param provider - The provider type (gemini, openai, etc.)
 * @returns Array of model IDs for that provider
 */
export function getModelsForProvider(provider: ProviderType): string[] {
  return Object.entries(MODEL_PARAMETER_PRESETS)
    .filter(([_, preset]) => preset.provider === provider)
    .map(([modelId]) => modelId);
}

/**
 * Get all available model presets
 * @returns Object with all model presets
 */
export function getAllModelPresets(): Record<string, ModelPreset> {
  return MODEL_PARAMETER_PRESETS;
}

/**
 * Validate that a model has a preset defined
 * @param modelId - The model identifier
 * @returns true if model has preset, false otherwise
 */
export function hasModelPreset(modelId: string): boolean {
  return modelId in MODEL_PARAMETER_PRESETS;
}

/**
 * Get temperature range for a provider
 * @param provider - The provider type
 * @returns [min, max] temperature range
 */
export function getTemperatureRange(provider: ProviderType): [number, number] {
  switch (provider) {
    case 'anthropic':
      return [0, 1]; // Claude max is 1.0
    case 'gemini':
    case 'openai':
    case 'zai':
    case 'groq':
    case 'deepseek':
      return [0, 2];
    default:
      return [0, 1];
  }
}

/**
 * Get constraints for a model
 * @param modelId - The model identifier
 * @returns Model constraints or undefined
 */
export function getModelConstraints(modelId: string):
  | {
      provider: ProviderType;
      temperatureRange: [number, number];
      maxOutputTokens: number;
      supportsTopP: boolean;
      supportsFrequencyPenalty: boolean;
      supportsPresencePenalty: boolean;
    }
  | undefined {
  const preset = getModelPreset(modelId);
  if (!preset) return undefined;

  return {
    provider: preset.provider,
    temperatureRange: getTemperatureRange(preset.provider),
    maxOutputTokens: preset.maxOutputTokens,
    supportsTopP: true, // All our models support TopP
    supportsFrequencyPenalty: preset.frequencyPenalty !== undefined,
    supportsPresencePenalty: preset.presencePenalty !== undefined,
  };
}
