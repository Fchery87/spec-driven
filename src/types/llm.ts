export interface LLMConfig {
  provider: string;
  model: string;
  max_tokens: number;
  temperature: number;
  timeout_seconds: number;
  api_key?: string;
  top_p?: number;
  phase?: string;  // Current phase for applying overrides
  streaming_validation?: StreamingValidationConfig;
}

export interface StreamingValidationConfig {
  enabled?: boolean;
  abort_on_violations?: boolean;
  check_interval_ms?: number;
  patterns?: {
    placeholder?: string[];
    slop?: string[];
    format?: string[];
  };
  enabled_phases?: string[];
  phase_overrides?: Record<string, {
    abort_on_violations?: boolean;
    check_interval_ms?: number;
    patterns?: {
      placeholder?: string[];
      slop?: string[];
      format?: string[];
    };
  }>;
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

/**
 * Model capability definition with output token limits
 * This allows the system to automatically adjust phase token limits based on model capabilities
 */
export interface ModelCapability {
  /** Model identifier (e.g., 'gemini-3.0-flash', 'gpt-4o') */
  id: string;
  /** Provider type (gemini, openai, anthropic, etc.) */
  provider: string;
  /** Maximum output tokens this model supports */
  maxOutputTokens: number;
  /** Maximum input context window in tokens */
  maxInputTokens?: number;
  /** Model description */
  description?: string;
}

/**
 * Phase-specific token configuration that can be percentage-based or absolute
 * Supports both legacy absolute values and new percentage-based allocation
 */
export interface PhaseTokenConfig {
  /** Absolute max tokens (legacy, overrides percentageAllocation if present) */
  max_tokens?: number;
  /** Percentage of model's max output tokens to allocate to this phase (0-100) */
  percentageAllocation?: number;
  /** Minimum guaranteed tokens for this phase */
  minTokens?: number;
  /** Maximum cap for this phase (prevent allocation from exceeding this) */
  maxTokensCap?: number;
}

/**
 * Extended phase override with dynamic token allocation support
 */
export interface DynamicPhaseOverride extends PhaseOverride {
  percentageAllocation?: number;
  minTokens?: number;
  maxTokensCap?: number;
}