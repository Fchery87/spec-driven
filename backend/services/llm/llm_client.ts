// eslint-disable-next-line @typescript-eslint/no-unused-vars
import {
  LLMConfig,
  LLMResponse,
  AgentContext,
  AgentOutput,
  LLMConfigWithOverrides,
  PhaseOverride,
} from '@/types/llm';
import { logger } from '@/lib/logger';
import { LLMProvider } from './providers/base';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type GeminiLimiterState = {
  inFlight: number;
  waitQueue: Array<() => void>;
  nextStartAtMs: number;
  maxConcurrent: number;
  minTimeMs: number;
};

const geminiLimiterByApiKey = new Map<string, GeminiLimiterState>();

function getGeminiLimiter(apiKey: string): GeminiLimiterState {
  const existing = geminiLimiterByApiKey.get(apiKey);
  if (existing) return existing;

  const maxConcurrent = Math.max(
    1,
    Number.parseInt(process.env.GEMINI_MAX_CONCURRENCY || '1', 10) || 1
  );

  const rpm = Number.parseInt(
    process.env.GEMINI_REQUESTS_PER_MINUTE || '60',
    10
  );
  const minTimeMs =
    Number.isFinite(rpm) && rpm > 0 ? Math.ceil(60_000 / rpm) : 0;

  const state: GeminiLimiterState = {
    inFlight: 0,
    waitQueue: [],
    nextStartAtMs: 0,
    maxConcurrent,
    minTimeMs,
  };

  geminiLimiterByApiKey.set(apiKey, state);
  return state;
}

async function acquireGeminiSlot(state: GeminiLimiterState): Promise<void> {
  if (state.inFlight < state.maxConcurrent) {
    state.inFlight += 1;
    return;
  }

  await new Promise<void>((resolve) => state.waitQueue.push(resolve));
  state.inFlight += 1;
}

function releaseGeminiSlot(state: GeminiLimiterState): void {
  state.inFlight = Math.max(0, state.inFlight - 1);
  const next = state.waitQueue.shift();
  if (next) next();
}

async function scheduleGeminiRequest<T>(
  apiKey: string,
  fn: () => Promise<T>
): Promise<T> {
  const state = getGeminiLimiter(apiKey);
  await acquireGeminiSlot(state);

  try {
    const now = Date.now();
    const waitMs = Math.max(0, state.nextStartAtMs - now);
    if (waitMs > 0) {
      await sleep(waitMs);
    }
    state.nextStartAtMs = Math.max(state.nextStartAtMs, now) + state.minTimeMs;

    return await fn();
  } finally {
    releaseGeminiSlot(state);
  }
}

async function readResponseTextLimited(
  response: Response,
  maxChars = 4000
): Promise<string> {
  try {
    const text = await response.text();
    if (text.length <= maxChars) return text;
    return text.slice(0, maxChars) + '…(truncated)';
  } catch {
    return '';
  }
}

