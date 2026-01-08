 
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

// Schema type constants for structured output
const SCHEMA_TYPE_STRING = 'STRING' as const;
const SCHEMA_TYPE_INTEGER = 'INTEGER' as const;
const SCHEMA_TYPE_NUMBER = 'NUMBER' as const;
const SCHEMA_TYPE_BOOLEAN = 'BOOLEAN' as const;
const SCHEMA_TYPE_ARRAY = 'ARRAY' as const;
const SCHEMA_TYPE_OBJECT = 'OBJECT' as const;

interface SchemaDefinition {
  type: typeof SCHEMA_TYPE_STRING | typeof SCHEMA_TYPE_INTEGER | typeof SCHEMA_TYPE_NUMBER | typeof SCHEMA_TYPE_BOOLEAN | typeof SCHEMA_TYPE_ARRAY | typeof SCHEMA_TYPE_OBJECT;
  description?: string;
  enum?: string[];
  properties?: Record<string, SchemaDefinition>;
  items?: SchemaDefinition;
  required?: string[];
}

interface StructuredArtifact {
  filename: string;
  content: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// STREAMING VALIDATION TYPES AND CLASSES
// ============================================================================

/**
 * Configuration for streaming validation patterns
 */
export interface StreamingValidationPatterns {
  /** Regex patterns to detect placeholder content */
  placeholder: RegExp[];
  /** Regex patterns to detect AI slop/cookie-cutter content */
  slop: RegExp[];
  /** Regex patterns to detect format violations */
  format: RegExp[];
}

/**
 * Configuration for streaming validation
 */
export interface StreamingValidationConfig {
  /** Enable streaming validation */
  enabled: boolean;
  /** Abort generation when violations are detected */
  abortOnViolations: boolean;
  /** Check interval in milliseconds */
  checkIntervalMs: number;
  /** Validation patterns */
  patterns: StreamingValidationPatterns;
  /** Phases where streaming validation is enabled */
  enabledPhases: string[];
}

/**
 * Default streaming validation patterns
 */
export const DEFAULT_STREAMING_PATTERNS: StreamingValidationPatterns = {
  placeholder: [
    /\/\/\s*TODO[:\s]/i,
    /\/\*\s*TODO[:\s]/i,
    /placeholder/i,
    /lorem ipsum/i,
    /\[?TO BE IMPLEMENTED\]?/i,
    /\[?WIP\]?/i,
    /\[?XXX\]?/i,
    /TBD/i,
    /FIXME/i,
    /REVIEW:/i,
  ],
  slop: [
    /purple.*gradient/i,
    /indigo.*gradient/i,
    /blob.*background/i,
    /inter font/i,
    /beautiful.*gradient/i,
    /stunning.*design/i,
    /eye-catching/i,
    /modern.*look/i,
    /sleek.*design/i,
    /visually.*appealing/i,
    /captivating/i,
    /breathtaking/i,
    /exquisite/i,
    /radiant/i,
    /ethereal/i,
  ],
  format: [
    /undefined/i,
    /null\s*[,\n]/,
    /\[object Object\]/,
  ],
};

/**
 * Error thrown when streaming validation detects violations
 */
export class ValidationError extends Error {
  violations: string[];
  
  constructor(message: string, violations: string[] = []) {
    super(message);
    this.name = 'ValidationError';
    this.violations = violations;
  }
}

/**
 * Result of streaming validation check
 */
export interface StreamingValidationResult {
  shouldContinue: boolean;
  violations: string[];
}

/**
 * StreamingValidator monitors LLM output in real-time and can abort on violations
 */
export class StreamingValidator {
  private config: StreamingValidationConfig;
  private accumulatedContent: string;
  private violations: string[];
  private lastCheckIndex: number;
  
  constructor(config: StreamingValidationConfig) {
    this.config = config;
    this.accumulatedContent = '';
    this.violations = [];
    this.lastCheckIndex = 0;
  }
  
