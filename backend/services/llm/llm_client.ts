import { LLMConfig, LLMResponse, AgentContext, AgentOutput } from '@/types/llm';

export class GeminiClient {
  private config: LLMConfig;
  private baseUrl: string = 'https://generativelanguage.googleapis.com/v1beta';

  constructor(config: LLMConfig) {
    this.config = config;
  }

  /**
   * Generate completion from Gemini API with retry logic
   */
  async generateCompletion(prompt: string, context?: string[], retries = 3): Promise<LLMResponse> {
    if (!this.config.api_key) {
      throw new Error('Gemini API key not configured');
    }

    const requestBody = {
      contents: [
        {
          parts: [
            {
              text: this.buildPrompt(prompt, context)
            }
          ]
        }
      ],
      generationConfig: {
        temperature: this.config.temperature,
        maxOutputTokens: this.config.max_tokens,
        candidateCount: 1
      }
    };

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await fetch(
          `${this.baseUrl}/models/${this.config.model}:generateContent?key=${this.config.api_key}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
          }
        );

        if (response.status === 429) {
          // Rate limit - wait and retry
          const waitTime = Math.pow(2, attempt) * 1000; // Exponential backoff
          console.log(`Rate limited. Waiting ${waitTime}ms before retry ${attempt + 1}/${retries}...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Gemini API error: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const data = await response.json();

        return this.parseResponse(data);
      } catch (error) {
        lastError = error as Error;

        // If it's a rate limit error and we have retries left, continue
        if (error instanceof Error && error.message.includes('429') && attempt < retries) {
          const waitTime = Math.pow(2, attempt) * 1000;
          console.log(`Rate limited. Waiting ${waitTime}ms before retry ${attempt + 1}/${retries}...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }

        // If not a rate limit or no retries left, throw
        if (attempt === retries) {
          console.error('Gemini API call failed after retries:', error);
          throw new Error(`Failed to generate completion after ${retries} retries: ${error}`);
        }
      }
    }

    throw lastError || new Error('Failed to generate completion');
  }

  /**
   * Generate completion with context documents
   */
  async generateWithContext(prompt: string, artifacts: Record<string, string>): Promise<LLMResponse> {
    const context = Object.values(artifacts);
    return this.generateCompletion(prompt, context);
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
        total_tokens: data.usageMetadata?.totalTokenCount || 0
      },
      model: this.config.model,
      finish_reason: candidate.finishReason
    };
  }

  /**
   * Test connection to Gemini API
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.generateCompletion('Hello', []);
      return true;
    } catch {
      return false;
    }
  }
}