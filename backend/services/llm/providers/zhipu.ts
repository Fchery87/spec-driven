import { logger } from '@/lib/logger';
import { LLMResponse, LLMConfigWithOverrides, PhaseOverride } from '@/types/llm';
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
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Hi' }]
        })
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

    const systemPrompt = contextDocs.length > 0
      ? `You are an expert software architect and project manager. Use the following context documents:\n\n${contextDocs.join('\n\n---\n\n')}`
      : 'You are an expert software architect and project manager.';

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt }
    ];

    logger.info('Generating completion with Z.ai GLM:', {
      model: this.model,
      promptLength: prompt.length,
      temperature,
      maxTokens,
      topP,
      phase,
      contextDocsCount: contextDocs.length
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutSeconds * 1000);

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          },
          body: JSON.stringify({
            model: this.model,
            messages,
            max_tokens: maxTokens,
            temperature,
            ...(topP !== undefined && { top_p: topP })
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.status === 429) {
          const backoffMs = Math.pow(2, attempt) * 1000;
          logger.warn(`Rate limited by Z.ai API. Waiting ${backoffMs}ms before retry ${attempt + 1}/${retries}...`);
          await new Promise(resolve => setTimeout(resolve, backoffMs));
          continue;
        }

        if (!response.ok) {
          const error = await response.json();
          throw new Error(`Z.ai API error: ${error.error?.message || error.msg || response.statusText}`);
        }

        const data = await response.json();
        const choice = data.choices?.[0];

        // GLM-4.6 uses reasoning_content for chain-of-thought models
        // Fall back to content if reasoning_content is not present
        const responseContent = choice?.message?.content || choice?.message?.reasoning_content;

        if (!responseContent) {
          logger.error('No content in Z.ai response', new Error('Empty response'), {
            hasMessage: !!choice?.message,
            hasContent: !!choice?.message?.content,
            hasReasoningContent: !!choice?.message?.reasoning_content,
            finishReason: choice?.finish_reason
          });
          throw new Error('No content in Z.ai response');
        }

        if (choice.finish_reason === 'length') {
          logger.warn('Z.ai response was truncated due to max_tokens limit');
        }

        return {
          content: responseContent,
          model: data.model,
          finish_reason: choice.finish_reason,
          usage: data.usage ? {
            prompt_tokens: data.usage.prompt_tokens,
            completion_tokens: data.usage.completion_tokens,
            total_tokens: data.usage.total_tokens
          } : undefined
        };
      } catch (error) {
        clearTimeout(timeoutId);
        
        if (error instanceof Error && error.name === 'AbortError') {
          logger.error('Z.ai API call timed out', new Error('Request timeout'), {
            timeoutSeconds: this.timeoutSeconds,
            attempt,
            phase
          });
          throw new Error('Request timeout');
        }

        if (attempt === retries) {
          logger.error('Z.ai API call failed after all retries', error instanceof Error ? error : new Error(String(error)), { attempt, phase });
          throw error;
        }

        logger.warn(`Z.ai API error, retrying (${attempt}/${retries})...`, {
          error: error instanceof Error ? error.message : String(error)
        });
        await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
      }
    }

    throw new Error('Failed to generate completion after all retries');
  }
}