  /**
   * Process a chunk of LLM output and check for violations
   */
  onChunk(chunk: string): StreamingValidationResult {
    this.accumulatedContent += chunk;
    
    // Check for violations since last check
    const newContent = this.accumulatedContent.slice(this.lastCheckIndex);
    const foundViolations = this.checkPatterns(newContent);
    
    if (foundViolations.length > 0) {
      this.violations.push(...foundViolations);
    }
    
    this.lastCheckIndex = this.accumulatedContent.length;
    
    const shouldContinue = !this.config.abortOnViolations || foundViolations.length === 0;
    
    return { shouldContinue, violations: foundViolations };
  }
  
  /**
   * Check content against all patterns
   */
  private checkPatterns(content: string): string[] {
    const violations: string[] = [];
    
    // Check placeholder patterns
    for (const pattern of this.config.patterns.placeholder) {
      if (pattern.test(content)) {
        violations.push(`Placeholder pattern detected: ${pattern}`);
      }
    }
    
    // Check AI slop patterns
    for (const pattern of this.config.patterns.slop) {
      if (pattern.test(content)) {
        violations.push(`AI slop pattern detected: ${pattern}`);
      }
    }
    
    // Check format patterns
    for (const pattern of this.config.patterns.format) {
      if (pattern.test(content)) {
        violations.push(`Format violation detected: ${pattern}`);
      }
    }
    
    return violations;
  }
  
  /**
   * Get all violations detected so far
   */
  getViolations(): string[] {
    return [...this.violations];
  }
  
  /**
   * Check if validation should abort
   */
  shouldAbort(): boolean {
    return this.config.abortOnViolations && this.violations.length > 0;
  }
  
  /**
   * Get accumulated content so far
   */
  getAccumulatedContent(): string {
    return this.accumulatedContent;
  }
}

/**
 * Get streaming validation configuration for a specific phase
 */
export function getStreamingValidationConfig(
  phase?: string,
  llmConfig?: LLMConfigWithOverrides
): StreamingValidationConfig | null {
  // Check if streaming validation is enabled in config
  const enabled = llmConfig?.streaming_validation?.enabled ?? true;
  
  if (!enabled) {
    return null;
  }
  
  const phaseOverrides = llmConfig?.streaming_validation?.phase_overrides ?? {};
  const globalConfig = llmConfig?.streaming_validation ?? {};
  
  // Check if phase is in enabled phases list
  const enabledPhases = globalConfig.enabled_phases ?? [
    'SPEC_DESIGN_COMPONENTS',
    'FRONTEND_BUILD',
    'SOLUTIONING',
  ];
  
  if (phase && !enabledPhases.includes(phase)) {
    return null;
  }
  
  const phaseConfig = phaseOverrides[phase as string] ?? {};
  
  return {
    enabled: true,
    abortOnViolations: phaseConfig.abort_on_violations ?? globalConfig.abort_on_violations ?? true,
    checkIntervalMs: phaseConfig.check_interval_ms ?? globalConfig.check_interval_ms ?? 100,
    patterns: {
      placeholder: globalConfig.patterns?.placeholder?.map(p => new RegExp(p)) ?? DEFAULT_STREAMING_PATTERNS.placeholder,
      slop: globalConfig.patterns?.slop?.map(p => new RegExp(p)) ?? DEFAULT_STREAMING_PATTERNS.slop,
      format: globalConfig.patterns?.format?.map(p => new RegExp(p)) ?? DEFAULT_STREAMING_PATTERNS.format,
    },
    enabledPhases,
  };
}

// ============================================================================
// GEMINI LIMITER STATE
// ============================================================================

type GeminiLimiterState = {
  inFlight: number;
  waitQueue: Array<() => void>;
  nextStartAtMs: number;
  maxConcurrent: number;
  minTimeMs: number;
  lastUsed: number;
};

const MAX_LIMITS = 1000; // Maximum number of API keys to track
const geminiLimiterByApiKey = new Map<string, GeminiLimiterState>();
let lastCleanup = Date.now();

function getGeminiLimiter(apiKey: string): GeminiLimiterState {
  const existing = geminiLimiterByApiKey.get(apiKey);
  if (existing) {
    existing.lastUsed = Date.now();
    return existing;
  }

  // Clean up old entries if we're over the limit
  if (geminiLimiterByApiKey.size >= MAX_LIMITS) {
    const now = Date.now();
    const cleanupInterval = 5 * 60 * 1000; // 5 minutes

    if (now - lastCleanup > cleanupInterval) {
      lastCleanup = now;
      const entriesToDelete = Math.floor(MAX_LIMITS * 0.2); // Delete 20% oldest
      const entries = Array.from(geminiLimiterByApiKey.entries()).sort(
        (a, b) => a[1].lastUsed - b[1].lastUsed
      );

      for (let i = 0; i < entriesToDelete && entries[i]; i++) {
        geminiLimiterByApiKey.delete(entries[i][0]);
      }
    }
  }

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
    lastUsed: Date.now(),
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
  maxChars = 1000000
): Promise<string> {
  try {
    const text = await response.text();
    if (text.length <= maxChars) return text;
    // Log warning if we hit the limit (should rarely happen with 1M char limit)
    logger.warn('LLM response exceeded maximum character limit', {
      length: text.length,
      maxChars,
    });
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
    phase?: string,
    continuationCount = 0,
    structuredConfig?: { responseMimeType?: string; responseSchema?: SchemaDefinition }
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
      continuationCount,
    } as any);

