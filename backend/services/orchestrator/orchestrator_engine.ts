import {
  Project,
  Phase,
  OrchestratorSpec,
  ValidationResult,
  OrchestrationState,
  PhaseHistory
} from '@/types/orchestrator';
import { ConfigLoader } from './config_loader';
import { Validators } from './validators';
import { ArtifactManager } from './artifact_manager';
import {
  getAnalystExecutor,
  getPMExecutor,
  getArchitectExecutor,
  getScruMasterExecutor,
  getDevOpsExecutor
} from '../llm/agent_executors';
import { GeminiClient } from '../llm/llm_client';

export class OrchestratorEngine {
  private spec: OrchestratorSpec;
  private validators: Validators;
  private artifactManager: ArtifactManager;
  private llmClient: GeminiClient;

  constructor() {
    this.spec = new ConfigLoader().loadSpec();
    this.validators = new Validators(this.spec.validators);
    this.artifactManager = new ArtifactManager();

    // Initialize Gemini client with LLM config from orchestrator spec
    const llmConfig = {
      provider: this.spec.llm_config.provider,
      model: this.spec.llm_config.model,
      max_tokens: this.spec.llm_config.max_tokens,
      temperature: this.spec.llm_config.temperature,
      timeout_seconds: this.spec.llm_config.timeout_seconds,
      api_key: process.env.GEMINI_API_KEY
    };
    this.llmClient = new GeminiClient(llmConfig);
  }

  /**
   * Validate if a phase is complete and can advance
   */
  async validatePhaseCompletion(project: Project): Promise<ValidationResult> {
    const currentPhase = this.spec.phases[project.current_phase];
    if (!currentPhase) {
      return {
        status: 'fail',
        checks: {},
        errors: [`Unknown phase: ${project.current_phase}`]
      };
    }

    // Check if all required artifacts exist
    const artifactResults = await this.artifactManager.validateArtifacts(
      project.id,
      currentPhase.outputs
    );

    // Run phase-specific validators
    const validatorResults = await this.validators.runValidators(
      currentPhase.validators,
      project
    );

    // Combine results
    const allChecks = { ...artifactResults.checks, ...validatorResults.checks };
    const allErrors = [...(artifactResults.errors || []), ...(validatorResults.errors || [])];
    const allWarnings = [...(artifactResults.warnings || []), ...(validatorResults.warnings || [])];

    const hasErrors = allErrors.length > 0;
    const hasWarnings = allWarnings.length > 0;

    return {
      status: hasErrors ? 'fail' : hasWarnings ? 'warn' : 'pass',
      checks: allChecks,
      errors: hasErrors ? allErrors : undefined,
      warnings: hasWarnings ? allWarnings : undefined
    };
  }

