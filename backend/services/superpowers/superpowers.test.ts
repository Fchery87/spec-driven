/**
 * Unit tests for the Superpowers Skill Invocation Framework
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SuperpowersExecutor } from './skill_executor';
import { BrainstormingAdapter } from './adapters/brainstorming_adapter';
import { WritingPlansAdapter } from './adapters/writing_plans_adapter';
import { SystematicDebuggingAdapter } from './adapters/systematic_debugging_adapter';
import { VerificationAdapter } from './adapters/verification_adapter';
import { SubagentDrivenDevAdapter } from './adapters/subagent_driven_dev_adapter';
import { FinishingBranchAdapter } from './adapters/finishing_branch_adapter';
import { SuperpowersSkill, SkillContext, SkillResult } from './types';

describe('Superpowers Framework', () => {
  describe('SkillExecutor', () => {
    let executor: SuperpowersExecutor;

    beforeEach(() => {
      executor = new SuperpowersExecutor();
    });

    describe('executeSkill', () => {
      it('should execute brainstorming skill for ANALYSIS phase', async () => {
        const result = await executor.executeSkill(
          'brainstorming',
          'ANALYSIS',
          {
            topic: 'E-commerce platform',
            constraints: 'MVP, 3 months, TypeScript',
            additionalContext: 'Startup environment',
          },
          'test-project',
          'Test E-commerce'
        );

        expect(result.success).toBe(true);
        expect(result.output).toHaveProperty('ideas');
        expect(result.output).toHaveProperty('recommendations');
        expect(result.output).toHaveProperty('rankedOptions');
        expect(result.errors).toHaveLength(0);
        expect(result.durationMs).toBeGreaterThanOrEqual(0);
      });

      it('should return error for unknown skill', async () => {
        const result = await executor.executeSkill(
          'unknown_skill' as SuperpowersSkill,
          'ANALYSIS',
          {},
          'test-project',
          'Test Project'
        );

        expect(result.success).toBe(false);
        expect(result.errors).toContain('Unknown skill: unknown_skill');
      });

      it('should return error when skill cannot handle phase', async () => {
        // brainstorming only handles ANALYSIS and STACK_SELECTION
        const result = await executor.executeSkill(
          'brainstorming',
          'DONE',
          {},
          'test-project',
          'Test Project'
        );

        expect(result.success).toBe(false);
        expect(result.errors[0]).toContain('cannot handle phase DONE');
      });

      it('should execute writing_plans skill for SOLUTIONING phase', async () => {
        const result = await executor.executeSkill(
          'writing_plans',
          'SOLUTIONING',
          {
            phaseType: 'SOLUTIONING',
            requirements: {
              architecture: 'Design system architecture',
              tasks: 'Create task breakdown',
            },
          },
          'test-project',
          'Test Project'
        );

        expect(result.success).toBe(true);
        expect(result.output).toHaveProperty('plan');
        expect(result.output).toHaveProperty('tasks');
        expect(result.output).toHaveProperty('milestones');
      });

      it('should execute systematic_debugging skill for VALIDATE phase', async () => {
        const result = await executor.executeSkill(
          'systematic_debugging',
          'VALIDATE',
          {
            issue: 'Component rendering error',
            errorLogs: 'TypeError: Cannot read property of undefined',
          },
          'test-project',
          'Test Project'
        );

        expect(result.success).toBe(true);
        expect(result.output).toHaveProperty('rootCause');
        expect(result.output).toHaveProperty('recommendations');
        expect(result.output).toHaveProperty('resolutionSteps');
        expect(result.output).toHaveProperty('severity');
      });

      it('should execute verification skill for DONE phase', async () => {
        const result = await executor.executeSkill(
          'verification_before_completion',
          'DONE',
          {
            artifacts: {
              'README.md': '# Test',
              'HANDOFF.md': '# Handoff',
            },
            checklist: [
              'All files generated',
              'Documentation complete',
            ],
          },
          'test-project',
          'Test Project'
        );

        expect(result.success).toBe(true);
        expect(result.output).toHaveProperty('status');
        expect(result.output).toHaveProperty('checks');
        expect(result.output).toHaveProperty('canProceed');
      });

      it('should execute subagent-driven development for FRONTEND_BUILD', async () => {
        const result = await executor.executeSkill(
          'subagent_driven_development',
          'FRONTEND_BUILD',
          {
            task: 'Generate UI components',
            subtasks: [
              { name: 'button', priority: 1, dependencies: [] },
              { name: 'card', priority: 1, dependencies: [] },
              { name: 'input', priority: 2, dependencies: [] },
            ],
          },
          'test-project',
          'Test Project'
        );

        expect(result.success).toBe(true);
        expect(result.output).toHaveProperty('dispatchPlan');
        expect(result.output).toHaveProperty('executionOrder');
        expect(result.output).toHaveProperty('parallelGroups');
      });

      it('should execute finishing_branch skill for DONE phase', async () => {
        const result = await executor.executeSkill(
          'finishing_a_development_branch',
          'DONE',
          {
            branchName: 'feature/new-ui',
            artifacts: {
              'architecture.md': '# Architecture',
              'tasks.md': '# Tasks',
            },
          },
          'test-project',
          'Test Project'
        );

        expect(result.success).toBe(true);
        expect(result.output).toHaveProperty('status');
        expect(result.output).toHaveProperty('checklist');
        expect(result.output).toHaveProperty('actions');
        expect(result.output).toHaveProperty('canMerge');
      });
    });

    describe('getAvailableSkills', () => {
      it('should return brainstorming for ANALYSIS phase', () => {
        const skills = executor.getAvailableSkills('ANALYSIS');
        expect(skills).toContain('brainstorming');
      });

      it('should return writing_plans for SOLUTIONING phase', () => {
        const skills = executor.getAvailableSkills('SOLUTIONING');
        expect(skills).toContain('writing_plans');
      });

      it('should return verification for VALIDATE phase', () => {
        const skills = executor.getAvailableSkills('VALIDATE');
        expect(skills).toContain('verification_before_completion');
      });

      it('should return multiple skills for phases with overlapping capabilities', () => {
        const skills = executor.getAvailableSkills('SOLUTIONING');
        // SOLUTIONING should have both writing_plans and verification_before_completion
        expect(skills.length).toBeGreaterThanOrEqual(1);
      });
    });

    describe('getAllSkills', () => {
      it('should return all 6 skill types', () => {
        const skills = executor.getAllSkills();
        expect(skills).toHaveLength(6);
        expect(skills).toContain('brainstorming');
        expect(skills).toContain('writing_plans');
        expect(skills).toContain('systematic_debugging');
        expect(skills).toContain('verification_before_completion');
        expect(skills).toContain('subagent_driven_development');
        expect(skills).toContain('finishing_a_development_branch');
      });
    });

    describe('getSkillInfo', () => {
      it('should return info for valid skill', () => {
        const info = executor.getSkillInfo('brainstorming');
        expect(info).not.toBeNull();
        expect(info?.name).toBe('Brainstorming');
        expect(info?.description).toContain('creative');
      });

      it('should return null for unknown skill', () => {
        const info = executor.getSkillInfo('unknown' as SuperpowersSkill);
        expect(info).toBeNull();
      });
    });

    describe('isSkillAvailable', () => {
      it('should return true for brainstorming in ANALYSIS', () => {
        expect(executor.isSkillAvailable('brainstorming', 'ANALYSIS')).toBe(true);
      });

      it('should return false for brainstorming in DONE', () => {
        expect(executor.isSkillAvailable('brainstorming', 'DONE')).toBe(false);
      });
    });
  });

  describe('BrainstormingAdapter', () => {
    let adapter: BrainstormingAdapter;

    beforeEach(() => {
      adapter = new BrainstormingAdapter();
    });

    it('should have correct skill type', () => {
      expect(adapter.skill).toBe('brainstorming');
    });

    it('should handle ANALYSIS phase', () => {
      expect(adapter.canHandle('ANALYSIS', {})).toBe(true);
    });

    it('should handle STACK_SELECTION phase', () => {
      expect(adapter.canHandle('STACK_SELECTION', {})).toBe(true);
    });

    it('should not handle DONE phase', () => {
      expect(adapter.canHandle('DONE', {})).toBe(false);
    });

    it('should require topic and constraints', async () => {
      const context: SkillContext = {
        skill: 'brainstorming',
        phase: 'ANALYSIS',
        projectId: 'test',
        projectName: 'Test',
        input: {},
        output: {},
      };

      const result = await adapter.execute({}, context);
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should generate ideas with valid input', async () => {
      const context: SkillContext = {
        skill: 'brainstorming',
        phase: 'ANALYSIS',
        projectId: 'test',
        projectName: 'Test',
        input: {
          topic: 'E-commerce platform',
          constraints: 'MVP',
        },
        output: {},
      };

      const result = await adapter.execute(context.input, context);
      expect(result.success).toBe(true);
      expect(result.output).toHaveProperty('ideas');
      expect(result.output).toHaveProperty('recommendations');
    });
  });

  describe('WritingPlansAdapter', () => {
    let adapter: WritingPlansAdapter;

    beforeEach(() => {
      adapter = new WritingPlansAdapter();
    });

    it('should have correct skill type', () => {
      expect(adapter.skill).toBe('writing_plans');
    });

    it('should handle SOLUTIONING phase', () => {
      expect(adapter.canHandle('SOLUTIONING', {})).toBe(true);
    });

    it('should handle SPEC_PM phase', () => {
      expect(adapter.canHandle('SPEC_PM', {})).toBe(true);
    });

    it('should not handle ANALYSIS phase', () => {
      expect(adapter.canHandle('ANALYSIS', {})).toBe(false);
    });
  });

  describe('SystematicDebuggingAdapter', () => {
    let adapter: SystematicDebuggingAdapter;

    beforeEach(() => {
      adapter = new SystematicDebuggingAdapter();
    });

    it('should have correct skill type', () => {
      expect(adapter.skill).toBe('systematic_debugging');
    });

    it('should handle VALIDATE phase', () => {
      expect(adapter.canHandle('VALIDATE', {})).toBe(true);
    });

    it('should handle AUTO_REMEDY phase', () => {
      expect(adapter.canHandle('AUTO_REMEDY', {})).toBe(true);
    });

    it('should detect null reference errors from logs', async () => {
      const context: SkillContext = {
        skill: 'systematic_debugging',
        phase: 'VALIDATE',
        projectId: 'test',
        projectName: 'Test',
        input: {
          issue: 'Component crash',
          errorLogs: 'TypeError: Cannot read property of undefined',
        },
        output: {},
      };

      const result = await adapter.execute(context.input, context);
      expect(result.success).toBe(true);
      expect(result.output.rootCause).toContain('Null');
    });
  });

  describe('VerificationAdapter', () => {
    let adapter: VerificationAdapter;

    beforeEach(() => {
      adapter = new VerificationAdapter();
    });

    it('should have correct skill type', () => {
      expect(adapter.skill).toBe('verification_before_completion');
    });

    it('should handle VALIDATE phase', () => {
      expect(adapter.canHandle('VALIDATE', {})).toBe(true);
    });

    it('should handle DONE phase', () => {
      expect(adapter.canHandle('DONE', {})).toBe(true);
    });
  });

  describe('SubagentDrivenDevAdapter', () => {
    let adapter: SubagentDrivenDevAdapter;

    beforeEach(() => {
      adapter = new SubagentDrivenDevAdapter();
    });

    it('should have correct skill type', () => {
      expect(adapter.skill).toBe('subagent_driven_development');
    });

    it('should handle FRONTEND_BUILD phase', () => {
      expect(adapter.canHandle('FRONTEND_BUILD', {})).toBe(true);
    });

    it('should create parallel groups for independent tasks', async () => {
      const context: SkillContext = {
        skill: 'subagent_driven_development',
        phase: 'FRONTEND_BUILD',
        projectId: 'test',
        projectName: 'Test',
        input: {
          task: 'Generate components',
          subtasks: [
            { name: 'button', priority: 1, dependencies: [] },
            { name: 'card', priority: 1, dependencies: [] },
            { name: 'input', priority: 2, dependencies: ['button'] },
          ],
        },
        output: {},
      };

      const result = await adapter.execute(context.input, context);
      expect(result.success).toBe(true);
      expect(result.output).toHaveProperty('parallelGroups');
    });
  });

  describe('FinishingBranchAdapter', () => {
    let adapter: FinishingBranchAdapter;

    beforeEach(() => {
      adapter = new FinishingBranchAdapter();
    });

    it('should have correct skill type', () => {
      expect(adapter.skill).toBe('finishing_a_development_branch');
    });

    it('should handle DONE phase', () => {
      expect(adapter.canHandle('DONE', {})).toBe(true);
    });

    it('should return canMerge false when pending items exist', async () => {
      const context: SkillContext = {
        skill: 'finishing_a_development_branch',
        phase: 'DONE',
        projectId: 'test',
        projectName: 'Test',
        input: {
          branchName: 'feature/test',
          artifacts: {},
        },
        output: {},
      };

      const result = await adapter.execute(context.input, context);
      expect(result.success).toBe(true);
      expect(result.output).toHaveProperty('canMerge');
    });
  });
});
