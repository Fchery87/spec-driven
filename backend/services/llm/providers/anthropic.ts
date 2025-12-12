import { logger } from '@/lib/logger';
import { LLMResponse, LLMConfigWithOverrides, PhaseOverride } from '@/types/llm';
import { LLMProvider } from './base';

export class AnthropicClient implements LLMProvider {
  private apiKey: string;
  private model: string;
  private maxTokens: number;
  private temperature: number;
  private timeoutSeconds: number;
  private topP?: number;
  private phaseOverrides: Record<string, PhaseOverride>;

  constructor(config: LLMConfigWithOverrides) {
    this.apiKey = config.api_key || process.env.ANTHROPIC_API_KEY || '';
    this.model = config.model || 'claude-3-5-sonnet-20241022';
    this.maxTokens = config.max_tokens || 8192;
    this.temperature = config.temperature ?? 0.7;
    this.timeoutSeconds = config.timeout_seconds || 120;
    this.topP = config.top_p;
    this.phaseOverrides = config.phase_overrides || {};

    if (!this.apiKey) {
      logger.warn('Anthropic API key not provided');
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Hi' }]
        })
      });
      return response.ok || response.status === 400; // 400 means API is reachable but invalid request
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

    logger.info('Generating completion with Anthropic:', {
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
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.apiKey,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: this.model,
            max_tokens: maxTokens,
            temperature,
            system: systemPrompt,
            messages: [{ role: 'user', content: prompt }],
            ...(topP !== undefined && { top_p: topP })
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.status === 429) {
          const backoffMs = Math.pow(2, attempt) * 1000;
          logger.warn(`Rate limited by Anthropic API. Waiting ${backoffMs}ms before retry ${attempt + 1}/${retries}...`);
          await new Promise(resolve => setTimeout(resolve, backoffMs));
          continue;
        }

        if (!response.ok) {
          const error = await response.json();
          throw new Error(`Anthropic API error: ${error.error?.message || response.statusText}`);
        }

        const data = await response.json();
        const content = data.content?.[0];

        if (!content?.text) {
          throw new Error('No content in Anthropic response');
        }

        if (data.stop_reason === 'max_tokens') {
          logger.warn('Anthropic response was truncated due to max_tokens limit');
        }

        return {
          content: content.text,
          model: data.model,
          finish_reason: data.stop_reason,
          usage: data.usage ? {
            prompt_tokens: data.usage.input_tokens,
            completion_tokens: data.usage.output_tokens,
            total_tokens: data.usage.input_tokens + data.usage.output_tokens
          } : undefined
        };
      } catch (error) {
        clearTimeout(timeoutId);
        
        if (error instanceof Error && error.name === 'AbortError') {
          logger.error('Anthropic API call timed out', new Error('Request timeout'), {
            timeoutSeconds: this.timeoutSeconds,
            attempt,
            phase
          });
          throw new Error('Request timeout');
        }

        if (attempt === retries) {
          logger.error('Anthropic API call failed after all retries', error instanceof Error ? error : new Error(String(error)), { attempt, phase });
          throw error;
        }

        logger.warn(`Anthropic API error, retrying (${attempt}/${retries})...`, {
          error: error instanceof Error ? error.message : String(error)
        });
        await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
      }
    }

    throw new Error('Failed to generate completion after all retries');
  }
}
