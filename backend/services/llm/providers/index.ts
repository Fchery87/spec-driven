import { logger } from '@/lib/logger';
import { LLMConfigWithOverrides } from '@/types/llm';
import { LLMProvider, ProviderType, PROVIDER_INFO, PROVIDER_MODELS } from './base';
import { OpenAIClient } from './openai';
import { AnthropicClient } from './anthropic';
import { ZaiClient } from './zhipu';
import { GroqClient } from './groq';
import { GeminiClient } from '../llm_client';

export type { LLMProvider, ProviderType } from './base';
export { PROVIDER_INFO, PROVIDER_MODELS } from './base';

export interface LLMFactoryConfig extends LLMConfigWithOverrides {
  provider: ProviderType;
}

export function createLLMClient(config: LLMFactoryConfig): LLMProvider {
  const provider = config.provider || 'gemini';
  
  logger.info('[LLMFactory] Creating LLM client', {
    provider,
    model: config.model,
    max_tokens: config.max_tokens,
    temperature: config.temperature
  });

  switch (provider) {
    case 'openai':
      return new OpenAIClient(config);
    
    case 'anthropic':
      return new AnthropicClient(config);
    
    case 'zai':
      return new ZaiClient(config);
    
    case 'groq':
      return new GroqClient(config);
    
    case 'gemini':
    default:
      return new GeminiClient(config);
  }
}

// Sync version - only checks env vars (for quick checks)
export function getProviderApiKey(provider: ProviderType): string | undefined {
  const envKey = PROVIDER_INFO[provider]?.envKey;
  if (!envKey) return undefined;
  return process.env[envKey];
}

// Async version - checks env vars first, then falls back to encrypted DB keys
export async function getProviderApiKeyAsync(provider: ProviderType): Promise<string | undefined> {
  const envKey = PROVIDER_INFO[provider]?.envKey;
  if (!envKey) return undefined;
  
  // Priority 1: Environment variable
  const envValue = process.env[envKey];
  if (envValue) {
    return envValue;
  }
  
  // Priority 2: Encrypted database key
  try {
    const { db } = await import('@/backend/lib/drizzle');
    const { secrets } = await import('@/backend/lib/schema');
    const { eq } = await import('drizzle-orm');
    const { decrypt, isEncryptionConfigured } = await import('@/backend/lib/encryption');
    
    if (!isEncryptionConfigured()) {
      return undefined;
    }
    
    const result = await db
      .select()
      .from(secrets)
      .where(eq(secrets.key, envKey))
      .limit(1);
    
    if (result.length > 0) {
      const decrypted = decrypt(result[0].encryptedValue);
      logger.info(`[LLMFactory] Using database API key for ${provider}`);
      return decrypted;
    }
  } catch (error) {
    logger.warn(`[LLMFactory] Failed to fetch DB key for ${provider}:`, {
      error: error instanceof Error ? error.message : String(error)
    });
  }
  
  return undefined;
}

export function isProviderConfigured(provider: ProviderType): boolean {
  const apiKey = getProviderApiKey(provider);
  return !!apiKey && apiKey.length > 0;
}

export function getConfiguredProviders(): ProviderType[] {
  return (['gemini', 'openai', 'anthropic', 'zai', 'groq'] as ProviderType[])
    .filter(isProviderConfigured);
}

export function getDefaultModelForProvider(provider: ProviderType): string {
  const models = PROVIDER_MODELS[provider];
  return models?.[0]?.id || 'unknown';
}