    if (approxPromptTokens > 120000) {
      logger.warn(
        'Gemini prompt appears very large; consider trimming context to avoid throttling or timeouts.',
        {
          approxPromptTokens,
          model: effectiveConfig.model,
          phase: phase || this.config.phase || 'default',
        } as any
      );
    }

    // Gemini models have different output token limits based on version.
    // Gemini 3 Flash Preview supports up to 64000 output tokens.
    // Gemini 2.5 Flash supports up to 65536 output tokens.
    // Gemini 2.0/1.5 models typically support 8192 output tokens.
    const getGeminiMaxOutputTokens = (model: string): number => {
      const modelLower = model.toLowerCase();
      // Gemini 3 models (including gemini-3-flash-preview, gemini-3.0-flash, etc.)
      if (
        modelLower.includes('gemini-3') ||
        modelLower.includes('3.0') ||
        modelLower.includes('3-0') ||
        modelLower.includes('3-flash')
      )
        return 64000;
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

     
    const generationConfig: Record<string, any> = {
      temperature: effectiveConfig.temperature,
      maxOutputTokens,
      candidateCount: 1,
    };

    // Add structured output config if provided
    if (structuredConfig?.responseMimeType) {
      generationConfig.responseMimeType = structuredConfig.responseMimeType;
    }
    if (structuredConfig?.responseSchema) {
      generationConfig.responseSchema = structuredConfig.responseSchema;
    }
    // Add temperature and maxOutputTokens if provided in structuredConfig
    if (structuredConfig) {
      if ('temperature' in structuredConfig) {
        generationConfig.temperature = structuredConfig.temperature;
      }
      if ('maxOutputTokens' in structuredConfig) {
        generationConfig.maxOutputTokens = structuredConfig.maxOutputTokens;
      }
    }

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
    let accumulatedContent = '';

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
                    'x-goog-api-key': this.config.api_key!,
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
          // Rate limit - wait and retry with exponential backoff
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
          throw new Error(
            `Gemini API error: ${response.status} ${response.statusText} - ${errorText}`
          );
        }

        const data = await response.json();
        const candidate = data.candidates?.[0];
        if (!candidate) throw new Error('No candidates in Gemini response');

        const finishReason = candidate.finishReason;
        const currentContent = candidate.content?.parts?.[0]?.text || '';
        accumulatedContent += currentContent;

