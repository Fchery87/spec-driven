import type { LLMConfigWithOverrides } from '@/types/llm';

const AUTO_REMEDY_SOLUTIONING_MAX_TOKENS_ZAI = 16000;

export function applyAutoRemedyOverrides(
  config: LLMConfigWithOverrides
): LLMConfigWithOverrides {
  if (config.provider !== 'zai') {
    return config;
  }

  const phaseOverrides = { ...(config.phase_overrides || {}) };
  const solutioningOverride = { ...(phaseOverrides.SOLUTIONING || {}) };
  const currentMaxTokens =
    solutioningOverride.max_tokens ?? config.max_tokens ?? 0;

  solutioningOverride.max_tokens = Math.min(
    currentMaxTokens || AUTO_REMEDY_SOLUTIONING_MAX_TOKENS_ZAI,
    AUTO_REMEDY_SOLUTIONING_MAX_TOKENS_ZAI
  );

  phaseOverrides.SOLUTIONING = solutioningOverride;

  return {
    ...config,
    phase_overrides: phaseOverrides,
  };
}
