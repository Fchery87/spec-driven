/**
 * Phase Status Calculation Utility
 * Determines the status of each phase based on current progress, approvals, and artifact validation
 */

export interface Phase {
  name: string
  description: string
  status: 'completed' | 'current' | 'pending' | 'blocked'
  artifacts?: {
    required: string[]
    generated: string[]
    complete: boolean
  }
  blockedReason?: string
  gateName?: string
}

export interface ProjectProgress {
  current_phase: string
  phases_completed: string[]
  stack_approved?: boolean
  artifacts?: Record<string, Array<{ name: string }>>
}

const PHASES = [
  'ANALYSIS',
  'STACK_SELECTION',
  'SPEC_PM',
  'SPEC_ARCHITECT',
  'SPEC_DESIGN_TOKENS',
  'SPEC_DESIGN_COMPONENTS',
  'FRONTEND_BUILD',
  'DEPENDENCIES',
  'SOLUTIONING',
  'VALIDATE',
  'AUTO_REMEDY',
  'DONE'
]

const REQUIRED_ARTIFACTS: Record<string, string[]> = {
  ANALYSIS: ['constitution.md', 'project-brief.md', 'project-classification.json', 'personas.md'],
  STACK_SELECTION: ['stack-analysis.md', 'stack-decision.md', 'stack-rationale.md', 'stack.json'],
  SPEC_PM: ['PRD.md'],
  SPEC_ARCHITECT: ['data-model.md', 'api-spec.json'],
  SPEC_DESIGN_TOKENS: ['design-tokens.md'],
  SPEC_DESIGN_COMPONENTS: ['component-mapping.md', 'journey-maps.md'],
  FRONTEND_BUILD: ['components/ui/button.tsx', 'components/ui/card.tsx', 'components/ui/input.tsx'],
  DEPENDENCIES: ['DEPENDENCIES.md', 'dependencies.json'],
  SOLUTIONING: ['architecture.md', 'epics.md', 'tasks.md', 'plan.md'],
  VALIDATE: ['validation-report.md', 'coverage-matrix.md'],
  AUTO_REMEDY: ['updated_artifacts'],
  DONE: ['README.md', 'HANDOFF.md']
}

const APPROVAL_GATES: Record<string, { field: string; displayName: string }> = {
  STACK_SELECTION: { field: 'stack_approved', displayName: 'Stack Approval' }
}

const PHASE_DESCRIPTIONS: Record<string, string> = {
  ANALYSIS: 'Analyze and clarify project requirements. AI agents will generate your project constitution, brief, classification, and user personas.',
  STACK_SELECTION: 'Select and approve the technology stack for your project.',
  SPEC_PM: 'Generate Product Requirements Document (PRD) with functional requirements and acceptance criteria.',
  SPEC_ARCHITECT: 'Generate data model and API specifications based on the PRD.',
  SPEC_DESIGN_TOKENS: 'Generate stack-agnostic design tokens (colors, typography, spacing, animation).',
  SPEC_DESIGN_COMPONENTS: 'Map design tokens to stack-specific components and generate interaction patterns.',
  FRONTEND_BUILD: 'Generate production-ready frontend components from design tokens.',
  DEPENDENCIES: 'Auto-generate project dependencies from approved stack and PRD.',
  SOLUTIONING: 'Create architecture, break down work into epics and tasks with test-first approach.',
  VALIDATE: 'Cross-artifact consistency analysis and Constitutional compliance check.',
  AUTO_REMEDY: 'Automated remediation of validation failures through targeted agent re-runs.',
  DONE: 'Generate final handoff document for LLM-based code generation.'
}

/**
 * Calculate the status of each phase in the workflow
 */
export function calculatePhaseStatuses(progress: ProjectProgress): Phase[] {
  const { current_phase, phases_completed = [], artifacts = {} } = progress

  return PHASES.map((phaseName) => {
    const isCompleted = phases_completed.includes(phaseName)
    const isCurrent = phaseName === current_phase
    const phaseIndex = PHASES.indexOf(phaseName)
    const currentPhaseIndex = PHASES.indexOf(current_phase)

    // Get artifacts for this phase
    const phaseArtifacts = artifacts[phaseName] || []
    const requiredFiles = REQUIRED_ARTIFACTS[phaseName] || []
    const generatedFiles = phaseArtifacts.map((a: { name: string }) => a.name)
    const artifactsComplete = requiredFiles.every((file) => generatedFiles.includes(file))

    // Determine if phase is blocked by an approval gate
    const gateInfo = APPROVAL_GATES[phaseName]
    let isBlocked = false
    let blockedReason = ''
    let gateName = ''

    if (gateInfo && !isCompleted) {
      const gateField = gateInfo.field as keyof ProjectProgress
      const gateApproved = Boolean((progress as unknown as Record<string, unknown>)[gateField])

      // Phase is blocked if it's the current phase and the gate hasn't been approved
      if (isCurrent && !gateApproved) {
        isBlocked = true
        blockedReason = `${gateInfo.displayName} required before advancing`
        gateName = gateInfo.displayName
      }
    }

    // Determine phase status
    let status: Phase['status'] = 'pending'

    if (isCompleted) {
      status = 'completed'
    } else if (isCurrent) {
      status = isBlocked ? 'blocked' : 'current'
    } else if (phaseIndex < currentPhaseIndex) {
      status = 'completed'
    }

    return {
      name: phaseName,
      description: PHASE_DESCRIPTIONS[phaseName],
      status,
      artifacts: {
        required: requiredFiles,
        generated: generatedFiles,
        complete: artifactsComplete
      },
      blockedReason: isBlocked ? blockedReason : undefined,
      gateName: isBlocked ? gateName : undefined
    }
  })
}

/**
 * Determine if a phase can be advanced to
 */
export function canAdvanceFromPhase(
  currentPhase: string,
  phases_completed: string[],
  stack_approved: boolean = false
): boolean {
  // Check if already at or past the last phase
  const currentIndex = PHASES.indexOf(currentPhase)
  if (currentIndex >= PHASES.length - 1) {
    return false
  }

  // Check approval gates for the current phase
  if (currentPhase === 'STACK_SELECTION' && !stack_approved) {
    return false
  }

  return true
}

/**
 * Determine if a phase's artifacts are complete
 */
export function areArtifactsComplete(phaseName: string, artifacts: Array<{ name: string }>): boolean {
  const requiredFiles = REQUIRED_ARTIFACTS[phaseName] || []
  if (requiredFiles.length === 0) {
    return true
  }

  const generatedFiles = artifacts.map((a) => a.name)
  return requiredFiles.every((file) => generatedFiles.includes(file))
}

/**
 * Get artifact completion percentage for a phase
 */
export function getArtifactCompletionPercentage(phaseName: string, artifacts: Array<{ name: string }>): number {
  const requiredFiles = REQUIRED_ARTIFACTS[phaseName] || []
  if (requiredFiles.length === 0) {
    return 100
  }

  const generatedFiles = artifacts.map((a) => a.name)
  const completed = requiredFiles.filter((file) => generatedFiles.includes(file)).length

  return Math.round((completed / requiredFiles.length) * 100)
}

/**
 * Get required files for a phase
 */
export function getRequiredArtifacts(phaseName: string): string[] {
  return REQUIRED_ARTIFACTS[phaseName] || []
}

/**
 * Get all phase names
 */
export function getAllPhases(): string[] {
  return [...PHASES]
}