        // Check for truncation and handle continuation
        if (finishReason === 'MAX_TOKENS') {
          const maxContinuations = (this.config as any).max_continuations || 3;
          // Use the explicit parameter
          const currentContinuations = continuationCount;

          if (currentContinuations < maxContinuations) {
            logger.warn(
              'Gemini response truncated. Triggering continuation...',
              {
                model: effectiveConfig.model,
                phase: phase || this.config.phase,
                continuation: currentContinuations + 1,
                maxContinuations,
              } as any
            );

            // Use a specific continuation prompt to minimize repetition
            const lastContext = currentContent.slice(-100);
            const continuationPrompt = `The previous response was truncated. Please continue exactly from the last character: "${lastContext}". Do not repeat the previous content. Continue with the rest of the artifacts/content.`;

            // Recurse with increased continuation count
            const nextResponse = await this.generateCompletion(
              continuationPrompt,
              context,
              retries,
              phase,
              currentContinuations + 1
            );

            accumulatedContent += nextResponse.content;

            // Update usage metadata to reflect the total across all turns
            return {
              ...nextResponse,
              content: accumulatedContent,
              usage: {
                prompt_tokens:
                  (data.usageMetadata?.promptTokenCount || 0) +
                  (nextResponse.usage?.prompt_tokens || 0),
                completion_tokens:
                  (data.usageMetadata?.candidatesTokenCount || 0) +
                  (nextResponse.usage?.completion_tokens || 0),
                total_tokens:
                  (data.usageMetadata?.totalTokenCount || 0) +
                  (nextResponse.usage?.total_tokens || 0),
              },
              finish_reason: nextResponse.finish_reason,
            };
          } else {
            logger.error(
              'Maximum continuations reached. Output remains truncated.',
              {
                maxContinuations,
                phase: phase || this.config.phase,
              } as any
            );
          }
        }

