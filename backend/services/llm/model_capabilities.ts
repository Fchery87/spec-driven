import { ModelCapability } from '@/types/llm';

/**
 * MODEL_CAPABILITIES Registry
 *
 * This registry defines the output token limits and input context window for each LLM model.
 * When a new model is added, include its capabilities here.
 * The system automatically adjusts phase token allocations based on the model's maxOutputTokens.
 *
 * Data sources:
 * - Gemini: https://ai.google.dev/gemini-api/docs/models
 * - OpenAI: https://platform.openai.com/docs/models
 * - Anthropic: https://docs.anthropic.com/en/docs/about/models/overview
 * - Groq: https://console.groq.com/docs
 * - DeepSeek: https://platform.deepseek.com/docs
 * - Z.ai: https://docs.z.ai/api-reference
 */
export const MODEL_CAPABILITIES: Record<string, ModelCapability> = {
  // ===== GEMINI MODELS =====
  'gemini-3-flash-preview': {
    id: 'gemini-3-flash-preview',
    provider: 'gemini',
    maxOutputTokens: 64000,
    maxInputTokens: 1000000,
    description:
      'Gemini 3 Flash Preview - latest frontier-class performance, supports 64K output tokens',
  },
  'gemini-2.5-flash': {
    id: 'gemini-2.5-flash',
    provider: 'gemini',
    maxOutputTokens: 65536,
    maxInputTokens: 1000000,
    description:
      'Gemini 2.5 Flash - previous generation, supports 65K output tokens',
  },
  'gemini-2.5-pro': {
    id: 'gemini-2.5-pro',
    provider: 'gemini',
    maxOutputTokens: 65536,
    maxInputTokens: 1000000,
    description:
      'Gemini 2.5 Pro - most capable version, supports 65K output tokens',
  },
  'gemini-2.0-flash': {
    id: 'gemini-2.0-flash',
    provider: 'gemini',
    maxOutputTokens: 8192,
    maxInputTokens: 1000000,
    description: 'Gemini 2.0 Flash - stable previous generation',
  },

  // ===== OPENAI MODELS =====
  'gpt-4o': {
    id: 'gpt-4o',
    provider: 'openai',
    maxOutputTokens: 16384,
    maxInputTokens: 128000,
    description: 'GPT-4o - most capable, multimodal OpenAI model',
  },
  'gpt-4o-mini': {
    id: 'gpt-4o-mini',
    provider: 'openai',
    maxOutputTokens: 16384,
    maxInputTokens: 128000,
    description: 'GPT-4o Mini - faster and more affordable variant',
  },
  'gpt-4-turbo': {
    id: 'gpt-4-turbo',
    provider: 'openai',
    maxOutputTokens: 4096,
    maxInputTokens: 128000,
    description: 'GPT-4 Turbo - previous flagship model',
  },
  'gpt-3.5-turbo': {
    id: 'gpt-3.5-turbo',
    provider: 'openai',
    maxOutputTokens: 4096,
    maxInputTokens: 16384,
    description: 'GPT-3.5 Turbo - economical baseline model',
  },

  // ===== ANTHROPIC CLAUDE MODELS =====
  'claude-sonnet-4-20250514': {
    id: 'claude-sonnet-4-20250514',
    provider: 'anthropic',
    maxOutputTokens: 4096,
    maxInputTokens: 200000,
    description: 'Claude Sonnet 4 - latest balanced model',
  },
  'claude-3-5-sonnet-20241022': {
    id: 'claude-3-5-sonnet-20241022',
    provider: 'anthropic',
    maxOutputTokens: 4096,
    maxInputTokens: 200000,
    description: 'Claude 3.5 Sonnet - fast and capable',
  },
  'claude-3-5-haiku-20241022': {
    id: 'claude-3-5-haiku-20241022',
    provider: 'anthropic',
    maxOutputTokens: 1024,
    maxInputTokens: 200000,
    description: 'Claude 3.5 Haiku - fastest, most affordable',
  },
  'claude-3-opus-20240229': {
    id: 'claude-3-opus-20240229',
    provider: 'anthropic',
    maxOutputTokens: 4096,
    maxInputTokens: 200000,
    description: 'Claude 3 Opus - most powerful reasoning',
  },

  // ===== DEEPSEEK MODELS =====
  'deepseek-reasoner': {
    id: 'deepseek-reasoner',
    provider: 'deepseek',
    maxOutputTokens: 65536,
    maxInputTokens: 64000,
    description: 'DeepSeek Reasoner - 64K output for large documents',
  },
  'deepseek-chat': {
    id: 'deepseek-chat',
    provider: 'deepseek',
    maxOutputTokens: 8192,
    maxInputTokens: 64000,
    description: 'DeepSeek Chat - fast and economical',
  },

  // ===== GROQ MODELS =====
  'llama-3.3-70b-versatile': {
    id: 'llama-3.3-70b-versatile',
    provider: 'groq',
    maxOutputTokens: 32768,
    maxInputTokens: 8192,
    description: 'Llama 3.3 70B - most capable, versatile (FREE)',
  },
  'llama-3.1-8b-instant': {
    id: 'llama-3.1-8b-instant',
    provider: 'groq',
    maxOutputTokens: 32768,
    maxInputTokens: 8192,
    description: 'Llama 3.1 8B - fast, efficient (FREE)',
  },
  'llama-3.2-90b-vision-preview': {
    id: 'llama-3.2-90b-vision-preview',
    provider: 'groq',
    maxOutputTokens: 32768,
    maxInputTokens: 8192,
    description: 'Llama 3.2 90B Vision - multimodal (FREE)',
  },
  'mixtral-8x7b-32768': {
    id: 'mixtral-8x7b-32768',
    provider: 'groq',
    maxOutputTokens: 32768,
    maxInputTokens: 32768,
    description: 'Mixtral 8x7B - MoE model, 32k context (FREE)',
  },
  'gemma2-9b-it': {
    id: 'gemma2-9b-it',
    provider: 'groq',
    maxOutputTokens: 32768,
    maxInputTokens: 8192,
    description: 'Gemma 2 9B - Google Gemma (FREE)',
  },

  // ===== Z.AI (GLM) MODELS =====
  'glm-4.7': {
    id: 'glm-4.7',
    provider: 'zai',
    maxOutputTokens: 131072,
    maxInputTokens: 128000,
    description:
      'GLM-4.7 - latest flagship model with 128K output, superior coding and agentic capabilities',
  },
  'glm-4.6': {
    id: 'glm-4.6',
    provider: 'zai',
    maxOutputTokens: 131072,
    maxInputTokens: 128000,
    description: 'GLM-4.6 - flagship model with 128K output',
  },
  'glm-4-plus': {
    id: 'glm-4-plus',
    provider: 'zai',
    maxOutputTokens: 4096,
    maxInputTokens: 128000,
    description: 'GLM-4 Plus - high performance model',
  },
  'glm-4-air': {
    id: 'glm-4-air',
    provider: 'zai',
    maxOutputTokens: 4096,
    maxInputTokens: 128000,
    description: 'GLM-4 Air - balanced performance',
  },
  'glm-4-flash': {
    id: 'glm-4-flash',
    provider: 'zai',
    maxOutputTokens: 4096,
    maxInputTokens: 128000,
    description: 'GLM-4 Flash - most economical',
  },
};

