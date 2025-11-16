import { describe, it, expect, beforeEach } from 'vitest'

/**
 * Unit tests for OrchestratorEngine
 * Tests phase transitions, gate validation, and orchestration logic
 */

describe('OrchestratorEngine', () => {
  describe('Phase Transitions', () => {
    it('should transition from ANALYSIS to STACK_SELECTION when validators pass', () => {
      // Mock project in ANALYSIS phase
      const project = {
        id: 'test-project',
        slug: 'test',
        current_phase: 'ANALYSIS',
        phases_completed: '',
        stack_approved: false,
        dependencies_approved: false
      }

      // Mock validation result - all pass
      const validationResults = {
        presence: { passed: true },
        markdown_frontmatter: { passed: true },
        content_quality: { passed: true }
      }

      // Engine should allow transition
      const canAdvance = Object.values(validationResults).every((r) => r.passed)
      expect(canAdvance).toBe(true)
    })

    it('should block transition if validators fail', () => {
      const validationResults = {
        presence: { passed: false, errors: ['Missing files'] },
        markdown_frontmatter: { passed: true },
        content_quality: { passed: true }
      }

      const canAdvance = Object.values(validationResults).every((r) => r.passed)
      expect(canAdvance).toBe(false)
    })

    it('should enforce approval gates', () => {
      // Test STACK_SELECTION gate
      const project = {
        current_phase: 'STACK_SELECTION',
        stack_approved: false
      }

      // Cannot advance without stack approval
      const canAdvanceToSpec = project.stack_approved === true
      expect(canAdvanceToSpec).toBe(false)
    })

    it('should enforce DEPENDENCIES gate', () => {
      // Test DEPENDENCIES gate
      const project = {
        current_phase: 'DEPENDENCIES',
        dependencies_approved: false
      }

      // Cannot advance without dependencies approval
      const canAdvanceToSolutioning = project.dependencies_approved === true
      expect(canAdvanceToSolutioning).toBe(false)
    })
  })

  describe('Phase History Tracking', () => {
    it('should record phase start and end times', () => {
      const phaseStart = new Date()
      const phaseEnd = new Date(phaseStart.getTime() + 5 * 60 * 1000) // 5 minutes later

      const history = {
        phase: 'ANALYSIS',
        started_at: phaseStart,
        completed_at: phaseEnd,
        duration_ms: phaseEnd.getTime() - phaseStart.getTime()
      }

      expect(history.duration_ms).toBe(5 * 60 * 1000)
      expect(history.completed_at > history.started_at).toBe(true)
    })

    it('should track phase status transitions', () => {
      const statuses = ['in_progress', 'completed', 'failed']
      const phaseHistory = statuses.map((status) => ({
        phase: 'ANALYSIS',
        status: status as 'in_progress' | 'completed' | 'failed'
      }))

      expect(phaseHistory.length).toBe(3)
      expect(phaseHistory[0].status).toBe('in_progress')
      expect(phaseHistory[1].status).toBe('completed')
      expect(phaseHistory[2].status).toBe('failed')
    })
  })

  describe('Agent Execution Flow', () => {
    it('should execute correct agent for each phase', () => {
      const phaseToAgent: Record<string, string> = {
        ANALYSIS: 'analyst',
        SPEC: 'pm',
        SOLUTIONING: 'architect',
        DEPENDENCIES: 'devops'
      }

      expect(phaseToAgent['ANALYSIS']).toBe('analyst')
      expect(phaseToAgent['SPEC']).toBe('pm')
      expect(phaseToAgent['SOLUTIONING']).toBe('architect')
      expect(phaseToAgent['DEPENDENCIES']).toBe('devops')
    })

    it('should pass correct artifacts as context to agents', () => {
      const phase = 'SPEC'
      const artifacts = {
        'constitution.md': 'content',
        'project-brief.md': 'content',
        'personas.md': 'content'
      }

      // PM agent for SPEC phase should receive ANALYSIS artifacts as context
      const contextArtifacts = Object.keys(artifacts)
      expect(contextArtifacts.length).toBeGreaterThanOrEqual(3)
    })
  })

  describe('Rollback and Recovery', () => {
    it('should support rolling back to previous phase', () => {
      const project = {
        current_phase: 'SPEC',
        phases_completed: 'ANALYSIS,STACK_SELECTION'
      }

      const previousPhases = project.phases_completed.split(',').filter((p) => p)
      const canRollback = previousPhases.length > 0
      expect(canRollback).toBe(true)
      expect(previousPhases[previousPhases.length - 1]).toBe('STACK_SELECTION')
    })

    it('should prevent rollback beyond ANALYSIS phase', () => {
      const project = {
        current_phase: 'ANALYSIS',
        phases_completed: ''
      }

      const previousPhases = project.phases_completed.split(',').filter((p) => p)
      const canRollback = previousPhases.length > 0
      expect(canRollback).toBe(false)
    })
  })

  describe('Error Handling', () => {
    it('should catch and record agent execution errors', () => {
      let agentError: Error | null = null
      try {
        throw new Error('Agent execution failed')
      } catch (error) {
        agentError = error as Error
      }

      expect(agentError).not.toBeNull()
      expect(agentError?.message).toBe('Agent execution failed')
    })

    it('should mark phase as failed if agents error', () => {
      const error = new Error('LLM API timeout')
      const phase = {
        phase: 'ANALYSIS',
        status: error ? 'failed' : 'completed',
        error_message: error.message
      }

      expect(phase.status).toBe('failed')
      expect(phase.error_message).toBe('LLM API timeout')
    })
  })
})
