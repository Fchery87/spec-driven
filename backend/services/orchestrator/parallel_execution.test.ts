import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OrchestratorEngine } from './orchestrator_engine';
import { ParallelGroup, PhaseExecutionResult } from '@/types/orchestrator';
import { logger } from '@/lib/logger';

/**
 * Unit tests for parallel phase execution in OrchestratorEngine
 * Tests executeParallelGroup method for parallel phase execution,
 * failure handling, and snapshot creation.
 */

describe('ParallelExecution', () => {
  describe('executeParallelGroup', () => {
    it('should execute phases in parallel group', async () => {
      // Create engine instance
      const engine = new OrchestratorEngine();

      // Mock the runPhaseAgent method
      const mockArtifacts = {
        'ANALYSIS/test.md': '# Test Analysis',
        'STACK_SELECTION/stack.json': '{"stack": "test"}',
      };

      vi.spyOn(engine, 'runPhaseAgent').mockResolvedValue({
        success: true,
        artifacts: mockArtifacts,
        message: 'Phase completed',
      });

      const group: ParallelGroup = {
        name: 'test-parallel-group',
        type: 'parallel',
        phases: ['ANALYSIS', 'STACK_SELECTION'],
      };

      const results = await engine.executeParallelGroup('test-project', group, {
        'input.md': 'input content',
      });

      // Verify all phases were executed
      expect(results).toHaveLength(2);
      expect(results.every((r) => r.success)).toBe(true);

      // Verify runPhaseAgent was called for each phase
      expect(engine.runPhaseAgent).toHaveBeenCalledTimes(2);
    });

    it('should handle phase execution failures gracefully', async () => {
      const engine = new OrchestratorEngine();

      // Mock: first phase succeeds, second fails
      let callCount = 0;
      vi.spyOn(engine, 'runPhaseAgent').mockImplementation(async (project) => {
        callCount++;
        if (callCount === 1) {
          return {
            success: true,
            artifacts: { 'ANALYSIS/output.md': 'content' },
            message: 'First phase completed',
          };
        } else {
          throw new Error('Second phase failed');
        }
      });

      const group: ParallelGroup = {
        name: 'mixed-result-group',
        type: 'parallel',
        phases: ['ANALYSIS', 'STACK_SELECTION'],
      };

      const results = await engine.executeParallelGroup('test-project', group);

      // Verify results contain both success and failure
      expect(results).toHaveLength(2);
      const successfulPhases = results.filter((r) => r.success);
      const failedPhases = results.filter((r) => !r.success);

      expect(successfulPhases).toHaveLength(1);
      expect(failedPhases).toHaveLength(1);

      // Verify failed phase has error message
      const failedResult = failedPhases[0];
      expect(failedResult.error).toBe('Second phase failed');
    });

    it('should return correct PhaseExecutionResult structure', async () => {
      const engine = new OrchestratorEngine();

      vi.spyOn(engine, 'runPhaseAgent').mockResolvedValue({
        success: true,
        artifacts: { 'test.md': 'content' },
        message: 'Completed',
      });

      const group: ParallelGroup = {
        name: 'result-structure-test',
        type: 'parallel',
        phases: ['ANALYSIS'],
      };

      const results = await engine.executeParallelGroup('test-project', group);

      expect(results).toHaveLength(1);
      const result = results[0];

      // Verify all required fields are present
      expect(result).toHaveProperty('phase');
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('artifacts');
      expect(result).toHaveProperty('durationMs');
      expect(result.phase).toBe('ANALYSIS');
      expect(result.success).toBe(true);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should throw error for invalid phases in group', async () => {
      const engine = new OrchestratorEngine();

      const group: ParallelGroup = {
        name: 'invalid-phases-group',
        type: 'parallel',
        phases: ['ANALYSIS', 'INVALID_PHASE'],
      };

      await expect(
        engine.executeParallelGroup('test-project', group)
      ).rejects.toThrow('Invalid phases in parallel group');
    });

    it('should track duration for each phase', async () => {
      const engine = new OrchestratorEngine();

      vi.spyOn(engine, 'runPhaseAgent').mockResolvedValue({
        success: true,
        artifacts: {},
        message: 'Completed',
      });

      const group: ParallelGroup = {
        name: 'duration-test',
        type: 'parallel',
        phases: ['ANALYSIS', 'STACK_SELECTION', 'SPEC_PM'],
      };

      const results = await engine.executeParallelGroup('test-project', group);

      // Verify all phases have duration tracked
      for (const result of results) {
        expect(result.durationMs).toBeGreaterThanOrEqual(0);
      }
    });

    it('should collect artifacts from all successful phases', async () => {
      const engine = new OrchestratorEngine();

      const mockArtifacts1 = { 'ANALYSIS/output1.md': 'content1' };
      const mockArtifacts2 = { 'SPEC_PM/output2.md': 'content2' };

      vi.spyOn(engine, 'runPhaseAgent').mockImplementation(async (project) => {
        if (project.current_phase === 'ANALYSIS') {
          return {
            success: true,
            artifacts: mockArtifacts1,
            message: 'ANALYSIS completed',
          };
        } else if (project.current_phase === 'SPEC_PM') {
          return {
            success: true,
            artifacts: mockArtifacts2,
            message: 'SPEC_PM completed',
          };
        }
        return { success: true, artifacts: {}, message: 'Done' };
      });

      const group: ParallelGroup = {
        name: 'artifact-collection-test',
        type: 'parallel',
        phases: ['ANALYSIS', 'SPEC_PM'],
      };

      const results = await engine.executeParallelGroup('test-project', group);

      // Verify all artifacts are collected
      const analysisResult = results.find((r) => r.phase === 'ANALYSIS');
      const specResult = results.find((r) => r.phase === 'SPEC_PM');

      expect(analysisResult?.artifacts).toEqual(mockArtifacts1);
      expect(specResult?.artifacts).toEqual(mockArtifacts2);
    });
  });

  describe('ParallelGroup Type Validation', () => {
    it('should create valid ParallelGroup config', () => {
      const group: ParallelGroup = {
        name: 'test-group',
        type: 'parallel',
        phases: ['PHASE_A', 'PHASE_B', 'PHASE_C'],
      };

      expect(group.name).toBe('test-group');
      expect(group.type).toBe('parallel');
      expect(group.phases).toHaveLength(3);
    });

    it('should create valid PhaseExecutionResult', () => {
      const result: PhaseExecutionResult = {
        phase: 'ANALYSIS',
        success: true,
        artifacts: { 'test.md': 'content' },
        durationMs: 1000,
      };

      expect(result.phase).toBe('ANALYSIS');
      expect(result.success).toBe(true);
      expect(result.artifacts).toHaveProperty('test.md');
      expect(result.durationMs).toBe(1000);
    });

    it('should handle failed phase with error', () => {
      const result: PhaseExecutionResult = {
        phase: 'STACK_SELECTION',
        success: false,
        artifacts: {},
        error: 'Validation failed',
        durationMs: 500,
      };

      expect(result.success).toBe(false);
      expect(result.error).toBe('Validation failed');
      expect(result.artifacts).toEqual({});
    });
  });

  describe('Snapshot Creation', () => {
    it('should attempt snapshot creation after group completion', async () => {
      const engine = new OrchestratorEngine();

      vi.spyOn(engine, 'runPhaseAgent').mockResolvedValue({
        success: true,
        artifacts: { 'output.md': 'content' },
        message: 'Completed',
      });

      const group: ParallelGroup = {
        name: 'snapshot-test',
        type: 'parallel',
        phases: ['ANALYSIS'],
      };

      const results = await engine.executeParallelGroup('test-project', group);

      // Verify results are returned even without snapshot services
      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
    });
  });
});