/**
 * Get the maximum output tokens for a specific model
 * @param modelId - The model identifier (e.g., 'gemini-3.0-flash')
 * @returns Maximum output tokens, or 8192 as safe default if unknown
 */
export function getModelMaxOutputTokens(modelId: string): number {
  const capability = MODEL_CAPABILITIES[modelId];
  if (capability) {
    return capability.maxOutputTokens;
  }
  // Safe default for unknown models
  return 8192;
}

/**
 * Get the maximum input tokens (context window) for a specific model
 * @param modelId - The model identifier
 * @returns Maximum input tokens, or 128000 as default
 */
export function getModelMaxInputTokens(modelId: string): number {
  const capability = MODEL_CAPABILITIES[modelId];
  if (capability?.maxInputTokens) {
    return capability.maxInputTokens;
  }
  // Conservative default
  return 128000;
}

/**
 * Get full capability information for a model
 * @param modelId - The model identifier
 * @returns ModelCapability object or undefined if model not found
 */
export function getModelCapability(
  modelId: string
): ModelCapability | undefined {
  return MODEL_CAPABILITIES[modelId];
}

/**
 * List all available models, optionally filtered by provider
 * @param provider - Optional provider name to filter by
 * @returns Array of ModelCapability objects
 */
export function listAvailableModels(provider?: string): ModelCapability[] {
  return Object.values(MODEL_CAPABILITIES).filter(
    (model) => !provider || model.provider === provider
  );
}
