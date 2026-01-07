import { logger } from '@/lib/logger';
import {
  LLMResponse,
  LLMConfigWithOverrides,
  PhaseOverride,
} from '@/types/llm';
import { LLMProvider } from './base';

export class ZaiClient implements LLMProvider {
  private apiKey: string;
  private model: string;
  private maxTokens: number;
  private temperature: number;
  private timeoutSeconds: number;
  private topP?: number;
  private phaseOverrides: Record<string, PhaseOverride>;
  private baseUrl: string = 'https://api.z.ai/api/coding/paas/v4';

  constructor(config: LLMConfigWithOverrides) {
    this.apiKey = config.api_key || process.env.ZAI_API_KEY || '';
    this.model = config.model || 'glm-4.6';
    this.maxTokens = config.max_tokens || 8192;
    this.temperature = config.temperature ?? 0.7;
    this.timeoutSeconds = config.timeout_seconds || 120;
    this.topP = config.top_p;
    this.phaseOverrides = config.phase_overrides || {};

    if (!this.apiKey) {
      logger.warn('Z.ai API key not provided');
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Hi' }],
        }),
      });
      return response.ok || response.status === 400;
    } catch {
      return false;
    }
  }

  async generateCompletion(
    prompt: string,
    contextDocs: string[] = [],
    retries: number = 3,
    phase?: string
  ): Promise<LLMResponse> {
    let temperature = this.temperature;
    let maxTokens = this.maxTokens;
    let topP = this.topP;

    if (phase && this.phaseOverrides[phase]) {
      const override = this.phaseOverrides[phase];
      temperature = override.temperature ?? temperature;
      maxTokens = override.max_tokens ?? maxTokens;
      topP = override.top_p ?? topP;
    }

    const systemPrompt =
      contextDocs.length > 0
        ? `You are an expert software architect and project manager. Use the following context documents:\n\n${contextDocs.join(
            '\n\n---\n\n'
          )}`
        : 'You are an expert software architect and project manager.';

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt },
    ];

    logger.info('Generating completion with Z.ai GLM:', {
      model: this.model,
      promptLength: prompt.length,
      temperature,
      maxTokens,
      topP,
      phase,
      contextDocsCount: contextDocs.length,
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      this.timeoutSeconds * 1000
    );

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            model: this.model,
            messages,
            max_tokens: maxTokens,
            temperature,
            ...(topP !== undefined && { top_p: topP }),
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.status === 429) {
          const backoffMs = Math.pow(2, attempt) * 1000;
          logger.warn(
            `Rate limited by Z.ai API. Waiting ${backoffMs}ms before retry ${
              attempt + 1
            }/${retries}...`
          );
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
          continue;
        }

        if (!response.ok) {
          const error = await response.json();
          throw new Error(
            `Z.ai API error: ${
              error.error?.message || error.msg || response.statusText
            }`
          );
        }

        const data = await response.json();
        const choice = data.choices?.[0];

        // GLM-4.6 uses reasoning_content for chain-of-thought models
        // Fall back to content if reasoning_content is not present
        const responseContent =
          choice?.message?.content || choice?.message?.reasoning_content;

        if (!responseContent) {
          logger.error(
            'No content in Z.ai response',
            new Error('Empty response'),
            {
              hasMessage: !!choice?.message,
              hasContent: !!choice?.message?.content,
              hasReasoningContent: !!choice?.message?.reasoning_content,
              finishReason: choice?.finish_reason,
            }
          );
          throw new Error('No content in Z.ai response');
        }

        if (choice.finish_reason === 'length') {
          logger.warn('Z.ai response was truncated due to max_tokens limit');
        }

        return {
          content: responseContent,
          model: data.model,
          finish_reason: choice.finish_reason,
          usage: data.usage
            ? {
                prompt_tokens: data.usage.prompt_tokens,
                completion_tokens: data.usage.completion_tokens,
                total_tokens: data.usage.total_tokens,
              }
            : undefined,
        };
      } catch (error) {
        clearTimeout(timeoutId);

        if (error instanceof Error && error.name === 'AbortError') {
          logger.error(
            'Z.ai API call timed out',
            new Error('Request timeout'),
            {
              timeoutSeconds: this.timeoutSeconds,
              attempt,
              phase,
            }
          );
          throw new Error('Request timeout');
        }

        if (attempt === retries) {
          logger.error(
            'Z.ai API call failed after all retries',
            error instanceof Error ? error : new Error(String(error)),
            { attempt, phase }
          );
          throw error;
        }

        logger.warn(`Z.ai API error, retrying (${attempt}/${retries})...`, {
          error: error instanceof Error ? error.message : String(error),
        });
        await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
      }
    }

    throw new Error('Failed to generate completion after all retries');
  }

  /**
   * Build artifact schema for structured output
   */
  private buildArtifactSchema(expectedFiles: string[]): {
    type: string;
    properties: Record<string, any>;
    required: string[];
  } {
    const properties: Record<string, any> = {};

    for (const filename of expectedFiles) {
      const key = filename.replace(/[^a-zA-Z0-9]/g, '_');
      properties[key] = {
        type: 'object',
        properties: {
          filename: {
            type: 'string',
            enum: [filename],
          },
          content: {
            type: 'string',
          },
        },
        required: ['filename', 'content'],
      };
    }

    return {
      type: 'object',
      properties: {
        artifacts: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              filename: {
                type: 'string',
                enum: expectedFiles,
              },
              content: {
                type: 'string',
              },
            },
            required: ['filename', 'content'],
          },
        },
      },
      required: ['artifacts'],
    };
  }

  /**
   * Generate artifacts with structured JSON output
   * Compatible with DEPENDENCIES and STACK_SELECTION phases
   */
  async generateStructuredArtifacts(
    prompt: string,
    expectedFiles: string[],
    phase?: string,
    options?: {
      temperature?: number;
      maxOutputTokens?: number;
      retries?: number;
    }
  ): Promise<Record<string, string>> {
    logger.info('[ZaiClient] Generating structured artifacts', {
      expectedFiles,
      phase,
      options,
    });

    // Build enhanced prompt with JSON schema requirement
    const schema = this.buildArtifactSchema(expectedFiles);
    const enhancedPrompt = `${prompt}

CRITICAL: You MUST respond with ONLY a valid JSON object in this exact format:
{
  "artifacts": [
    {
      "filename": "${expectedFiles[0]}",
      "content": "... complete file content ..."
    }${
      expectedFiles.length > 1
        ? `,
    {
      "filename": "${expectedFiles[1]}",
      "content": "... complete file content ..."
    }`
        : ''
    }
  ]
}

Required files: ${expectedFiles.join(', ')}

RULES:
1. Output ONLY valid JSON, no markdown code blocks
2. Include ALL ${expectedFiles.length} files in the artifacts array
3. Each artifact must have "filename" and "content" fields
4. Content must be complete and valid for its file type
5. Do not truncate or abbreviate any content

Generate the JSON now:`;

    const retries = options?.retries ?? 2;
    let temperature = this.temperature;
    let maxTokens = this.maxTokens;

    if (phase && this.phaseOverrides[phase]) {
      const override = this.phaseOverrides[phase];
      temperature = override.temperature ?? temperature;
      maxTokens = override.max_tokens ?? maxTokens;
    }

    if (options?.temperature !== undefined) {
      temperature = options.temperature;
    }
    if (options?.maxOutputTokens !== undefined) {
      maxTokens = options.maxOutputTokens;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      this.timeoutSeconds * 1000
    );

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: 'system',
              content:
                'You are a code generation assistant. Always respond with valid JSON only, no markdown formatting.',
            },
            { role: 'user', content: enhancedPrompt },
          ],
          max_tokens: maxTokens,
          temperature,
          response_format: { type: 'json_object' }, // Z.ai JSON mode
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(
          `Z.ai API error: ${
            error.error?.message || error.msg || response.statusText
          }`
        );
      }

      const data = await response.json();
      const choice = data.choices?.[0];
      const responseContent =
        choice?.message?.content || choice?.message?.reasoning_content;

      if (!responseContent) {
        throw new Error('No content in Z.ai structured output response');
      }

      // Parse JSON response
      let parsed: any;
      try {
        parsed = JSON.parse(responseContent);
      } catch (parseError) {
        throw new Error(
          `Failed to parse JSON from Z.ai: ${(parseError as Error).message}. ` +
            `Response: ${responseContent.slice(0, 500)}...`
        );
      }

      // Validate structure
      if (!parsed.artifacts || !Array.isArray(parsed.artifacts)) {
        throw new Error(
          `Invalid structure: expected {artifacts: [...]}. Got: ${JSON.stringify(
            parsed
          ).slice(0, 200)}`
        );
      }

      // Convert to Record<filename, content>
      const result: Record<string, string> = {};
      const foundFiles: string[] = [];

      for (const artifact of parsed.artifacts) {
        if (artifact.filename && typeof artifact.content === 'string') {
          result[artifact.filename] = artifact.content;
          foundFiles.push(artifact.filename);
        }
      }

      // Check all expected files are present
      const missing = expectedFiles.filter((f) => !result[f]);
      if (missing.length > 0) {
        throw new Error(
          `Missing required files. Expected: ${expectedFiles.join(', ')}. ` +
            `Found: ${foundFiles.join(', ')}`
        );
      }

      logger.info('[ZaiClient] Successfully generated structured artifacts', {
        files: foundFiles,
        phase,
      });

      return result;
    } catch (error) {
      clearTimeout(timeoutId);
      logger.error(
        '[ZaiClient] Structured generation failed',
        error instanceof Error ? error : new Error(String(error)),
        { expectedFiles, phase }
      );
      throw error;
    }
  }
}
