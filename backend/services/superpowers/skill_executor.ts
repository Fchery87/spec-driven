/**
 * Superpowers Skill Invocation Framework - Skill Executor
 * 
 * Orchestrates skill execution and manages skill adapters.
 */

import { SkillContext, SkillResult, SuperpowersSkill } from './types';
import { SkillAdapter } from './skill_adapter';
import { BrainstormingAdapter } from './adapters/brainstorming_adapter';
import { WritingPlansAdapter } from './adapters/writing_plans_adapter';
import { SystematicDebuggingAdapter } from './adapters/systematic_debugging_adapter';
import { VerificationAdapter } from './adapters/verification_adapter';
import { SubagentDrivenDevAdapter } from './adapters/subagent_driven_dev_adapter';
import { FinishingBranchAdapter } from './adapters/finishing_branch_adapter';

export class SuperpowersExecutor {
  private adapters: Map<SuperpowersSkill, SkillAdapter>;
  
  constructor() {
    this.adapters = new Map<SuperpowersSkill, SkillAdapter>([
      ['brainstorming', new BrainstormingAdapter()],
      ['writing_plans', new WritingPlansAdapter()],
      ['systematic_debugging', new SystematicDebuggingAdapter()],
      ['verification_before_completion', new VerificationAdapter()],
      ['subagent_driven_development', new SubagentDrivenDevAdapter()],
      ['finishing_a_development_branch', new FinishingBranchAdapter()],
    ]);
  }
  
  /**
   * Execute a skill with the given parameters
   */
  async executeSkill(
    skill: SuperpowersSkill,
    phase: string,
    input: Record<string, unknown>,
    projectId: string,
    projectName: string
  ): Promise<SkillResult> {
    const adapter = this.adapters.get(skill);
    
    if (!adapter) {
      return {
        success: false,
        output: {},
        errors: [`Unknown skill: ${skill}`],
        durationMs: 0,
      };
    }
    
    if (!adapter.canHandle(phase, input)) {
      return {
        success: false,
        output: {},
        errors: [`Skill ${skill} cannot handle phase ${phase}`],
        durationMs: 0,
      };
    }
    
    const context: SkillContext = {
      skill,
      phase,
      projectId,
      projectName,
      input,
      output: {},
    };
    
    return adapter.execute(input, context);
  }
  
  /**
   * Get all skills available for a given phase
   */
  getAvailableSkills(phase: string): SuperpowersSkill[] {
    const available: SuperpowersSkill[] = [];
    
    for (const [skill, adapter] of this.adapters) {
      if (adapter.canHandle(phase, {})) {
        available.push(skill);
      }
    }
    
    return available;
  }
  
  /**
   * Get all registered skills
   */
  getAllSkills(): SuperpowersSkill[] {
    return Array.from(this.adapters.keys());
  }
  
  /**
   * Check if a specific skill is available for a phase
   */
  isSkillAvailable(skill: SuperpowersSkill, phase: string): boolean {
    const adapter = this.adapters.get(skill);
    return adapter?.canHandle(phase, {}) ?? false;
  }
  
  /**
   * Get skill metadata
   */
  getSkillInfo(skill: SuperpowersSkill): { name: string; description: string } | null {
    const adapter = this.adapters.get(skill);
    if (!adapter) return null;
    
    const descriptions: Record<SuperpowersSkill, { name: string; description: string }> = {
      brainstorming: {
        name: 'Brainstorming',
        description: 'Generates creative ideas and recommendations for project phases',
      },
      writing_plans: {
        name: 'Writing Plans',
        description: 'Creates structured plans and documentation for project phases',
      },
      systematic_debugging: {
        name: 'Systematic Debugging',
        description: 'Provides structured debugging approaches for issue resolution',
      },
      verification_before_completion: {
        name: 'Verification Before Completion',
        description: 'Performs comprehensive verification before completing phases',
      },
      subagent_driven_development: {
        name: 'Subagent-Driven Development',
        description: 'Manages parallel execution of subagents for complex tasks',
      },
      finishing_a_development_branch: {
        name: 'Finishing Development Branch',
        description: 'Handles branch finalization and cleanup',
      },
    };
    
    return descriptions[skill] ?? null;
  }
  
  /**
   * Map input values based on mapping configuration
   */
  mapInputs(
    inputMapping: Record<string, string>,
    sourceContext: Record<string, unknown>
  ): Record<string, unknown> {
    const mappedInput: Record<string, unknown> = {};
    
    for (const [targetField, sourcePath] of Object.entries(inputMapping)) {
      const value = this.getNestedValue(sourceContext, sourcePath);
      mappedInput[targetField] = value;
    }
    
    return mappedInput;
  }
  
  /**
   * Merge output values based on mapping configuration
   */
  mergeOutputs(
    outputMapping: Record<string, string>,
    sourceOutput: Record<string, unknown>,
    targetContext: Record<string, unknown>
  ): void {
    for (const [targetPath, sourceField] of Object.entries(outputMapping)) {
      const value = sourceOutput[sourceField];
      this.setNestedValue(targetContext, targetPath, value);
    }
  }
  
  /**
   * Get nested value from object using dot notation path
   */
  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    const parts = path.split('.');
    let current: unknown = obj;
    
    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = (current as Record<string, unknown>)[part];
    }
    
    return current;
  }
  
  /**
   * Set nested value in object using dot notation path
   */
  private setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
    const parts = path.split('.');
    let current: Record<string, unknown> = obj;
    
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!(part in current)) {
        current[part] = {};
      }
      current = current[part] as Record<string, unknown>;
    }
    
    current[parts[parts.length - 1]] = value;
  }
}
