/**
 * Superpowers Skill Invocation Framework - Type Definitions
 * 
 * This module defines the core types for skill invocation and execution
 * within the orchestrator system.
 */

/**
 * Available Superpowers skills that can be invoked
 */
export type SuperpowersSkill = 
  | 'brainstorming'
  | 'writing_plans'
  | 'systematic_debugging'
  | 'verification_before_completion'
  | 'subagent_driven_development'
  | 'finishing_a_development_branch';

/**
 * Context passed to skill adapters during execution
 */
export interface SkillContext {
  skill: SuperpowersSkill;
  phase: string;
  projectId: string;
  projectName: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
}

/**
 * Result returned by skill adapters after execution
 */
export interface SkillResult {
  success: boolean;
  output: Record<string, unknown>;
  errors: string[];
  durationMs: number;
}

/**
 * Configuration for skill integration in orchestrator phases
 */
export interface SuperpowersIntegrationConfig {
  skill: SuperpowersSkill;
  trigger: 'pre_generation' | 'post_generation' | 'on_demand';
  input_mapping?: Record<string, string>;
  output_mapping?: Record<string, string>;
  condition?: Record<string, string>;
}

/**
 * Base interface for all skill adapters
 */
export interface SkillAdapter {
  skill: SuperpowersSkill;
  
  /**
   * Determines if this adapter can handle the given phase and context
   */
  canHandle(phase: string, context: Record<string, unknown>): boolean;
  
  /**
   * Executes the skill with the given input and context
   */
  execute(input: Record<string, unknown>, context: SkillContext): Promise<SkillResult>;
}

/**
 * Input mapping configuration for transforming context data to skill input
 */
export interface InputMapping {
  source: string;
  transform?: string;
}

/**
 * Output mapping configuration for transforming skill output to context
 */
export interface OutputMapping {
  target: string;
  source: string;
}
