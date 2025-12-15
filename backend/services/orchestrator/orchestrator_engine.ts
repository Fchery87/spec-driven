import { logger } from '@/lib/logger';
import {
  Project,
  Phase,
  OrchestratorSpec,
  ValidationResult,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  OrchestrationState,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  PhaseHistory
} from '@/types/orchestrator';
import { ConfigLoader } from './config_loader';
import { Validators } from './validators';
import { ArtifactManager } from './artifact_manager';
import { existsSync } from 'fs';
import { resolve } from 'path';
import {
  getAnalystExecutor,
  getPMExecutor,
  getArchitectExecutor,
  getScruMasterExecutor,
  getDevOpsExecutor,
  getDesignExecutor,
  getStackSelectionExecutor
} from '../llm/agent_executors';
import { GeminiClient } from '../llm/llm_client';
import { createLLMClient, ProviderType, getProviderApiKeyAsync } from '../llm/providers';

export class OrchestratorEngine {
  private spec: OrchestratorSpec;
  private validators: Validators;
  private artifactManager: ArtifactManager;
  private llmClient: GeminiClient;

  constructor() {
    logger.info('[OrchestratorEngine] Constructor called');
    try {
      this.spec = new ConfigLoader().loadSpec();
      logger.info('[OrchestratorEngine] Loaded spec:', {
        hasPhases: !!this.spec?.phases,
        phaseKeys: this.spec?.phases ? Object.keys(this.spec.phases) : [],
        hasValidators: !!this.spec?.validators,
        hasLlmConfig: !!this.spec?.llm_config
      });

      // Defensive validation: ensure spec is properly initialized
      if (!this.spec || !this.spec.phases || Object.keys(this.spec.phases).length === 0) {
        logger.error('[OrchestratorEngine] Constructor validation failed!');
        logger.error('[OrchestratorEngine] this.spec: ' + JSON.stringify(this.spec));
        throw new Error(
          'OrchestratorEngine failed to load spec with phases. ' +
          'Check that orchestrator_spec.yml exists, is valid YAML, and has a phases section defined.'
        );
      }
      logger.info('[OrchestratorEngine] Constructor validation passed');
    } catch (error) {
      logger.error('[OrchestratorEngine] Constructor error:', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }

    try {
      this.validators = new Validators(this.spec.validators);
      this.artifactManager = new ArtifactManager();
    } catch (error) {
      logger.error('[OrchestratorEngine] Failed to initialize validators/artifact manager:', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }

    // Initialize Gemini client with LLM config from orchestrator spec
    // Include phase_overrides for phase-specific temperature/token settings
    const llmConfig = {
      provider: this.spec.llm_config.provider as string,
      model: this.spec.llm_config.model as string,
      max_tokens: this.spec.llm_config.max_tokens as number,
      temperature: this.spec.llm_config.temperature as number,
      timeout_seconds: this.spec.llm_config.timeout_seconds as number,
      api_key: process.env.GEMINI_API_KEY,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      phase_overrides: (this.spec.llm_config as any).phase_overrides || {}
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.llmClient = new GeminiClient(llmConfig as any);
  }

  /**
   * Fetch LLM settings from database (admin overrides)
   */
  private async getLLMSettingsFromDB(): Promise<{
    provider?: string;
    model?: string;
    temperature?: number;
    max_tokens?: number;
    timeout?: number;
  }> {
    try {
      const { db } = await import('@/backend/lib/drizzle');
      const { settings } = await import('@/backend/lib/schema');
      const { like } = await import('drizzle-orm');
      
      const llmSettings = await db.select().from(settings).where(like(settings.key, 'llm_%'));
      
      const result: Record<string, string> = {};
      llmSettings.forEach((s: { key: string; value: string }) => {
        result[s.key] = s.value;
      });
      
      return {
        provider: result['llm_provider'] || undefined,
        model: result['llm_model'] || undefined,
        temperature: result['llm_temperature'] ? parseFloat(result['llm_temperature']) : undefined,
        max_tokens: result['llm_max_tokens'] ? parseInt(result['llm_max_tokens'], 10) : undefined,
        timeout: result['llm_timeout'] ? parseInt(result['llm_timeout'], 10) : undefined
      };
    } catch (error) {
      logger.warn('Failed to fetch LLM settings from database, using YAML defaults', {
        error: error instanceof Error ? error.message : String(error)
      });
      return {};
    }
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
    // Capture ALL project properties locally FIRST to prevent context loss
    const projectId = project.id;
    const currentPhaseName = project.current_phase;
    const stackChoice = project.stack_choice;
    const orchestrationState = project.orchestration_state;

    logger.info('[OrchestratorEngine] runPhaseAgent called for phase: ' + currentPhaseName);

    try {
      logger.info(`Executing agent for phase: ${currentPhaseName}`);

      // Use cached spec from constructor (loaded once to avoid drift)
      const spec = this.spec;

      // Validate spec is loaded
      if (!spec || !spec.phases) {
        throw new Error('[CRITICAL] Failed to load orchestrator spec with phases');
      }

      // Validate phase exists
      if (!spec.phases[currentPhaseName]) {
        throw new Error(`Unknown phase: ${currentPhaseName}`);
      }

      // Use cached validators (initialized in constructor)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const validators = this.validators;
      const artifactManager = new ArtifactManager();

      // Fetch LLM settings from database (admin overrides)
      const dbSettings = await this.getLLMSettingsFromDB();
      
      // Determine provider (database setting takes precedence)
      const provider = (dbSettings.provider || spec.llm_config.provider || 'gemini') as ProviderType;
      const apiKey = await getProviderApiKeyAsync(provider);
      
      // Create LLM client with database settings taking precedence over YAML
      const llmConfig = {
        provider,
        model: dbSettings.model || spec.llm_config.model as string,
        max_tokens: dbSettings.max_tokens || spec.llm_config.max_tokens as number,
        temperature: dbSettings.temperature || spec.llm_config.temperature as number,
        timeout_seconds: dbSettings.timeout || spec.llm_config.timeout_seconds as number,
        api_key: apiKey,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        phase_overrides: (spec.llm_config as any).phase_overrides || {}
      };
      
      logger.info('[OrchestratorEngine] Using LLM config', {
        provider: llmConfig.provider,
        model: llmConfig.model,
        fromDB: !!dbSettings.model,
        temperature: llmConfig.temperature,
        max_tokens: llmConfig.max_tokens
      });
      
      // Create LLM client using factory (supports multiple providers)
      const llmClient = createLLMClient(llmConfig);
      
      // Get project name for template variables
      const projectName = project.name || 'Untitled Project';

      let generatedArtifacts: Record<string, string> = {};

      // Get executor for current phase and run agent
      switch (currentPhaseName) {
        case 'ANALYSIS':
          generatedArtifacts = await getAnalystExecutor(
            llmClient,
            projectId,
            artifacts,
            projectName
          );
          logger.debug('[OrchestratorEngine] Generated artifacts from executor', {
            phase: currentPhaseName,
            artifactKeys: Object.keys(generatedArtifacts),
            artifactCount: Object.keys(generatedArtifacts).length
          });
          break;

        case 'SPEC':
          // SPEC phase has three parts:
          // 1. PM generates PRD
          // 2. Architect generates data-model and api-spec
          // 3. Design generates design-system, component-inventory, user-flows
          
          // First generate PRD with PM
          const prdArtifacts = await getPMExecutor(
            llmClient,
            projectId,
            artifacts,
            stackChoice,
            projectName
          );

          logger.debug('[SPEC] PRD generation complete', {
            prdLength: prdArtifacts['PRD.md']?.length || 0,
            hasContent: !!prdArtifacts['PRD.md']?.trim()
          });

          // Add the newly generated PRD to artifacts for subsequent agents
          const artifactsWithPRD: Record<string, string> = {
            ...artifacts,
            'SPEC/PRD.md': prdArtifacts['PRD.md'] || ''
          };

          logger.debug('[SPEC] Calling Architect with PRD', {
            prdLength: artifactsWithPRD['SPEC/PRD.md']?.length || 0,
            briefLength: artifacts['ANALYSIS/project-brief.md']?.length || 0
          });

          // Generate data model, API spec, and design artifacts in parallel
          const [architectArtifacts, designArtifacts] = await Promise.all([
            getArchitectExecutor(
              llmClient,
              projectId,
              artifactsWithPRD,
              'SPEC',
              stackChoice,
              projectName
            ),
            getDesignExecutor(
              llmClient,
              projectId,
              artifactsWithPRD,
              projectName
            )
          ]);

          logger.debug('[SPEC] Architect generation complete', {
            dataModelLength: architectArtifacts['data-model.md']?.length || 0,
            apiSpecLength: architectArtifacts['api-spec.json']?.length || 0,
            hasDataModel: !!architectArtifacts['data-model.md']?.trim(),
            hasApiSpec: !!architectArtifacts['api-spec.json']?.trim()
          });

          logger.debug('[SPEC] Design generation complete', {
            designSystemLength: designArtifacts['design-system.md']?.length || 0,
            componentInventoryLength: designArtifacts['component-inventory.md']?.length || 0,
            userFlowsLength: designArtifacts['user-flows.md']?.length || 0
          });

          // Combine all artifacts
          generatedArtifacts = {
            ...prdArtifacts,
            ...architectArtifacts,
            ...designArtifacts
          };
          break;

        case 'SOLUTIONING':
          // Run agents sequentially to avoid rate limiting
          // Architect generates architecture.md first
          const archArtifacts = await getArchitectExecutor(
            llmClient, projectId, artifacts, 'SOLUTIONING', stackChoice, projectName
          );
          logger.info('[SOLUTIONING] Architect Agent complete, starting Scrum Master Agent');
          
          // Small delay to help with rate limiting
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Scrum Master generates epics.md, tasks.md, plan.md
          const scrumArtifacts = await getScruMasterExecutor(
            llmClient, projectId, artifacts, projectName
          );
          
          generatedArtifacts = {
            ...archArtifacts,
            ...scrumArtifacts
          };
          break;

        case 'DEPENDENCIES':
          generatedArtifacts = await getDevOpsExecutor(
            llmClient,
            projectId,
            artifacts,
            stackChoice,
            projectName
          );
          break;

        case 'STACK_SELECTION':
          generatedArtifacts = await getStackSelectionExecutor(
            llmClient,
            projectId,
            artifacts,
            projectName
          );
          break;

        case 'VALIDATE':
          generatedArtifacts = await this.generateValidationArtifacts(project);
          break;

        case 'DONE':
          // Handoff generation happens via separate endpoint
          return {
            success: true,
            artifacts: {},
            message: 'Final phase - use /generate-handoff endpoint'
          };

        default:
          throw new Error(`No executor for phase: ${currentPhaseName}`);
      }

      // Save artifacts to storage and normalize artifact keys with phase prefix
      logger.debug('[OrchestratorEngine] About to save artifacts', {
        phase: currentPhaseName,
        artifactCount: Object.keys(generatedArtifacts).length,
        artifactKeys: Object.keys(generatedArtifacts)
      });

      const normalizedArtifacts: Record<string, string> = {};
      for (const [filename, content] of Object.entries(generatedArtifacts)) {
        logger.debug('[OrchestratorEngine] Saving artifact to local storage', {
          phase: currentPhaseName,
          filename,
          contentLength: content.length
        });
        try {
          await artifactManager.saveArtifact(
            projectId,
            currentPhaseName,
            filename,
            content
          );
        } catch (saveError) {
          logger.debug('[OrchestratorEngine] Local artifact save failed (expected on Vercel)', {
            phase: currentPhaseName,
            filename,
            error: saveError instanceof Error ? saveError.message : String(saveError)
          });
          // Don't throw - local save failure is expected on serverless
        }
        // Normalize artifact keys to include phase prefix for downstream executors
        const key = `${currentPhaseName}/${filename}`;
        normalizedArtifacts[key] = content;
      }

      logger.debug('[OrchestratorEngine] Normalized artifacts for return', {
        phase: currentPhaseName,
        artifactCount: Object.keys(normalizedArtifacts).length
      });

      // Use the orchestrationState that was captured at the start of this method
      // to prevent context loss after long async operations
      const freshOrchestrationState = orchestrationState || {
        artifact_versions: {},
        phase_history: [],
        approval_gates: {}
      };

      // Ensure all required properties exist to prevent undefined access
      if (!freshOrchestrationState.artifact_versions) {
        freshOrchestrationState.artifact_versions = {};
      }
      if (!freshOrchestrationState.phase_history) {
        freshOrchestrationState.phase_history = [];
      }
      if (!freshOrchestrationState.approval_gates) {
        freshOrchestrationState.approval_gates = {};
      }

      // Update artifact versions with fresh orchestration state
      if (!freshOrchestrationState.artifact_versions[currentPhaseName]) {
        freshOrchestrationState.artifact_versions[currentPhaseName] = 1;
      } else {
        freshOrchestrationState.artifact_versions[currentPhaseName]++;
      }

      return {
        success: true,
        artifacts: normalizedArtifacts,
        message: `Agent for phase ${currentPhaseName} completed successfully`
      };
    } catch (error) {
      logger.error('Error running phase agent:', error instanceof Error ? error : new Error(String(error)));
      throw new Error(
        `Failed to execute agent for phase ${currentPhaseName}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  private async generateValidationArtifacts(project: Project): Promise<Record<string, string>> {
    const currentDate = new Date().toISOString().split('T')[0];
    const validatorNames = (this.spec.phases['VALIDATE']?.validators as string[]) || [];
    const results = await this.validators.runValidators(validatorNames, project);

    const phasesToReport = ['ANALYSIS', 'STACK_SELECTION', 'SPEC', 'DEPENDENCIES', 'SOLUTIONING', 'VALIDATE'] as const;
    const coverageRows: Array<{ phase: string; artifact: string; exists: boolean }> = [];
    const validateOutputs = new Set(['validation-report.md', 'coverage-matrix.md']);

    for (const phase of phasesToReport) {
      const outputs = this.spec.phases[phase]?.outputs;
      const outputList = Array.isArray(outputs) ? (outputs as string[]) : [];
      for (const artifact of outputList) {
        const artifactPath = resolve(project.project_path, 'specs', phase, 'v1', artifact);
        const exists = phase === 'VALIDATE' && validateOutputs.has(artifact) ? true : existsSync(artifactPath);
        coverageRows.push({ phase, artifact, exists });
      }
    }

    const total = coverageRows.length;
    const present = coverageRows.filter(r => r.exists).length;
    const missing = total - present;

    const coverageMatrix = `---
title: Coverage Matrix
owner: validator
version: 1.0
date: ${currentDate}
status: draft
---

# Coverage Matrix

## Summary
| Metric | Value |
|--------|-------|
| Total expected artifacts | ${total} |
| Present | ${present} |
| Missing | ${missing} |

## Matrix
| Phase | Artifact | Present |
|------|---------|---------|
${coverageRows.map(r => `| ${r.phase} | ${r.artifact} | ${r.exists ? '✅' : '❌'} |`).join('\n')}
`;

    const validationReport = `---
title: Validation Report
owner: validator
version: 1.0
date: ${currentDate}
status: draft
---

# Validation Report

## Overall Status: ${results.status.toUpperCase()}

## Validators Run
- ${validatorNames.length > 0 ? validatorNames.join('\n- ') : '(none configured)'}

## Checks
\`\`\`json
${JSON.stringify(results.checks || {}, null, 2)}
\`\`\`

## Errors
${results.errors && results.errors.length > 0 ? results.errors.map(e => `- ${e}`).join('\n') : '- None'}

## Warnings
${results.warnings && results.warnings.length > 0 ? results.warnings.map(w => `- ${w}`).join('\n') : '- None'}
`;

    return {
      'validation-report.md': validationReport,
      'coverage-matrix.md': coverageMatrix
    };
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
    logger.info(`Phase transition: ${fromPhase} -> ${toPhase} by ${userId} (${type})`);
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