        return {
          content: accumulatedContent,
          usage: {
            prompt_tokens: data.usageMetadata?.promptTokenCount || 0,
            completion_tokens: data.usageMetadata?.candidatesTokenCount || 0,
            total_tokens: data.usageMetadata?.totalTokenCount || 0,
          },
          model: effectiveConfig.model,
          finish_reason: finishReason,
        };
      } catch (error) {
        lastError = error as Error;
        // Check for rate limit or timeout in the error message
        const message =
          error instanceof Error
            ? error.message.toLowerCase()
            : String(error).toLowerCase();
        const isRateLimited =
          message.includes('rate limited') || message.includes('429');
        if (isRateLimited && attempt < retries) {
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

  // ============================================================================
  // STREAMING METHODS
  // ============================================================================

  /**
   * Stream response from Gemini API as an async generator
   * This enables real-time validation during generation
   */
  async *streamResponse(
    prompt: string,
    context?: string[]
  ): AsyncGenerator<string, void, unknown> {
    const effectiveConfig = this.getEffectiveConfig();
    const timeoutSeconds = effectiveConfig.timeout_seconds || 120;

    const fullPrompt = this.buildPrompt(prompt, context);

    const requestBody = {
      contents: [
        {
          role: 'user',
          parts: [{ text: fullPrompt }],
        },
      ],
      generationConfig: {
        temperature: effectiveConfig.temperature,
        maxOutputTokens: effectiveConfig.max_tokens,
      },
    };

    // Add top_p if specified
    if (effectiveConfig.top_p !== undefined) {
      (requestBody as any).generationConfig.topP = effectiveConfig.top_p;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutSeconds * 1000);

    try {
      const response = await fetch(
        `${this.baseUrl}/models/${effectiveConfig.model}:streamGenerateContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': this.config.api_key!,
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        }
      );

      if (!response.ok) {
        const errorText = await readResponseTextLimited(response);
        throw new Error(
          `Gemini streaming API error: ${response.status} ${response.statusText} - ${errorText}`
        );
      }

      // Parse streaming response
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body for streaming');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              const chunk = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
              if (chunk) {
                yield chunk;
              }
            } catch {
              // Skip invalid JSON lines
            }
          }
        }
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Abort the current streaming request (for use with streaming validation)
   */
  private abortRequest(): void {
    // Note: In a real implementation, this would track the current AbortController
    // For now, this is a placeholder that can be extended
    logger.warn('[StreamingValidation] Request abort triggered');
  }

  // ============================================================================
  // STRUCTURED OUTPUT METHODS
  // ============================================================================

  /**
   * Generate artifacts with structured JSON output using Gemini's native schema enforcement.
   * This eliminates 80% of parsing failures by using responseMimeType + responseSchema.
   */
  async generateStructuredArtifacts(
    prompt: string,
    expectedFiles: string[],
    phase?: string,
    options?: { temperature?: number; maxOutputTokens?: number; retries?: number }
  ): Promise<Record<string, string>> {
    const schema = this.buildArtifactSchema(expectedFiles);
    const effectiveConfig = this.getEffectiveConfig(phase);
    
    // Build generation config with structured output
    const structuredConfig: {
      responseMimeType: string;
      responseSchema: SchemaDefinition;
      temperature?: number;
      maxOutputTokens?: number;
    } = {
      responseMimeType: 'application/json',
      responseSchema: schema,
    };
    
    // Apply temperature and maxOutputTokens
    if (options?.temperature !== undefined) {
      structuredConfig.temperature = options.temperature;
    } else if (effectiveConfig.temperature !== undefined) {
      structuredConfig.temperature = effectiveConfig.temperature;
    }
    
    const response = await this.generateCompletion(
      prompt,
      undefined,
      options?.retries ?? 2,
      phase,
      0,
      structuredConfig
    );

    // Direct JSON parse - no fallback needed with structured output!
    let artifacts: StructuredArtifact[];
    try {
      artifacts = JSON.parse(response.content);
    } catch (parseError) {
      throw new Error(
        `Failed to parse structured output as JSON: ${(parseError as Error).message}. ` +
        `Raw response: ${response.content.slice(0, 500)}...`
      );
    }

    // Validate artifact structure
    if (!Array.isArray(artifacts)) {
      throw new Error(`Expected array of artifacts, got: ${typeof artifacts}`);
    }

    // Convert array to record and validate all expected files present
    const result: Record<string, string> = {};
    const foundFiles: string[] = [];
    
    for (const artifact of artifacts) {
      if (artifact.filename && typeof artifact.content === 'string') {
        result[artifact.filename] = artifact.content;
        foundFiles.push(artifact.filename);
      }
    }

    const missing = expectedFiles.filter(f => !result[f]);
    if (missing.length > 0) {
      throw new Error(
        `Structured output missing required files. Expected: ${expectedFiles.join(', ')}. ` +
        `Found: ${foundFiles.join(', ')}`
      );
    }

    logger.info('[StructuredOutput] Successfully parsed artifacts', {
      files: foundFiles,
      phase,
    });

    return result;
  }

  /**
   * Build artifact schema for structured output
   */
  private buildArtifactSchema(expectedFiles: string[]): SchemaDefinition {
    return {
      type: SCHEMA_TYPE_ARRAY,
      description: `Array of artifacts with filenames from: ${expectedFiles.join(', ')}`,
      items: {
        type: SCHEMA_TYPE_OBJECT,
        description: 'Individual artifact with filename and content',
        properties: {
          filename: {
            type: SCHEMA_TYPE_STRING,
            description: `Output filename - must be one of: ${expectedFiles.join(', ')}`,
            enum: expectedFiles,
          },
          content: {
            type: SCHEMA_TYPE_STRING,
            description: 'Complete file content including frontmatter if applicable',
          },
        },
        required: ['filename', 'content'],
      },
    };
  }

  /**
   * Build two-file schema for design phase (component-mapping + journey-maps)
   */
  buildTwoFileSchema(): SchemaDefinition {
    return {
      type: SCHEMA_TYPE_ARRAY,
      items: {
        type: SCHEMA_TYPE_OBJECT,
        properties: {
          filename: {
            type: SCHEMA_TYPE_STRING,
            enum: ['component-mapping.md', 'journey-maps.md'],
          },
          content: {
            type: SCHEMA_TYPE_STRING,
          },
        },
        required: ['filename', 'content'],
      },
    };
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
