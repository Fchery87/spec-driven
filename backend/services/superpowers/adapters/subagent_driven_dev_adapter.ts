/**
 * Subagent-Driven Development Skill Adapter
 * 
 * Manages parallel execution of subagents for complex tasks.
 */

import { SkillAdapter } from '../skill_adapter';
import { SkillContext, SkillResult, SuperpowersSkill } from '../types';

export class SubagentDrivenDevAdapter extends SkillAdapter {
  skill: SuperpowersSkill = 'subagent_driven_development';
  
  canHandle(phase: string, context: Record<string, unknown>): boolean {
    return ['FRONTEND_BUILD', 'SOLUTIONING', 'SPEC_DESIGN_COMPONENTS'].includes(phase);
  }
  
  async execute(
    input: Record<string, unknown>,
    context: SkillContext
  ): Promise<SkillResult> {
    const startTime = Date.now();
    
    const { valid, errors } = this.validateInput(input, ['task', 'subtasks']);
    if (!valid) {
      return this.createErrorResult(errors, Date.now() - startTime);
    }
    
    const dispatch = this.dispatchSubagents(input, context);
    
    return this.createSuccessResult(
      {
        dispatchPlan: dispatch.dispatchPlan,
        executionOrder: dispatch.executionOrder,
        dependencies: dispatch.dependencies,
        parallelGroups: dispatch.parallelGroups,
        estimatedDuration: dispatch.estimatedDuration,
      },
      Date.now() - startTime
    );
  }
  
  private dispatchSubagents(
    input: Record<string, unknown>,
    context: SkillContext
  ): {
    dispatchPlan: Array<{
      subagentId: string;
      task: string;
      priority: number;
      dependencies: string[];
    }>;
    executionOrder: string[];
    dependencies: Record<string, string[]>;
    parallelGroups: Array<{ name: string; tasks: string[] }>;
    estimatedDuration: string;
  } {
    const task = String(input.task || '');
    const subtasks = input.subtasks as Record<string, unknown>[];
    
    const dispatchPlan: Array<{
      subagentId: string;
      task: string;
      priority: number;
      dependencies: string[];
    }> = [];
    
    const dependencies: Record<string, string[]> = {};
    
    // Generate dispatch plan for each subtask
    if (subtasks && Array.isArray(subtasks)) {
      let index = 0;
      for (const subtask of subtasks) {
        const subagentId = `subagent-${context.projectId}-${index}`;
        const subtaskName = subtask.name as string || `subtask-${index}`;
        
        dispatchPlan.push({
          subagentId,
          task: subtaskName,
          priority: subtask.priority as number || 1,
          dependencies: (subtask.dependencies as string[]) || [],
        });
        
        dependencies[subagentId] = (subtask.dependencies as string[]) || [];
        index++;
      }
    } else {
      // Default subtask for single task
      dispatchPlan.push({
        subagentId: `subagent-${context.projectId}-0`,
        task,
        priority: 1,
        dependencies: [],
      });
    }
    
    // Determine execution order based on dependencies
    const executionOrder = this.resolveExecutionOrder(dispatchPlan, dependencies);
    
    // Group tasks that can run in parallel
    const parallelGroups = this.identifyParallelGroups(dispatchPlan, dependencies);
    
    return {
      dispatchPlan,
      executionOrder,
      dependencies,
      parallelGroups,
      estimatedDuration: this.estimateDuration(dispatchPlan, parallelGroups),
    };
  }
  
  private resolveExecutionOrder(
    dispatchPlan: Array<{ subagentId: string; dependencies: string[] }>,
    dependencies: Record<string, string[]>
  ): string[] {
    const executed = new Set<string>();
    const result: string[] = [];
    
    // Simple topological sort
    const findNextExecutable = (): string | null => {
      for (const item of dispatchPlan) {
        if (executed.has(item.subagentId)) continue;
        
        const deps = dependencies[item.subagentId] || [];
        const allDepsExecuted = deps.every((d) => executed.has(d));
        
        if (allDepsExecuted) {
          return item.subagentId;
        }
      }
      return null;
    };
    
    while (true) {
      const next = findNextExecutable();
      if (!next) break;
      executed.add(next);
      result.push(next);
    }
    
    return result;
  }
  
  private identifyParallelGroups(
    dispatchPlan: Array<{ subagentId: string; dependencies: string[] }>,
    dependencies: Record<string, string[]>
  ): Array<{ name: string; tasks: string[] }> {
    const groups: Array<{ name: string; tasks: string[] }> = [];
    const executed = new Set<string>();
    
    let groupIndex = 0;
    
    while (executed.size < dispatchPlan.length) {
      const parallelTasks: string[] = [];
      
      for (const item of dispatchPlan) {
        if (executed.has(item.subagentId)) continue;
        
        const deps = dependencies[item.subagentId] || [];
        const allDepsExecuted = deps.every((d) => executed.has(d));
        
        if (allDepsExecuted) {
          parallelTasks.push(item.subagentId);
        }
      }
      
      if (parallelTasks.length > 0) {
        groups.push({
          name: `group-${groupIndex}`,
          tasks: parallelTasks,
        });
        
        parallelTasks.forEach((t) => executed.add(t));
        groupIndex++;
      } else {
        break;
      }
    }
    
    return groups;
  }
  
  private estimateDuration(
    dispatchPlan: Array<{ subagentId: string; priority: number }>,
    parallelGroups: Array<{ name: string; tasks: string[] }>
  ): string {
    // Estimate based on number of groups and priority
    const baseTimePerTask = 5; // minutes
    const totalTasks = dispatchPlan.length;
    const parallelGroupsCount = parallelGroups.length;
    
    // Sequential time: totalTasks * baseTimePerTask
    // Parallel time: parallelGroupsCount * baseTimePerTask * avgPriority
    const avgPriority =
      dispatchPlan.reduce((sum, t) => sum + t.priority, 0) / totalTasks || 1;
    
    const parallelMinutes = parallelGroupsCount * baseTimePerTask * avgPriority;
    const sequentialMinutes = totalTasks * baseTimePerTask;
    
    const timeSaved = sequentialMinutes - parallelMinutes;
    const savedPercent = Math.round((timeSaved / sequentialMinutes) * 100);
    
    return `~${Math.round(parallelMinutes)} minutes (${savedPercent}% faster with parallel execution)`;
  }
}
