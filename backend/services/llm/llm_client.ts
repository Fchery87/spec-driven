// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { LLMConfig, LLMResponse, AgentContext, AgentOutput, LLMConfigWithOverrides, PhaseOverride } from '@/types/llm';
import { logger } from '@/lib/logger';
import { LLMProvider } from './providers/base';

export class GeminiClient implements LLMProvider {
  private config: LLMConfigWithOverrides;
  private baseUrl: string = 'https://generativelanguage.googleapis.com/v1beta';

  constructor(config: LLMConfigWithOverrides) {
    this.config = config;
  }

  /**
   * Get effective config with phase-specific overrides applied
   */
  private getEffectiveConfig(phase?: string): LLMConfig {
    const targetPhase = phase || this.config.phase;
    
    if (!targetPhase || !this.config.phase_overrides) {
      return this.config;
    }

    const override = this.config.phase_overrides[targetPhase];
    if (!override) {
      return this.config;
    }

    return {
      ...this.config,
      temperature: override.temperature ?? this.config.temperature,
      max_tokens: override.max_tokens ?? this.config.max_tokens,
      top_p: override.top_p ?? this.config.top_p,
    };
  }

  /**
   * Set the current phase for config overrides
   */
  setPhase(phase: string): void {
    this.config.phase = phase;
  }