export class GeminiClient implements LLMProvider {
  private config: LLMConfigWithOverrides;
  private baseUrl: string =
    process.env.GEMINI_BASE_URL ||
    'https://generativelanguage.googleapis.com/v1beta';

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
  async generateCompletion(
    prompt: string,
    context?: string[],
    retries = 3,
    phase?: string
  ): Promise<LLMResponse> {
    if (!this.config.api_key) {
      throw new Error('Gemini API key not configured');
    }

    // Get effective config with phase-specific overrides
    const effectiveConfig = this.getEffectiveConfig(phase);
    const timeoutSeconds = effectiveConfig.timeout_seconds || 120;

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
      contextDocsCount: context?.length || 0,
    });

    if (approxPromptTokens > 120000) {
      logger.warn(
        'Gemini prompt appears very large; consider trimming context to avoid throttling or timeouts.',
        {
          approxPromptTokens,
          model: effectiveConfig.model,
          phase: phase || this.config.phase || 'default',
        }
      );
    }

    // Gemini models have different output token limits based on version.
    // Gemini 2.5 Flash supports up to 65536 output tokens.
    // Gemini 2.0/1.5 models typically support 8192 output tokens.
    const getGeminiMaxOutputTokens = (model: string): number => {
      const modelLower = model.toLowerCase();
      // Gemini 2.5 models (including gemini-2.5-flash, gemini-2.5-pro, etc.)
      if (modelLower.includes('2.5') || modelLower.includes('2-5'))
        return 65536;
      // Gemini 2.0 models
      if (modelLower.includes('2.0') || modelLower.includes('2-0')) return 8192;
      // Gemini 1.5 models
      if (modelLower.includes('1.5') || modelLower.includes('1-5')) return 8192;
      // Default to safe limit for unknown models
      return 8192;
    };

    let maxOutputTokens = effectiveConfig.max_tokens;
    const modelMaxTokens = getGeminiMaxOutputTokens(effectiveConfig.model);
    if (maxOutputTokens > modelMaxTokens) {
      logger.warn(
        'Gemini max_tokens exceeds model limit; capping to avoid API errors.',
        {
          requested: maxOutputTokens,
          cappedTo: modelMaxTokens,
          model: effectiveConfig.model,
          phase: phase || this.config.phase || 'default',
        }
      );
      maxOutputTokens = modelMaxTokens;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const generationConfig: Record<string, any> = {
      temperature: effectiveConfig.temperature,
      maxOutputTokens,
      candidateCount: 1,
    };

    // Add top_p if specified
    if (effectiveConfig.top_p !== undefined) {
      generationConfig.topP = effectiveConfig.top_p;
    }

    const requestBody = {
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: fullPrompt,
            },
          ],
        },
      ],
      generationConfig,
    };

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await scheduleGeminiRequest(
          this.config.api_key,
          async () => {
            const controller = new AbortController();
            const timeoutId = setTimeout(
              () => controller.abort(),
              timeoutSeconds * 1000
            );

            try {
              return await fetch(
                `${this.baseUrl}/models/${effectiveConfig.model}:generateContent`,
                {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': this.config.api_key,
                  },
                  body: JSON.stringify(requestBody),
                  signal: controller.signal,
                }
              );
            } finally {
              clearTimeout(timeoutId);
            }
          }
        );

        if (response.status === 429) {
          // Rate limit - wait and retry with exponential backoff (1s, 2s, 4s, 8s)
          if (attempt >= retries) {
            const errorText = await readResponseTextLimited(response);
            throw new Error(
              `Rate limited by Gemini API (HTTP 429). ${
                errorText ? `Details: ${errorText}` : ''
              }`.trim()
            );
          }

          const retryAfterHeader = response.headers.get('retry-after');
          const retryAfterSeconds = retryAfterHeader
            ? Number.parseFloat(retryAfterHeader)
            : Number.NaN;
          const retryAfterMs = Number.isFinite(retryAfterSeconds)
            ? Math.ceil(retryAfterSeconds * 1000)
            : undefined;

          const jitterMs = Math.floor(Math.random() * 250);
          const backoffMs = Math.pow(2, attempt) * 1000;
          const waitTime = (retryAfterMs ?? backoffMs) + jitterMs;

          logger.info(
            `Rate limited. Waiting ${waitTime}ms before retry ${
              attempt + 1
            }/${retries}...`
          );
          await sleep(waitTime);
          continue;
        }

        if (!response.ok) {
          const errorText = await readResponseTextLimited(response);
          const error = new Error(
            `Gemini API error: ${response.status} ${response.statusText} - ${errorText}`
          );
          logger.error('Gemini API error details:', error, {
            status: response.status,
            statusText: response.statusText,
            errorText,
            model: this.config.model,
            attempt: attempt + 1,
          });
          throw error;
        }

        const data = await response.json();
        const finishReason = data.candidates?.[0]?.finishReason;

        logger.info('Gemini API success:', {
          model: data.modelVersion,
          candidatesCount: data.candidates?.length,
          finishReason: finishReason,
        });

        // Warn if response was truncated
        if (finishReason === 'MAX_TOKENS') {
          logger.warn(
            'Gemini response was truncated due to MAX_TOKENS limit. Consider increasing max_tokens or reducing prompt size.',
            {
              model: effectiveConfig.model,
              maxTokens: effectiveConfig.max_tokens,
              phase: phase || this.config.phase,
            }
          );
        }

        return this.parseResponse(data);
      } catch (error) {
        lastError = error as Error;
        logger.error(
          'Gemini API call error:',
          error instanceof Error ? error : new Error(String(error)),
          {
            attempt: attempt + 1,
            maxRetries: retries,
            model: effectiveConfig.model,
            phase: phase || this.config.phase || 'default',
          }
        );

        const message =
          error instanceof Error
            ? error.message.toLowerCase()
            : String(error).toLowerCase();
        const isRateLimited =
          message.includes('rate limited') || message.includes('429');
        const isTimeout =
          message.includes('timeout') || message.includes('abort');

        if (isRateLimited) {
          if (attempt < retries) {
            const jitterMs = Math.floor(Math.random() * 250);
            const waitTime = Math.pow(2, attempt) * 1000 + jitterMs;
            logger.info(
              `Rate limited. Waiting ${waitTime}ms before retry ${
                attempt + 1
              }/${retries}...`
            );
            await sleep(waitTime);
            continue;
          }
          throw error instanceof Error
            ? error
            : new Error('Rate limited by Gemini API');
        }

        if (isTimeout) {
          throw new Error(
            `Gemini API request timeout after ${timeoutSeconds}s`
          );
        }

        // Non rate-limit errors: fail fast (no retries)
        throw error;
      }
    }

    throw lastError || new Error('Failed to generate completion');
  }

  /**
   * Generate completion with context documents
   */
  async generateWithContext(
    prompt: string,
    artifacts: Record<string, string>,
    phase?: string
  ): Promise<LLMResponse> {
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
        total_tokens: data.usageMetadata?.totalTokenCount || 0,
      },
      model: this.config.model,
      finish_reason: candidate.finishReason,
    };
  }
}
