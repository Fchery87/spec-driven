import { describe, it, expect } from 'vitest';
import { applyAutoRemedyOverrides } from './auto_remedy_llm_config';
import type { LLMConfigWithOverrides } from '@/types/llm';

describe('applyAutoRemedyOverrides', () => {
  it('caps SOLUTIONING max_tokens for Z.ai to avoid timeouts', () => {
    const config: LLMConfigWithOverrides = {
      provider: 'zai',
      model: 'glm-4.7',
      max_tokens: 8192,
      temperature: 0.7,
      timeout_seconds: 240,
      phase_overrides: {
        SOLUTIONING: { max_tokens: 64000 },
        AUTO_REMEDY: { max_tokens: 32000 },
      },
    };

    const updated = applyAutoRemedyOverrides(config);

    expect(updated.phase_overrides?.SOLUTIONING?.max_tokens).toBe(16000);
  });

  it('leaves non-Z.ai provider overrides unchanged', () => {
    const config: LLMConfigWithOverrides = {
      provider: 'gemini',
      model: 'gemini-3-flash-preview',
      max_tokens: 16384,
      temperature: 0.5,
      timeout_seconds: 180,
      phase_overrides: {
        SOLUTIONING: { max_tokens: 64000 },
      },
    };

    const updated = applyAutoRemedyOverrides(config);

    expect(updated.phase_overrides?.SOLUTIONING?.max_tokens).toBe(64000);
  });
});
