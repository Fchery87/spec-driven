import { logger } from '@/lib/logger';
import { LLMResponse, LLMConfigWithOverrides, PhaseOverride } from '@/types/llm';
import { LLMProvider } from './base';

export class GroqClient implements LLMProvider {
  private apiKey: string;
  private model: string;
  private maxTokens: number;
  private temperature: number;
  private timeoutSeconds: number;
  private topP?: number;
  private phaseOverrides: Record<string, PhaseOverride>;

  constructor(config: LLMConfigWithOverrides) {
    this.apiKey = config.api_key || process.env.GROQ_API_KEY || '';
    this.model = config.model || 'llama-3.3-70b-versatile';
    this.maxTokens = config.max_tokens || 8192;
    this.temperature = config.temperature ?? 0.7;
    this.timeoutSeconds = config.timeout_seconds || 300;
    this.topP = config.top_p;
    this.phaseOverrides = config.phase_overrides || {};

    if (!this.apiKey) {
      logger.warn('Groq API key not provided');
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch('https://api.groq.com/openai/v1/models', {
        headers: { 'Authorization': `Bearer ${this.apiKey}` }
      });
      return response.ok;
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

    logger.info('Generating completion with Groq:', {
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
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
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
          logger.warn(`Rate limited by Groq API. Waiting ${backoffMs}ms before retry ${attempt + 1}/${retries}...`);
          await new Promise(resolve => setTimeout(resolve, backoffMs));
          continue;
        }

        if (!response.ok) {
          const error = await response.json();
          throw new Error(`Groq API error: ${error.error?.message || response.statusText}`);
        }

        const data = await response.json();
        const choice = data.choices?.[0];

        if (!choice?.message?.content) {
          throw new Error('No content in Groq response');
        }

        if (choice.finish_reason === 'length') {
          logger.warn('Groq response was truncated due to max_tokens limit');
        }

        return {
          content: choice.message.content,
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
          logger.error('Groq API call timed out', new Error('Request timeout'), {
            timeoutSeconds: this.timeoutSeconds,
            attempt,
            phase
          });
          throw new Error('Request timeout');
        }

        if (attempt === retries) {
          logger.error('Groq API call failed after all retries', error instanceof Error ? error : new Error(String(error)), { attempt, phase });
          throw error;
        }

        logger.warn(`Groq API error, retrying (${attempt}/${retries})...`, {
          error: error instanceof Error ? error.message : String(error)
        });
        await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
      }
    }

    throw new Error('Failed to generate completion after all retries');
  }
}
