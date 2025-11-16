// Core types for the orchestrator system

export interface Phase {
  name: string;
  description: string;
  owner: string | string[];
  duration_minutes: number;
  inputs: string[];
  outputs: string[];
  depends_on?: string[];
  gates?: string[];
  next_phase: string;
  validators: string[];
}

export interface Stack {
  id: string;
  name: string;
  description: string;
  composition: {
    frontend: string;
    mobile: string;
    backend: string;
    database: string;
    deployment: string;
  };
  best_for: string[];
  strengths: string[];
  tradeoffs: string[];
  scaling: string;
}

export interface Agent {
  role: string;
  perspective: string;
  responsibilities: string[];
  prompt_template: string;
}

export interface Validator {
  description: string;
  implementation: string;
  [key: string]: unknown;
}

export interface OrchestratorSpec {
  phases: Record<string, Phase>;
  stacks: Record<string, Stack>;
  agents: Record<string, Agent>;
  validators: Record<string, Validator>;
  security_baseline: Record<string, unknown>;
  file_structure: Record<string, unknown>;
  llm_config: Record<string, unknown>;
  project_defaults: Record<string, unknown>;
}

export interface Project {
  id: string;
  slug: string;
  name: string;
  description: string;
  created_by_id: string;
  current_phase: string;
  phases_completed: string[];
  stack_choice?: string;
  stack_approved: boolean;
  stack_approval_date?: Date;
  dependencies_approved: boolean;
  dependencies_approval_date?: Date;
  orchestration_state: OrchestrationState;
  project_path: string;
  created_at: Date;
  updated_at: Date;
}

export interface OrchestrationState {
  artifact_versions: Record<string, number>;
  validation_results: Record<string, ValidationResult>;
  approval_gates: Record<string, boolean>;
}

export interface ValidationResult {
  status: 'pass' | 'warn' | 'fail';
  checks: Record<string, unknown>;
  errors?: string[];
  warnings?: string[];
}

export interface ProjectArtifact {
  id: string;
  project_id: string;
  phase: string;
  artifact_name: string;
  version: number;
  file_path: string;
  file_size: number;
  content_hash: string;
  frontmatter?: Record<string, unknown>;
  validation_status: string;
  validation_errors?: string[];
  created_at: Date;
  updated_at: Date;
}

export interface PhaseHistory {
  id: string;
  project_id: string;
  from_phase: string;
  to_phase: string;
  artifacts_generated: string[];
  validation_passed: boolean;
  validation_errors?: string[];
  gate_name?: string;
  gate_passed?: boolean;
  gate_notes?: string;
  transitioned_by: string;
  transition_date: Date;
  notes?: string;
}

export interface StackProposal {
  options: Stack[];
  recommendation?: string;
  reasoning?: string;
}

export interface DependencyProposal {
  dependencies_md: string;
  summary: {
    node_packages: number;
    python_packages?: number;
    security_issues: number;
  };
}

export interface HandoffPrompt {
  prompt: string;
  ready_to_copy: boolean;
  project_context: {
    name: string;
    stack: string;
    description: string;
  };
}