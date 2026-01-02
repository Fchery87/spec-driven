import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OrchestratorEngine } from './orchestrator_engine';
import { ParallelWorkflowOptions, ParallelWorkflowResult } from '@/types/orchestrator';
import { logger } from '@/lib/logger';

/**
 * Unit tests for executeWorkflowWithParallel method in OrchestratorEngine
 * Tests workflow execution with parallel phase execution, timing metrics,
 * fallback to sequential, and dependency handling.
 */

describe('ParallelWorkflow', () => {
  describe('executeWorkflowWithParallel', () => {
    it('should execute workflow with parallel enabled', async () => {
      const engine = new OrchestratorEngine();

      // Mock runPhaseAgent for all phases
      vi.spyOn(engine, 'runPhaseAgent').mockResolvedValue({
        success: true,
        artifacts: {},
        message: 'Phase completed',
      });

      const options: ParallelWorkflowOptions = {
        enableParallel: true,
        fallbackToSequential: false,
      };

      const result = await engine.executeWorkflowWithParallel('test-project', options);

      // Verify result structure
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('projectId', 'test-project');
      expect(result).toHaveProperty('phasesExecuted');
      expect(result).toHaveProperty('groupsExecuted');
      expect(result).toHaveProperty('totalDurationMs');
      expect(result).toHaveProperty('parallelDurationMs');
      expect(result).toHaveProperty('sequentialDurationMs');
      expect(result).toHaveProperty('timeSavedMs');
      expect(result).toHaveProperty('timeSavedPercent');
      expect(result).toHaveProperty('errors');
      expect(result).toHaveProperty('fallbackUsed');

      // Verify phases were executed
      expect(result.phasesExecuted.length).toBeGreaterThan(0);

      // Verify groups were executed
      expect(result.groupsExecuted.length).toBeGreaterThan(0);
    });

    it('should execute workflow with parallel disabled (sequential)', async () => {
      const engine = new OrchestratorEngine();

      // Mock runPhaseAgent for all phases
      vi.spyOn(engine, 'runPhaseAgent').mockResolvedValue({
        success: true,
        artifacts: {},
        message: 'Phase completed',
      });

      const options: ParallelWorkflowOptions = {
        enableParallel: false,
        fallbackToSequential: false,
      };

      const result = await engine.executeWorkflowWithParallel('test-project', options);

      // Verify all groups are marked as sequential when parallel is disabled
      for (const group of result.groupsExecuted) {
        expect(group.type).toBe('sequential');
      }

      // Verify no fallback was used
      expect(result.fallbackUsed).toBe(false);
    });

    it('should execute parallel groups when enabled and phases > 1', async () => {
      const engine = new OrchestratorEngine();

      // Mock runPhaseAgent for all phases
      vi.spyOn(engine, 'runPhaseAgent').mockResolvedValue({
        success: true,
        artifacts: {},
        message: 'Phase completed',
      });

      const options: ParallelWorkflowOptions = {
        enableParallel: true,
        fallbackToSequential: false,
      };

      const result = await engine.executeWorkflowWithParallel('test-project', options);

      // Find groups with multiple phases (should be parallel when enabled)
      const multiPhaseGroups = result.groupsExecuted.filter(
        (g) => g.phases.length > 1
      );

      // Multi-phase groups should be parallel
      for (const group of multiPhaseGroups) {
        if (group.phases.length > 1) {
          expect(group.type).toBe('parallel');
        }
      }
    });

    it('should measure and report time savings', async () => {
      const engine = new OrchestratorEngine();

      // Mock runPhaseAgent for all phases
      vi.spyOn(engine, 'runPhaseAgent').mockResolvedValue({
        success: true,
        artifacts: {},
        message: 'Phase completed',
      });

      const options: ParallelWorkflowOptions = {
        enableParallel: true,
        fallbackToSequential: false,
      };

      const result = await engine.executeWorkflowWithParallel('test-project', options);

      // Verify timing metrics are populated
      expect(result.parallelDurationMs).toBeGreaterThanOrEqual(0);
      expect(result.sequentialDurationMs).toBeGreaterThan(0);

      // Time saved should be calculated correctly
      expect(result.timeSavedMs).toBe(Math.max(0, result.sequentialDurationMs - result.parallelDurationMs));

      // Time saved percent should be in valid range
      expect(result.timeSavedPercent).toBeGreaterThanOrEqual(0);
      expect(result.timeSavedPercent).toBeLessThanOrEqual(100);
    });

    it('should return errors for failed phases', async () => {
      const engine = new OrchestratorEngine();

      // Mock: first phase succeeds, rest fail
      let callCount = 0;
      vi.spyOn(engine, 'runPhaseAgent').mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return {
            success: true,
            artifacts: {},
            message: 'First phase completed',
          };
        }
        throw new Error('Phase execution failed');
      });

      const options: ParallelWorkflowOptions = {
        enableParallel: true,
        fallbackToSequential: false,
      };

      const result = await engine.executeWorkflowWithParallel('test-project', options);

      // Verify errors are captured
      expect(result.errors.length).toBeGreaterThan(0);

      // Verify error structure
      for (const error of result.errors) {
        expect(error).toHaveProperty('phase');
        expect(error).toHaveProperty('error');
      }

      // Verify overall success is false when there are errors
      expect(result.success).toBe(false);
    });

    it('should fallback to sequential on parallel failure when enabled', async () => {
      const engine = new OrchestratorEngine();

      let parallelCallCount = 0;
      let sequentialCallCount = 0;

      // Mock to make executeParallelGroup throw on first call
      const originalExecuteParallelGroup = (engine as any).executeParallelGroup.bind(engine);
      (engine as any).executeParallelGroup = vi.fn().mockImplementation(async (projectId: string, group: any) => {
        // Fail only on the first parallel group call
        if (parallelCallCount === 0) {
          parallelCallCount++;
          throw new Error('Parallel execution failed');
        }
        // Return mock results for subsequent calls
        return group.phases.map((phase: string) => ({
          phase,
          success: true,
          artifacts: {},
          durationMs: 100,
        }));
      });

      // Mock runPhaseAgent for sequential fallback
      vi.spyOn(engine, 'runPhaseAgent').mockImplementation(async () => {
        sequentialCallCount++;
        return {
          success: true,
          artifacts: {},
          message: 'Phase completed',
        };
      });

      const options: ParallelWorkflowOptions = {
        enableParallel: true,
        fallbackToSequential: true,
      };

      const result = await engine.executeWorkflowWithParallel('test-project', options);

      // Verify fallback was used
      expect(result.fallbackUsed).toBe(true);

      // Verify parallel execution was attempted
      expect(parallelCallCount).toBeGreaterThan(0);

      // Restore original method
      (engine as any).executeParallelGroup = originalExecuteParallelGroup;
    });

    it('should not fallback when fallbackToSequential is false', async () => {
      const engine = new OrchestratorEngine();

      // Mock to always fail
      vi.spyOn(engine, 'runPhaseAgent').mockRejectedValue(new Error('Always fails'));

      const options: ParallelWorkflowOptions = {
        enableParallel: true,
        fallbackToSequential: false,
      };

      const result = await engine.executeWorkflowWithParallel('test-project', options);

      // Verify fallback was not used
      expect(result.fallbackUsed).toBe(false);

      // Verify errors are captured
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should respect phase dependencies in execution order', async () => {
      const engine = new OrchestratorEngine();

      const executionOrder: string[] = [];

      // Mock to track execution order
      vi.spyOn(engine, 'runPhaseAgent').mockImplementation(async (project) => {
        executionOrder.push(project.current_phase);
        return {
          success: true,
          artifacts: {},
          message: 'Phase completed',
        };
      });

      const options: ParallelWorkflowOptions = {
        enableParallel: true,
        fallbackToSequential: false,
      };

      const result = await engine.executeWorkflowWithParallel('test-project', options);

      // Verify ANALYSIS always comes first (foundation group)
      expect(executionOrder[0]).toBe('ANALYSIS');

      // Verify dependencies are respected
      // STACK_SELECTION and SPEC_DESIGN_TOKENS depend on ANALYSIS
      const analysisIndex = executionOrder.indexOf('ANALYSIS');
      const stackIndex = executionOrder.indexOf('STACK_SELECTION');
      const tokensIndex = executionOrder.indexOf('SPEC_DESIGN_TOKENS');

      expect(stackIndex).toBeGreaterThan(analysisIndex);
      expect(tokensIndex).toBeGreaterThan(analysisIndex);
    });

    it('should return correct ParallelWorkflowResult structure', async () => {
      const engine = new OrchestratorEngine();

      vi.spyOn(engine, 'runPhaseAgent').mockResolvedValue({
        success: true,
        artifacts: {},
        message: 'Phase completed',
      });

      const options: ParallelWorkflowOptions = {
        enableParallel: true,
        fallbackToSequential: false,
      };

      const result = await engine.executeWorkflowWithParallel('test-project', options);

      // Verify all required fields
      expect(result.success).toBe(true);
      expect(result.projectId).toBe('test-project');
      expect(Array.isArray(result.phasesExecuted)).toBe(true);
      expect(Array.isArray(result.groupsExecuted)).toBe(true);
      expect(typeof result.totalDurationMs).toBe('number');
      expect(typeof result.parallelDurationMs).toBe('number');
      expect(typeof result.sequentialDurationMs).toBe('number');
      expect(typeof result.timeSavedMs).toBe('number');
      expect(typeof result.timeSavedPercent).toBe('number');
      expect(Array.isArray(result.errors)).toBe(true);
      expect(typeof result.fallbackUsed).toBe('boolean');

      // Verify group structure
      for (const group of result.groupsExecuted) {
        expect(group).toHaveProperty('name');
        expect(group).toHaveProperty('type');
        expect(group).toHaveProperty('phases');
        expect(group).toHaveProperty('success');
        expect(group).toHaveProperty('durationMs');
        expect(group).toHaveProperty('results');
        expect(['parallel', 'sequential']).toContain(group.type);
      }
    });

    it('should track phases completed correctly', async () => {
      const engine = new OrchestratorEngine();

      vi.spyOn(engine, 'runPhaseAgent').mockResolvedValue({
        success: true,
        artifacts: {},
        message: 'Phase completed',
      });

      const options: ParallelWorkflowOptions = {
        enableParallel: true,
        fallbackToSequential: false,
      };

      const result = await engine.executeWorkflowWithParallel('test-project', options);

      // Verify no duplicate phases in completed list
      const uniquePhases = new Set(result.phasesExecuted);
      expect(result.phasesExecuted.length).toBe(uniquePhases.size);

      // Verify all expected phases are present
      const expectedPhases = ['ANALYSIS', 'STACK_SELECTION', 'SPEC_DESIGN_TOKENS', 'SPEC', 'SPEC_DESIGN_COMPONENTS', 'DEPENDENCIES', 'SOLUTIONING'];
      for (const phase of expectedPhases) {
        expect(result.phasesExecuted).toContain(phase);
      }
    });
  });

  describe('ParallelWorkflowOptions', () => {
    it('should accept valid options', () => {
      const options: ParallelWorkflowOptions = {
        enableParallel: true,
        fallbackToSequential: true,
      };

      expect(options.enableParallel).toBe(true);
      expect(options.fallbackToSequential).toBe(true);
    });

    it('should accept options with parallel disabled', () => {
      const options: ParallelWorkflowOptions = {
        enableParallel: false,
        fallbackToSequential: false,
      };

      expect(options.enableParallel).toBe(false);
      expect(options.fallbackToSequential).toBe(false);
    });
  });

  describe('ParallelWorkflowResult', () => {
    it('should have correct type structure', () => {
      const result: ParallelWorkflowResult = {
        success: true,
        projectId: 'test-project',
        phasesExecuted: ['ANALYSIS', 'STACK_SELECTION'],
        groupsExecuted: [
          {
            name: 'foundation',
            type: 'parallel',
            phases: ['ANALYSIS'],
            success: true,
            durationMs: 1000,
            results: [
              {
                phase: 'ANALYSIS',
                success: true,
                artifacts: {},
                durationMs: 1000,
              },
            ],
          },
        ],
        totalDurationMs: 2000,
        parallelDurationMs: 1500,
        sequentialDurationMs: 3000,
        timeSavedMs: 1500,
        timeSavedPercent: 50,
        errors: [],
        fallbackUsed: false,
      };

      expect(result.success).toBe(true);
      expect(result.groupsExecuted[0].type).toBe('parallel');
      expect(result.timeSavedPercent).toBe(50);
      expect(result.errors).toEqual([]);
    });

    it('should handle errors in result structure', () => {
      const result: ParallelWorkflowResult = {
        success: false,
        projectId: 'test-project',
        phasesExecuted: ['ANALYSIS'],
        groupsExecuted: [
          {
            name: 'foundation',
            type: 'sequential',
            phases: ['ANALYSIS'],
            success: false,
            durationMs: 1000,
            results: [
              {
                phase: 'ANALYSIS',
                success: false,
                artifacts: {},
                error: 'Test error',
                durationMs: 1000,
              },
            ],
          },
        ],
        totalDurationMs: 1000,
        parallelDurationMs: 1000,
        sequentialDurationMs: 2000,
        timeSavedMs: 1000,
        timeSavedPercent: 50,
        errors: [{ phase: 'ANALYSIS', error: 'Test error' }],
        fallbackUsed: false,
      };

      expect(result.success).toBe(false);
      expect(result.errors.length).toBe(1);
      expect(result.errors[0].phase).toBe('ANALYSIS');
      expect(result.errors[0].error).toBe('Test error');
    });
  });
});
