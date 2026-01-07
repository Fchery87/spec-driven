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
  clarification?: ClarificationConfig;
  quality_checklist?: string[];
  requires_stack?: boolean;
  priority?: number;
}

// Clarification System Types (GitHub Spec Kit inspired)
export type ClarificationMode = 'interactive' | 'hybrid' | 'auto_resolve';

export interface ClarificationConfig {
  enabled: boolean;
  default_mode: ClarificationMode;
  max_questions: number;
  allow_skip: boolean;
  uncertainty_marker: string;
  assumption_marker: string;
}

export interface ClarificationQuestion {
  id: string;
  category: string;
  question: string;
  context?: string;
  suggestedOptions?: string[];
  userAnswer?: string;
  aiAssumed?: {
    assumption: string;
    rationale: string;
  };
  resolved: boolean;
  resolvedBy: 'user' | 'ai' | null;
}

export interface ClarificationState {
  mode: ClarificationMode;
  questions: ClarificationQuestion[];
  completed: boolean;
  skipped: boolean;
}

export interface Stack {
  id: string;
  name: string;
  description: string;
  composition: {
    // New architecture pattern format
    pattern?: string;
    examples?: string;
    // Legacy format
    frontend?: string;
    mobile?: string;
    // Common fields
    backend: string;
    database: string;
    deployment: string;
    // Mobile-specific
    features?: string;
    // API-first specific
    clients?: string;
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

import { CompositionSystem, LegacyTemplateMapping } from './composition';

export interface OrchestratorSpec {
  phases: Record<string, Phase>;
  stacks: Record<string, Stack>;
  composition_system?: CompositionSystem;
  legacy_template_migration?: Record<string, LegacyTemplateMapping>;
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
  project_type?: string;
  scale_tier?: string;
  recommended_stack?: string;
  workflow_version?: number;
  orchestration_state: OrchestrationState;
  project_path: string;
  created_at: Date;
  updated_at: Date;
}

export interface OrchestrationState {
  artifact_versions: Record<string, number>;
  validation_results?: Record<string, ValidationResult>;
  approval_gates: Record<string, boolean>;
  phase_history?: PhaseHistory[];
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

// Artifact Change Detection Types
export type ImpactLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export type ChangeType = 'added' | 'modified' | 'deleted';

export interface ChangedSection {
  header: string;
  changeType: ChangeType;
  oldContent?: string;
  newContent?: string;
  lineNumber: number;
}

export interface ArtifactChange {
  projectId: string;
  artifactName: string;
  oldHash: string;
  newHash: string;
  hasChanges: boolean;
  impactLevel: ImpactLevel;
  changedSections: ChangedSection[];
  timestamp: Date;
}

// Impact Analysis Types
export type RegenerationStrategy =
  | 'regenerate_all'
  | 'high_impact_only'
  | 'manual_review'
  | 'ignore';

export interface AffectedArtifact {
  artifactId: string;
  artifactName: string;
  phase: string;
  impactLevel: ImpactLevel;
  reason: string;
  changeType?: ChangeType;
  changedSection?: string;
}

export interface ImpactAnalysis {
  triggerChange: ArtifactChange;
  affectedArtifacts: AffectedArtifact[];
  impactSummary: {
    high: number;
    medium: number;
    low: number;
  };
  recommendedStrategy: RegenerationStrategy;
  reasoning: string;
}

// Regeneration result interface
export interface RegenerationResult {
  success: boolean;
  regenerationRunId: string | null;
  selectedStrategy: RegenerationStrategy;
  artifactsToRegenerate: string[];
  artifactsRegenerated: string[];
  artifactsSkipped: string[];
  durationMs: number;
  errorMessage?: string;
}

// Options for executing regeneration workflow
export interface RegenerationOptions {
  triggerArtifactId: string;
  triggerChangeId?: string;
  selectedStrategy: RegenerationStrategy;
  userId?: string;
  // For manual_review strategy - user specifies which artifacts to regenerate
  manualArtifactIds?: string[];
}

// Parallel Execution Types
export interface ParallelGroup {
  name: string;
  type: 'parallel';
  phases: string[];
}

export interface PhaseExecutionResult {
  phase: string;
  success: boolean;
  artifacts: Record<string, string | Buffer>;
  error?: string;
  durationMs: number;
}

// Options for parallel workflow execution
export interface ParallelWorkflowOptions {
  enableParallel: boolean;
  fallbackToSequential: boolean;
}

// Result from parallel workflow execution
export interface ParallelWorkflowResult {
  success: boolean;
  projectId: string;
  phasesExecuted: string[];
  groupsExecuted: Array<{
    name: string;
    type: 'parallel' | 'sequential';
    phases: string[];
    success: boolean;
    durationMs: number;
    results: PhaseExecutionResult[];
  }>;
  totalDurationMs: number;
  parallelDurationMs: number;
  sequentialDurationMs: number;
  timeSavedMs: number;
  timeSavedPercent: number;
  errors: Array<{ phase: string; error: string }>;
  fallbackUsed: boolean;
}
