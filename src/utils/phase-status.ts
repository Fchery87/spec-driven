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
  dependencies_approved?: boolean
  artifacts?: Record<string, Array<{ name: string }>>
}

const PHASES = ['ANALYSIS', 'STACK_SELECTION', 'SPEC', 'DEPENDENCIES', 'SOLUTIONING', 'DONE']

const REQUIRED_ARTIFACTS: Record<string, string[]> = {
  ANALYSIS: ['constitution.md', 'project-brief.md', 'personas.md'],
  STACK_SELECTION: ['plan.md', 'README.md'],
  SPEC: ['PRD.md', 'data-model.md', 'api-spec.json'],
  DEPENDENCIES: ['DEPENDENCIES.md', 'dependency-proposal.md'],
  SOLUTIONING: ['architecture.md', 'epics.md', 'tasks.md'],
  DONE: ['HANDOFF.md']
}

const APPROVAL_GATES: Record<string, { field: string; displayName: string }> = {
  STACK_SELECTION: { field: 'stack_approved', displayName: 'Stack Approval' },
  DEPENDENCIES: { field: 'dependencies_approved', displayName: 'Dependencies Approval' }
}

const PHASE_DESCRIPTIONS: Record<string, string> = {
  ANALYSIS: 'Analyze and clarify project requirements. AI agents will generate your project constitution, brief, and user personas.',
  STACK_SELECTION: 'Select and approve the technology stack for your project. Choose between predefined stacks optimized for different scenarios.',
  SPEC: 'Generate detailed product and technical specifications including PRD, data model, and API specifications.',
  DEPENDENCIES: 'Define and approve all project dependencies including npm packages, Python libraries, and system requirements.',
  SOLUTIONING: 'Create architecture diagrams, break down work into epics and tasks, and plan implementation sequence.',
  DONE: 'Generate final handoff document with HANDOFF.md prompt for LLM-based code generation.'
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
      const gateApproved = (progress as Record<string, unknown>)[gateField] === true

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
  stack_approved: boolean = false,
  dependencies_approved: boolean = false
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

  if (currentPhase === 'DEPENDENCIES' && !dependencies_approved) {
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
