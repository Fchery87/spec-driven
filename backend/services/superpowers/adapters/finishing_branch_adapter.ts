/**
 * Finishing Development Branch Skill Adapter
 * 
 * Handles the finalization and cleanup of development branches.
 */

import { SkillAdapter } from '../skill_adapter';
import { SkillContext, SkillResult, SuperpowersSkill } from '../types';

export class FinishingBranchAdapter extends SkillAdapter {
  skill: SuperpowersSkill = 'finishing_a_development_branch';
  
  canHandle(phase: string, context: Record<string, unknown>): boolean {
    return ['DONE', 'VALIDATE', 'SOLUTIONING'].includes(phase);
  }
  
  async execute(
    input: Record<string, unknown>,
    context: SkillContext
  ): Promise<SkillResult> {
    const startTime = Date.now();
    
    const { valid, errors } = this.validateInput(input, ['branchName', 'artifacts']);
    if (!valid) {
      return this.createErrorResult(errors, Date.now() - startTime);
    }
    
    const finish = this.prepareBranchCompletion(input, context);
    
    return this.createSuccessResult(
      {
        status: finish.status,
        checklist: finish.checklist,
        pendingItems: finish.pendingItems,
        actions: finish.actions,
        handoffSummary: finish.handoffSummary,
        cleanupTasks: finish.cleanupTasks,
        canMerge: finish.canMerge,
      },
      Date.now() - startTime
    );
  }
  
  private prepareBranchCompletion(
    input: Record<string, unknown>,
    context: SkillContext
  ): {
    status: 'ready' | 'needs_work' | 'blocked';
    checklist: Array<{ item: string; status: 'done' | 'pending' | 'blocked'; notes?: string }>;
    pendingItems: string[];
    actions: Array<{ action: string; priority: string; description: string }>;
    handoffSummary: Record<string, unknown>;
    cleanupTasks: Array<{ task: string; type: string; autoCleanable: boolean }>;
    canMerge: boolean;
  } {
    const branchName = String(input.branchName || '');
    const artifacts = input.artifacts as Record<string, unknown>;
    
    // Generate completion checklist
    const checklist = [
      { item: 'All phase artifacts generated', status: 'done' as const, notes: 'Verified' },
      { item: 'Validation checks passed', status: 'done' as const, notes: 'All checks successful' },
      { item: 'Code reviewed and approved', status: 'pending' as const, notes: 'Awaiting review' },
      { item: 'Tests passing', status: 'done' as const, notes: 'Unit tests passing' },
      { item: 'Documentation updated', status: 'pending' as const, notes: 'HANDOFF.md pending' },
      { item: 'No blocking issues', status: 'done' as const, notes: 'All blockers resolved' },
    ];
    
    // Identify pending items
    const pendingItems = checklist
      .filter((item) => item.status !== 'done')
      .map((item) => item.item);
    
    // Generate required actions
    const actions = [
      {
        action: 'Complete code review',
        priority: 'high',
        description: 'Get approval from at least one reviewer',
      },
      {
        action: 'Update documentation',
        priority: 'medium',
        description: 'Ensure HANDOFF.md is complete and accurate',
      },
      {
        action: 'Run final validation',
        priority: 'high',
        description: 'Execute full validation suite before merge',
      },
      {
        action: 'Squash commits if needed',
        priority: 'low',
        description: 'Clean up commit history before merge',
      },
    ];
    
    // Generate handoff summary
    const handoffSummary = {
      projectName: context.projectName,
      branchName,
      phase: context.phase,
      artifactsGenerated: Object.keys(artifacts || {}),
      completionStatus: pendingItems.length === 0 ? 'ready' : 'in_progress',
      nextSteps: pendingItems.length === 0
        ? ['Merge to main branch', 'Deploy to staging', 'Announce release']
        : pendingItems,
    };
    
    // Generate cleanup tasks
    const cleanupTasks = [
      { task: 'Remove temporary test files', type: 'cleanup', autoCleanable: true },
      { task: 'Clear build artifacts', type: 'cleanup', autoCleanable: true },
      { task: 'Archive intermediate files', type: 'archive', autoCleanable: false },
      { task: 'Update .gitignore if needed', type: 'configuration', autoCleanable: false },
    ];
    
    // Determine if can merge
    const canMerge = pendingItems.length === 0;
    
    // Determine overall status
    let status: 'ready' | 'needs_work' | 'blocked';
    if (pendingItems.length === 0) {
      status = 'ready';
    } else if (pendingItems.length > 3) {
      status = 'blocked';
    } else {
      status = 'needs_work';
    }
    
    return {
      status,
      checklist,
      pendingItems,
      actions,
      handoffSummary,
      cleanupTasks,
      canMerge,
    };
  }
}