  /**
   * Check if project can advance to next phase
   */
  canAdvanceToPhase(project: Project, targetPhase?: string): boolean {
    const currentPhase = this.spec.phases[project.current_phase];
    if (!currentPhase) return false;

    // Check if all gates are passed
    if (currentPhase.gates) {
      for (const gate of currentPhase.gates) {
        if (!this.isGatePassed(project, gate)) {
          return false;
        }
      }
    }

    // Check dependencies
    if (currentPhase.depends_on) {
      for (const dependency of currentPhase.depends_on) {
        if (!project.phases_completed.includes(dependency)) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Advance project to next phase
   */
  async advancePhase(project: Project, userId: string): Promise<{
    success: boolean;
    newPhase?: string;
    message: string;
  }> {
    // Validate current phase completion
    const validation = await this.validatePhaseCompletion(project);
    if (validation.status === 'fail') {
      return {
        success: false,
        message: `Cannot advance phase: ${validation.errors?.join(', ')}`
      };
    }

    // Check if can advance
    if (!this.canAdvanceToPhase(project)) {
      return {
        success: false,
        message: 'Cannot advance phase: gates not passed or dependencies not met'
      };
    }

    const currentPhase = this.spec.phases[project.current_phase];
    const nextPhaseName = currentPhase.next_phase;

    // Update project state
    project.phases_completed.push(project.current_phase);
    project.current_phase = nextPhaseName;
    project.updated_at = new Date();

    // Record phase transition
    await this.recordPhaseTransition(project, project.current_phase, nextPhaseName, userId);

    return {
      success: true,
      newPhase: nextPhaseName,
      message: `Advanced to ${nextPhaseName} phase`
    };
  }

  /**
   * Run agent for current phase
   */
  async runPhaseAgent(project: Project, artifacts: Record<string, string> = {}): Promise<{
    success: boolean;
    artifacts: Record<string, string>;
    message: string;
  }> {
    const currentPhase = this.spec.phases[project.current_phase];
    if (!currentPhase) {
      throw new Error(`Unknown phase: ${project.current_phase}`);
    }

    try {
      console.log(`Executing agent for phase: ${project.current_phase}`);

      let generatedArtifacts: Record<string, string> = {};

      // Get executor for current phase and run agent
      switch (project.current_phase) {
        case 'ANALYSIS':
          generatedArtifacts = await getAnalystExecutor(
            this.llmClient,
            project.id,
            artifacts
          );
          break;

        case 'SPEC':
          generatedArtifacts = await getPMExecutor(
            this.llmClient,
            project.id,
            artifacts,
            project.orchestration_state.stack_choice
          );
          break;

        case 'SOLUTIONING':
          generatedArtifacts = await Promise.all([
            getArchitectExecutor(this.llmClient, project.id, artifacts),
            getScruMasterExecutor(this.llmClient, project.id, artifacts)
          ]).then(([arch, scrum]) => ({
            ...arch,
            ...scrum
          }));
          break;

        case 'DEPENDENCIES':
          generatedArtifacts = await getDevOpsExecutor(
            this.llmClient,
            project.id,
            artifacts,
            project.orchestration_state.stack_choice
          );
          break;

        case 'STACK_SELECTION':
          // Stack selection is user-driven, not agent-driven
          return {
            success: true,
            artifacts: {},
            message: 'Stack selection phase requires user input'
          };

        case 'DONE':
          // Handoff generation happens via separate endpoint
          return {
            success: true,
            artifacts: {},
            message: 'Final phase - use /generate-handoff endpoint'
          };

        default:
          throw new Error(`No executor for phase: ${project.current_phase}`);
      }

      // Save artifacts to storage
      for (const [filename, content] of Object.entries(generatedArtifacts)) {
        await this.artifactManager.saveArtifact(
          project.id,
          project.current_phase,
          filename,
          content
        );
      }

      // Update artifact versions
      if (!project.orchestration_state.artifact_versions[project.current_phase]) {
        project.orchestration_state.artifact_versions[project.current_phase] = 1;
      } else {
        project.orchestration_state.artifact_versions[project.current_phase]++;
      }

      return {
        success: true,
        artifacts: generatedArtifacts,
        message: `Agent for phase ${project.current_phase} completed successfully`
      };
    } catch (error) {
      console.error('Error running phase agent:', error);
      throw new Error(
        `Failed to execute agent for phase ${project.current_phase}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Validate artifacts for a phase
   */
  async validateArtifacts(project: Project, phase?: string): Promise<ValidationResult> {
    const targetPhase = phase || project.current_phase;
    const phaseSpec = this.spec.phases[targetPhase];
    
    if (!phaseSpec) {
      return {
        status: 'fail',
        checks: {},
        errors: [`Unknown phase: ${targetPhase}`]
      };
    }

    return await this.artifactManager.validateArtifacts(
      project.id,
      phaseSpec.outputs
    );
  }

  /**
   * Get artifacts for a phase
   */
  async getPhaseArtifacts(project: Project, phase?: string): Promise<string[]> {
    const targetPhase = phase || project.current_phase;
    const phaseSpec = this.spec.phases[targetPhase];
    
    if (!phaseSpec) {
      return [];
    }

    return await this.artifactManager.listArtifacts(project.id, targetPhase);
  }

  /**
   * Get artifact content
   */
  async getArtifactContent(project: Project, artifactName: string): Promise<string> {
    return await this.artifactManager.getArtifactContent(project.id, artifactName);
  }

  /**
   * Rollback to previous phase
   */
  async rollbackPhase(project: Project, targetPhase: string, userId: string): Promise<boolean> {
    const targetPhaseSpec = this.spec.phases[targetPhase];
    if (!targetPhaseSpec) {
      return false;
    }

    // Check if target phase is in completed phases
    if (!project.phases_completed.includes(targetPhase)) {
      return false;
    }

    // Update project state
    const previousPhase = project.current_phase;
    project.current_phase = targetPhase;
    project.updated_at = new Date();

    // Remove phases after target from completed list
    const targetIndex = project.phases_completed.indexOf(targetPhase);
    project.phases_completed = project.phases_completed.slice(0, targetIndex + 1);

    // Record rollback
    await this.recordPhaseTransition(project, previousPhase, targetPhase, userId, 'rollback');

    return true;
  }

  /**
   * Check if a gate is passed
   */
  private isGatePassed(project: Project, gate: string): boolean {
    switch (gate) {
      case 'stack_approved':
        return project.stack_approved;
      case 'dependencies_approved':
        return project.dependencies_approved;
      default:
        return project.orchestration_state.approval_gates[gate] || false;
    }
  }

  /**
   * Record phase transition in history
   */
  private async recordPhaseTransition(
    project: Project,
    fromPhase: string,
    toPhase: string,
    userId: string,
    type: 'advance' | 'rollback' = 'advance'
  ): Promise<void> {
    // This would save to database
    // For now, just log
    console.log(`Phase transition: ${fromPhase} -> ${toPhase} by ${userId} (${type})`);
  }

  /**
   * Get current phase spec
   */
  getCurrentPhaseSpec(phaseName: string): Phase | null {
    return this.spec.phases[phaseName] || null;
  }

  /**
   * Get all phases in order
   */
  getAllPhases(): Phase[] {
    return Object.values(this.spec.phases);
  }

  /**
   * Get phase sequence from current to end
   */
  getPhaseSequence(currentPhase: string): Phase[] {
    const phases: Phase[] = [];
    let current = currentPhase;
    
    while (current) {
      const phase = this.spec.phases[current];
      if (!phase) break;
      
      phases.push(phase);
      current = phase.next_phase;
    }
    
    return phases;
  }
}