export interface LLMConfig {
  provider: string;
  model: string;
  max_tokens: number;
  temperature: number;
  timeout_seconds: number;
  api_key?: string;
}

export interface LLMResponse {
  content: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model: string;
  finish_reason?: string;
}

export interface AgentContext {
  project_id: string;
  phase: string;
  artifacts: Record<string, string>;
  user_input?: string;
}

export interface AgentOutput {
  artifacts: Record<string, string>;
  metadata?: Record<string, any>;
  next_actions?: string[];
}