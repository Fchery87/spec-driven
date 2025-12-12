import { LLMResponse, LLMConfigWithOverrides } from '@/types/llm';

export interface LLMProvider {
  generateCompletion(prompt: string, context?: string[], retries?: number, phase?: string): Promise<LLMResponse>;
  testConnection(): Promise<boolean>;
}

export type ProviderType = 'gemini' | 'openai' | 'anthropic' | 'zai' | 'groq';

export interface ProviderConfig extends LLMConfigWithOverrides {
  provider: ProviderType;
}

export const PROVIDER_MODELS: Record<ProviderType, { id: string; name: string; description: string }[]> = {
  gemini: [
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: 'Fast, efficient for most tasks' },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: 'Most capable, higher quality' },
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', description: 'Previous generation, stable' },
  ],
  openai: [
    { id: 'gpt-4o', name: 'GPT-4o', description: 'Most capable, multimodal' },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Fast and affordable' },
    { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', description: 'Previous flagship model' },
    { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', description: 'Fast and economical' },
  ],
  anthropic: [
    { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', description: 'Latest balanced model' },
    { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', description: 'Fast and capable' },
    { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', description: 'Fastest, most affordable' },
    { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', description: 'Most powerful' },
  ],
  zai: [
    { id: 'glm-4.6', name: 'GLM-4.6', description: 'Latest flagship model' },
    { id: 'glm-4-plus', name: 'GLM-4 Plus', description: 'High performance model' },
    { id: 'glm-4-air', name: 'GLM-4 Air', description: 'Balanced performance' },
    { id: 'glm-4-flash', name: 'GLM-4 Flash', description: 'Most economical' },
  ],
  groq: [
    { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', description: 'Most capable, versatile (FREE)' },
    { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B', description: 'Fast, efficient (FREE)' },
    { id: 'llama-3.2-90b-vision-preview', name: 'Llama 3.2 90B Vision', description: 'Multimodal (FREE)' },
    { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', description: 'MoE model, 32k context (FREE)' },
    { id: 'gemma2-9b-it', name: 'Gemma 2 9B', description: 'Google Gemma (FREE)' },
  ],
};

export const PROVIDER_INFO: Record<ProviderType, { name: string; envKey: string; docsUrl: string }> = {
  gemini: {
    name: 'Google Gemini',
    envKey: 'GEMINI_API_KEY',
    docsUrl: 'https://ai.google.dev/docs',
  },
  openai: {
    name: 'OpenAI',
    envKey: 'OPENAI_API_KEY',
    docsUrl: 'https://platform.openai.com/docs',
  },
  anthropic: {
    name: 'Anthropic Claude',
    envKey: 'ANTHROPIC_API_KEY',
    docsUrl: 'https://docs.anthropic.com',
  },
  zai: {
    name: 'Z.ai GLM',
    envKey: 'ZAI_API_KEY',
    docsUrl: 'https://docs.z.ai/api-reference/introduction',
  },
  groq: {
    name: 'Groq (FREE)',
    envKey: 'GROQ_API_KEY',
    docsUrl: 'https://console.groq.com/docs',
  },
};
