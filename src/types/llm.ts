export interface LLMConfig {
  provider: string;
  model: string;
  max_tokens: number;
  temperature: number;
  timeout_seconds: number;
  api_key?: string;
  top_p?: number;
  phase?: string;  // Current phase for applying overrides
}

export interface PhaseOverride {
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
}

export interface LLMConfigWithOverrides extends LLMConfig {
  phase_overrides?: Record<string, PhaseOverride>;
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
  metadata?: Record<string, unknown>;
  next_actions?: string[];
}