  /**
   * Test API connection
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.baseUrl}/models?key=${this.config.api_key}`
      );
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Generate completion from Gemini API with retry logic
   */
  async generateCompletion(prompt: string, context?: string[], retries = 3, phase?: string): Promise<LLMResponse> {
    if (!this.config.api_key) {
      throw new Error('Gemini API key not configured');
    }

    // Get effective config with phase-specific overrides
    const effectiveConfig = this.getEffectiveConfig(phase);

    const fullPrompt = this.buildPrompt(prompt, context);
    const approxPromptTokens = Math.ceil(fullPrompt.length / 4); // rough heuristic
    logger.info('Generating completion with Gemini:', {
      model: effectiveConfig.model,
      promptLength: fullPrompt.length,
      approxPromptTokens,
      temperature: effectiveConfig.temperature,
      maxTokens: effectiveConfig.max_tokens,
      topP: effectiveConfig.top_p,
      phase: phase || this.config.phase || 'default',
      contextDocsCount: context?.length || 0
    });

    if (approxPromptTokens > 120000) {
      logger.warn('Gemini prompt appears very large; consider trimming context to avoid throttling or timeouts.', {
        approxPromptTokens,
        model: effectiveConfig.model,
        phase: phase || this.config.phase || 'default'
      });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const generationConfig: Record<string, any> = {
      temperature: effectiveConfig.temperature,
      maxOutputTokens: effectiveConfig.max_tokens,
      candidateCount: 1
    };

    // Add top_p if specified
    if (effectiveConfig.top_p !== undefined) {
      generationConfig.topP = effectiveConfig.top_p;
    }

    const requestBody = {
      contents: [
        {
          parts: [
            {
              text: fullPrompt
            }
          ]
        }
      ],
      generationConfig
    };

    let lastError: Error | null = null;
    const maxAttempts = Math.max(1, retries + 1); // retries = number of retries, so attempts = retries + initial
    const baseWaitMs = 5000;
    const maxWaitMs = 40000;

    const computeBackoff = (attemptNumber: number) => {
      const raw = Math.min(maxWaitMs, baseWaitMs * Math.pow(2, attemptNumber - 1));
      const jitter = raw * 0.2 * (Math.random() * 2 - 1); // ±20%
      return Math.max(baseWaitMs, Math.round(raw + jitter));
    };

    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        // Create abort controller for timeout
        const controller = new AbortController();
        const timeoutMs = (effectiveConfig.timeout_seconds || 180) * 1000;
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        try {
          const response = await fetch(
            `${this.baseUrl}/models/${this.config.model}:generateContent`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': this.config.api_key,
              },
              body: JSON.stringify(requestBody),
              signal: controller.signal
            }
          );

          if (response.status === 429) {
            lastError = new Error('Gemini rate limit (429)');
            if (attempt === maxAttempts) {
              throw new Error(`Gemini rate limited after ${maxAttempts} attempts; consider reducing prompt size or retrying later.`);
            }
            const waitTime = computeBackoff(attempt);
            logger.warn(`Rate limited by Gemini API. Waiting ${waitTime}ms before retry ${attempt + 1}/${maxAttempts}...`);
            await sleep(waitTime);
            continue;
          }

          if (!response.ok) {
            const errorText = await response.text();
            const error = new Error(`Gemini API error: ${response.status} ${response.statusText} - ${errorText}`);
            logger.error('Gemini API error details:', error, {
              status: response.status,
              statusText: response.statusText,
              errorText,
              model: this.config.model,
              attempt
            });
            throw error;
          }

          const data = await response.json();
          const finishReason = data.candidates?.[0]?.finishReason;
          
          logger.info('Gemini API success:', {
            model: data.modelVersion,
            candidatesCount: data.candidates?.length,
            finishReason: finishReason
          });

          // Warn if response was truncated
          if (finishReason === 'MAX_TOKENS') {
            logger.warn('Gemini response was truncated due to MAX_TOKENS limit. Consider increasing max_tokens or reducing prompt size.', {
              model: effectiveConfig.model,
              maxTokens: effectiveConfig.max_tokens,
              phase: phase || this.config.phase
            });
          }

          return this.parseResponse(data);
        } finally {
          clearTimeout(timeoutId);
        }
      } catch (error) {
        lastError = error as Error;
        const isAbortError = error instanceof Error && error.name === 'AbortError';
        const isRateLimitError = error instanceof Error && (error.message.includes('429') || error.message.toLowerCase().includes('rate limit'));

        if (isAbortError) {
          logger.error('Gemini API call timed out', new Error('Request timeout'), {
            timeoutSeconds: effectiveConfig.timeout_seconds || 180,
            attempt,
            phase: phase || this.config.phase
          });
          if (attempt === maxAttempts) {
            throw new Error(`Gemini API request timed out after ${effectiveConfig.timeout_seconds || 180} seconds`);
          }
          continue;
        }

        logger.error('Gemini API call error:', error instanceof Error ? error : new Error(String(error)), {
          attempt,
          maxAttempts
        });

        if (isRateLimitError && attempt < maxAttempts) {
          const waitTime = computeBackoff(attempt);
          logger.warn(`Rate limited. Waiting ${waitTime}ms before retry ${attempt + 1}/${maxAttempts}...`);
          await sleep(waitTime);
          continue;
        }

        if (!isRateLimitError && !isAbortError) {
          // Non-retryable error: fail fast
          throw error;
        }

        if (attempt === maxAttempts) {
          logger.error('Gemini API call failed after retries:', error instanceof Error ? error : new Error(String(error)));
          throw new Error(`Failed to generate completion after ${maxAttempts} attempts: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }

    throw lastError || new Error('Failed to generate completion');
  }

  /**
   * Generate completion with context documents
   */
  async generateWithContext(prompt: string, artifacts: Record<string, string>, phase?: string): Promise<LLMResponse> {
    const context = Object.values(artifacts);
    return this.generateCompletion(prompt, context, 3, phase);
  }

  /**
   * Build prompt with context
   */
  private buildPrompt(prompt: string, context?: string[]): string {
    if (!context || context.length === 0) {
      return prompt;
    }

    const contextText = context
      .map((doc, index) => `--- Context Document ${index + 1} ---\n${doc}\n`)
      .join('\n');

    return `${contextText}\n\n--- Task ---\n${prompt}`;
  }

  /**
   * Parse Gemini API response
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private parseResponse(data: any): LLMResponse {
    const candidate = data.candidates?.[0];
    
    if (!candidate) {
      throw new Error('No candidates in Gemini response');
    }

    const content = candidate.content?.parts?.[0]?.text || '';
    
    return {
      content,
      usage: {
        prompt_tokens: data.usageMetadata?.promptTokenCount || 0,
        completion_tokens: data.usageMetadata?.candidatesTokenCount || 0,
        total_tokens: data.usageMetadata?.totalTokenCount || 0
      },
      model: this.config.model,
      finish_reason: candidate.finishReason
    };
  }

}